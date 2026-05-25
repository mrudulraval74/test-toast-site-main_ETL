import { useState, useEffect, useCallback, useRef } from 'react';
import { FileSpreadsheet, Copy, RotateCcw } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';
import { generateMappingSpecificTests } from '@/utils/mappingSpecificTestGenerator';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from '@/components/ui/dialog';
import { connectionsApi, queriesApi, reportsApi, compareApi } from '@/lib/api';
import { supabase } from "@/integrations/supabase/client";
import { Agent, isAgentOnline } from "@/utils/agentUtils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useParams } from "react-router-dom";
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

// Import Stepper and Step Components
import { WorkflowStepper } from './ai-comparison/WorkflowStepper';
import { ConnectionsPanel } from './ConnectionsPanel'; // Full connections management
import { UploadValidationStep } from './ai-comparison-workflow/UploadValidationStep';
import { TestComparisonStep } from './ai-comparison-workflow/TestComparisonStep';
import { SaveResultsStep } from './ai-comparison-workflow/SaveResultsStep';
import { TestHistorySidebar, SaveRunDialog } from './ai-comparison/TestHistorySidebar';


// Shared Interfaces
interface TestCase {
    name: string;
    description: string;
    sourceSQL: string;
    targetSQL: string;
    expectedResult: string;
    category?: 'direct_move' | 'business_rule' | 'transformation' | 'general' | 'structure';
    severity?: 'critical' | 'major' | 'minor';
    metadata?: any;
    lastRunResult?: {
        status: 'pass' | 'fail' | 'running';
        message: string;
        timestamp: Date;
        details?: {
            sourceCount: number;
            targetCount: number;
            sourceData?: any[];
            targetData?: any[];
            comparisonData?: any[];
            compareColumns?: string[];
            comparisonType: string;
            executionTime?: number;
            mismatchData?: any[];
        };
    };
}

interface MappingAnalysis {
    sourceTables: string[];
    targetTables: string[];
    businessRules: string[];
    mappings?: any[];
    testCases: TestCase[];
}

type MappingSheetMode = 'qa_standard' | 'convert_to_qa_standard';

const normalizeSavedRuns = (rawData: any): any[] => {
    const reports = Array.isArray(rawData)
        ? rawData
        : Array.isArray(rawData?.reports)
            ? rawData.reports
            : [];

    return reports
        .filter(Boolean)
        .map((run: any) => {
            const testCases = Array.isArray(run?.summary?.testCases)
                ? run.summary.testCases
                : Array.isArray(run?.testCases)
                    ? run.testCases
                    : [];

            const passedTests = typeof run?.summary?.passedTests === 'number'
                ? run.summary.passedTests
                : testCases.filter((tc: any) => tc?.lastRunResult?.status === 'pass').length;

            const failedTests = typeof run?.summary?.failedTests === 'number'
                ? run.summary.failedTests
                : testCases.filter((tc: any) => tc?.lastRunResult?.status === 'fail').length;

            const totalTests = typeof run?.summary?.totalTests === 'number'
                ? run.summary.totalTests
                : testCases.length;
            const folderName = (run?.summary?.folderName ?? run?.folderName ?? '').toString().trim();

            return {
                ...run,
                summary: {
                    ...(run?.summary || {}),
                    isTestSuite: run?.summary?.isTestSuite ?? true,
                    fileName: run?.summary?.fileName || run?.fileName || 'Saved Run',
                    folderName: folderName || undefined,
                    totalTests,
                    passedTests,
                    failedTests,
                    testCases
                }
            };
        })
        .filter((run: any) => run?.summary?.isTestSuite);
};

// Helper Function
function replaceTablePlaceholders(analysis: MappingAnalysis, sourceConn?: any, targetConn?: any): MappingAnalysis {
    let sourceTable = analysis.sourceTables[0] || 'SourceTable';
    let targetTable = analysis.targetTables[0] || 'TargetTable';

    const getFormattedTableName = (conn: any, originalName: string) => {
        if (!conn || !conn.database) return originalName;

        const type = conn.type?.toLowerCase() || 'mssql';
        const isPostgres = type === 'postgresql' || type === 'redshift' || type === 'snowflake';
        const isMySQL = type === 'mysql' || type === 'mariadb';
        const isOracle = type === 'oracle';

        // Parse existing table format
        // Handle names that might already be quoted
        const cleanName = originalName.replace(/[\[\]"`]/g, '');
        const parts = cleanName.split('.');

        let schema = 'dbo';
        let tableName = cleanName;

        if (isPostgres) schema = 'public';
        if (isMySQL) schema = ''; // MySQL doesn't use schema in the same way usually, or it's part of DB
        if (isOracle) schema = conn.username?.toUpperCase() || ''; // Oracle usually uses username as schema

        if (parts.length === 2) {
            schema = parts[0];
            tableName = parts[1];
        } else if (parts.length === 3) {
            // database.schema.table
            schema = parts[1];
            tableName = parts[2];
        } else if (parts.length === 1) {
            tableName = parts[0];
        }

        if (isMySQL) {
            // MySQL: `database`.`table` (schema is usually implied or separate)
            return `\`${conn.database}\`.\`${tableName}\``;
        } else if (isPostgres) {
            // Postgres: "database"."schema"."table" or just "schema"."table" if connected to DB
            // Usually just schema.table is enough if we are in the right DB
            return `"${schema}"."${tableName}"`;
        } else if (isOracle) {
            // Oracle: "SCHEMA"."TABLE"
            return `"${schema}"."${tableName}"`;
        } else {
            // MSSQL: [database].[schema].[table]
            return `[${conn.database}].[${schema}].[${tableName}]`;
        }
    };

    if (sourceConn?.database) {
        sourceTable = getFormattedTableName(sourceConn, sourceTable);
    }

    if (targetConn?.database) {
        targetTable = getFormattedTableName(targetConn, targetTable);
    }

    return {
        ...analysis,
        testCases: analysis.testCases.map(tc => ({
            ...tc,
            sourceSQL: tc.sourceSQL
                .replace(/\{\{SRC_TABLE\}\}/g, sourceTable)
                .replace(/\{\{TGT_TABLE\}\}/g, targetTable),
            targetSQL: tc.targetSQL
                .replace(/\{\{SRC_TABLE\}\}/g, sourceTable)
                .replace(/\{\{TGT_TABLE\}\}/g, targetTable),
            metadata: {
                ...(tc as any).metadata,
                sourceConnection: sourceConn?.name,
                targetConnection: targetConn?.name
            }
        }))
    };
}

// Match mapping analysis to real database schema
async function matchToRealSchema(analysis: MappingAnalysis, sourceSchema: any, targetSchema: any): Promise<MappingAnalysis> {
    const { findTableInSchema } = await import('@/utils/schemaFetcher');

    let matchedSourceTable = analysis.sourceTables[0];
    let matchedTargetTable = analysis.targetTables[0];

    // Try to find source table in real schema
    if (sourceSchema && analysis.sourceTables.length > 0) {
        const foundSource = findTableInSchema(sourceSchema, analysis.sourceTables[0]);
        if (foundSource) {
            matchedSourceTable = `[${foundSource.schema}].[${foundSource.tableName}]`;
            console.log('Matched source table:', matchedSourceTable);
        }
    }

    // Try to find target table in real schema
    if (targetSchema && analysis.targetTables.length > 0) {
        const foundTarget = findTableInSchema(targetSchema, analysis.targetTables[0]);
        if (foundTarget) {
            matchedTargetTable = `[${foundTarget.schema}].[${foundTarget.tableName}]`;
            console.log('Matched target table:', matchedTargetTable);
        }
    }

    // Update analysis with matched table names
    return {
        ...analysis,
        sourceTables: matchedSourceTable ? [matchedSourceTable] : analysis.sourceTables,
        targetTables: matchedTargetTable ? [matchedTargetTable] : analysis.targetTables,
        businessRules: [
            ...analysis.businessRules,
            sourceSchema ? `✅ Source table verified in database` : '⚠️ Source schema not available',
            targetSchema ? `✅ Target table verified in database` : '⚠️ Target schema not available'
        ]
    };
}

export default function AIComparison() {
    const { toast } = useToast();
    const { projectId } = useParams<{ projectId?: string }>();

    const [isDragging, setIsDragging] = useState(false);
    const [uploadedFile, setUploadedFile] = useState<{ name: string; data: any[] } | null>(null);
    const [sheets, setSheets] = useState<{ name: string; data: any[] }[]>([]);
    const [selectedSheetNames, setSelectedSheetNames] = useState<string[]>([]);
    const [mappingSheetMode, setMappingSheetMode] = useState<MappingSheetMode>('qa_standard');
    const [isSheetInQAStandardFormat, setIsSheetInQAStandardFormat] = useState(false);
    const [analysis, setAnalysis] = useState<MappingAnalysis | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisError, setAnalysisError] = useState<string | null>(null);

    // Prompt Instructions State
    const [promptInstructions, setPromptInstructions] = useState<string>('');

    // SQL Dialog State
    const [showSQLDialog, setShowSQLDialog] = useState(false);
    const [selectedSQL, setSelectedSQL] = useState<{ source: string; target: string; name: string } | null>(null);

    // Agent State
    const [agents, setAgents] = useState<Agent[]>([]);
    const [selectedAgentId, setSelectedAgentId] = useState<string>("");
    const [loadingAgents, setLoadingAgents] = useState(false);
    const agentFetchInFlightRef = useRef(false);
    const pendingAgentRefreshRef = useRef(false);
    const lastAgentFetchAtRef = useRef(0);

    const fetchAgents = useCallback(async (options?: { silent?: boolean; force?: boolean }) => {
        const silent = options?.silent ?? false;
        const force = options?.force ?? false;
        const now = Date.now();

        if (agentFetchInFlightRef.current) {
            pendingAgentRefreshRef.current = true;
            return;
        }

        if (!force && silent && now - lastAgentFetchAtRef.current < 5000) {
            return;
        }

        agentFetchInFlightRef.current = true;
        setLoadingAgents(true);
        try {
            const { data, error } = await supabase
                .from('self_hosted_agents')
                .select('id, agent_name, status, last_heartbeat, running_jobs, capacity, project_id, agent_type')
                // .eq('agent_type', 'etl') // Removed strict filter to allow general agents
                .order('status', { ascending: false }); // Online first

            if (error) throw error;

            const nextAgents = (data || []) as Agent[];
            setAgents(nextAgents);

            // Keep currently selected active agent if still online; otherwise select first online.
            setSelectedAgentId((prevSelectedId) => {
                if (prevSelectedId) {
                    const selected = nextAgents.find((agent) => agent.id === prevSelectedId);
                    if (selected && isAgentOnline(selected)) return prevSelectedId;
                }
                const onlineAgent = nextAgents.find((agent) => isAgentOnline(agent));
                return onlineAgent ? onlineAgent.id : "";
            });
        } catch (err) {
            console.error("Failed to fetch agents", err);
            if (!silent) {
                toast({ title: "Agent Error", description: "Failed to load ETL agents", variant: "destructive" });
            }
        } finally {
            agentFetchInFlightRef.current = false;
            lastAgentFetchAtRef.current = Date.now();
            setLoadingAgents(false);

            if (pendingAgentRefreshRef.current) {
                pendingAgentRefreshRef.current = false;
                window.setTimeout(() => {
                    void fetchAgents({ silent: true, force: true });
                }, 500);
            }
        }
    }, [toast]);

    const selectableAgents = agents.filter((agent) => isAgentOnline(agent));
    const offlineAgents = agents.filter((agent) => !isAgentOnline(agent));

    useEffect(() => {
        if (!selectedAgentId) return;
        const selectedAgent = agents.find((agent) => agent.id === selectedAgentId);
        if (selectedAgent && !isAgentOnline(selectedAgent)) {
            setSelectedAgentId("");
        }
    }, [agents, selectedAgentId]);

    // Fetch Agents on Mount
    useEffect(() => {
        fetchAgents();

        // Subscribe to agent changes
        const channel = supabase
            .channel('public:self_hosted_agents')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'self_hosted_agents' }, () => {
                fetchAgents({ silent: true });
            })
            .subscribe();

        // Fallback polling keeps heartbeat status fresh even if realtime events are delayed/missed.
        const intervalId = window.setInterval(() => {
            fetchAgents({ silent: true });
        }, 30000);

        return () => {
            window.clearInterval(intervalId);
            supabase.removeChannel(channel);
        };
    }, [fetchAgents]);

    // Validation State
    const [isValidating, setIsValidating] = useState(false);
    const [showValidationDialog, setShowValidationDialog] = useState(false);
    const [validationResults, setValidationResults] = useState<{
        sourceErrors: string[];
        targetErrors: string[];
        warnings: string[];
        matches: string[];
        stats: {
            tablesFound: number;
            columnsFound: number;
            totalTables: number;
            totalColumns: number;
        };
        success: boolean;
    } | null>(null);

    // Connection Selection State
    const [savedConnections, setSavedConnections] = useState<any[]>([]);
    const [sourceConnections, setSourceConnections] = useState<any[]>([{ id: null, name: 'None' }]);
    const [multiSourceMode, setMultiSourceMode] = useState(false);
    const [targetConnection, setTargetConnection] = useState<any>(null);
    const [isLoadingConnections, setIsLoadingConnections] = useState(true);
    const [savedRuns, setSavedRuns] = useState<any[]>([]);

    // Save Dialog State
    const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
    const [isHistorySidebarHidden, setIsHistorySidebarHidden] = useState(false);



    // Stepper State
    const [currentStep, setCurrentStep] = useState(1);
    const [selectedTestIndices, setSelectedTestIndices] = useState<number[]>([]); // For filtering to selected tests
    const [isRunningAllTests, setIsRunningAllTests] = useState(false);
    const [currentExecutingTestName, setCurrentExecutingTestName] = useState<string | null>(null);
    const analysisRef = useRef<MappingAnalysis | null>(null);
    const stopExecutionRequestedRef = useRef(false);
    const activeExecutionCancelRef = useRef<null | (() => void)>(null);
    const isBatchRunningRef = useRef(false);
    const batchQueuedIndicesRef = useRef<number[]>([]);
    const batchProcessedIndicesRef = useRef<Set<number>>(new Set());
    const batchExcludedIndicesRef = useRef<Set<number>>(new Set());
    const perTestToastDedupRef = useRef<Map<string, number>>(new Map());

    useEffect(() => {
        analysisRef.current = analysis;
    }, [analysis]);

    // Step Access Validation
    const canAccessStep = (step: number): boolean => {
        if (step === 1) return true; // Connections panel always accessible
        if (step === 2) return savedConnections.length >= 2; // Need at least 2 connections created
        if (step === 3) return !!(uploadedFile || analysis?.testCases?.length); // Need file or loaded test cases
        if (step === 4) return !!(analysis?.testCases?.length); // Need test cases for save
        return false;
    };

    // Callback when connections are saved (triggers re-validation)
    const handleConnectionSaved = async () => {
        try {
            const { data } = await connectionsApi.list();
            if (data && Array.isArray(data)) {
                setSavedConnections(data);
            }
        } catch (error) {
            console.error('Failed to reload connections:', error);
        }
    };

    // Handle save selected tests - navigate to save results step
    const handleSaveSelected = (selectedIndices: number[]) => {
        setSelectedTestIndices(selectedIndices);
        setCurrentStep(4); // Navigate to Save Results to save selected tests
        // Scroll to top to show the step
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Load Connections and History on mount

    // Load Connections
    useEffect(() => {
        const loadConnections = async () => {
            try {
                const { data } = await connectionsApi.list();
                if (data && Array.isArray(data)) {
                    setSavedConnections(data);
                }
            } catch (error) {
                console.error('Failed to load connections:', error);
            } finally {
                setIsLoadingConnections(false);
            }
        };
        const loadHistory = async () => {
            try {
                const { data } = await reportsApi.list();
                setSavedRuns(normalizeSavedRuns(data));
            } catch (error) {
                console.error("Failed to load history:", error);
            }
        };
        loadConnections();
        loadHistory();
    }, []);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) processFile(file);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processFile(file);
    };

    const processFile = async (file: File) => {
        const reader = new FileReader();
        reader.onload = async (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });

            // Capture all sheets
            const loadedSheets = wb.SheetNames.map(name => ({
                name,
                data: XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '', raw: false })
            }));

            const isQaStandardUpload = mappingSheetMode === 'qa_standard';
            const selectedNames = loadedSheets.map((sheet) => sheet.name);

            setSheets(loadedSheets);
            // Reset previous analysis state; user will explicitly click Analyze Selected.
            setAnalysis(null);
            setValidationResults(null);
            setAnalysisError(null);
            setSelectedTestIndices([]);
            setIsSheetInQAStandardFormat(isQaStandardUpload);

            if (loadedSheets.length > 0) {
                const firstSheet = loadedSheets[0];
                setUploadedFile({ name: file.name, data: firstSheet.data });
                setSelectedSheetNames(selectedNames);

                toast({
                    title: "File Loaded",
                    description: isQaStandardUpload
                        ? `Loaded ${loadedSheets.length} QA standard sheet${loadedSheets.length > 1 ? 's' : ''}. Analyzing now.`
                        : `Loaded ${loadedSheets.length} sheet${loadedSheets.length > 1 ? 's' : ''}. Select sheets to analyze.`
                });

                if (isQaStandardUpload) {
                    await analyzeMapping(loadedSheets, { forceQaStandard: true });
                }
            } else {
                toast({ title: "Empty File", description: "No sheets found in file.", variant: "destructive" });
            }
        };
        reader.readAsBinaryString(file);
    };

    const replaceWorkbook = async (
        nextFileName: string,
        nextSheets: { name: string; data: any[] }[],
        options?: { analyze?: boolean }
    ) => {
        setSheets(nextSheets);
        setAnalysis(null);
        setValidationResults(null);
        setAnalysisError(null);
        setSelectedTestIndices([]);
        setIsSheetInQAStandardFormat(true); // Mark as QA Standard format since this comes from conversion

        if (nextSheets.length > 0) {
            setUploadedFile({ name: nextFileName, data: nextSheets[0].data });
            setSelectedSheetNames(nextSheets.length > 1 ? nextSheets.map((s) => s.name) : [nextSheets[0].name]);
        } else {
            setUploadedFile(null);
            setSelectedSheetNames([]);
        }

        toast({
            title: "Workbook Loaded",
            description: `Loaded ${nextSheets.length} QA standard sheet${nextSheets.length === 1 ? "" : "s"}.`
        });

        if (nextSheets.length > 0 && options?.analyze !== false) {
            await analyzeMapping(nextSheets, { forceQaStandard: true });
        }
    };

    const handleConvertAndValidate = async (
        fileName: string,
        convertedSheets: { name: string; data: any[] }[]
    ): Promise<{ success: boolean; error?: string }> => {
        console.log(`🔍 [handleConvertAndValidate] Starting workflow for converted file: ${fileName}`);
        
        // 1. Update workbook state in UI
        setSheets(convertedSheets);
        setAnalysis(null);
        setValidationResults(null);
        setAnalysisError(null);
        setSelectedTestIndices([]);
        setIsSheetInQAStandardFormat(true);

        if (convertedSheets.length > 0) {
            setUploadedFile({ name: fileName, data: convertedSheets[0].data });
            setSelectedSheetNames(convertedSheets.length > 1 ? convertedSheets.map((s) => s.name) : [convertedSheets[0].name]);
        } else {
            setUploadedFile(null);
            setSelectedSheetNames([]);
            console.error("❌ [handleConvertAndValidate] No sheets found in converted output.");
            return { success: false, error: "No sheets to validate" };
        }

        // 2. Aggregate mappings and tables immediately
        console.log(`[handleConvertAndValidate] Parsing mappings from ${convertedSheets.length} sheets`);
        const aggregatedParsedMappings: any[] = [];
        const aggregatedSourceTables = new Set<string>();
        const aggregatedTargetTables = new Set<string>();
        const aggregatedErrors: string[] = [];

        try {
            const { normalizeEmbeddedHeaderRows } = await import('@/utils/mappingSheetParser');

            for (const sheet of convertedSheets) {
                let globalSourceTable = '';
                let globalTargetTable = '';
                for (const row of sheet.data) {
                    const fieldKey = Object.keys(row).find(k => /field|key|attribute/i.test(k));
                    const valueKey = Object.keys(row).find(k => /value|detail|name/i.test(k));
                    if (!fieldKey || !valueKey) continue;
                    const field = String(row[fieldKey] ?? '').trim().toLowerCase();
                    const value = String(row[valueKey] ?? '').trim();
                    if (!value) continue;
                    if (field === 'target table name' || field === 'target table') globalTargetTable = value;
                    if (field === 'source' || field === 'source table name' || field === 'source table') globalSourceTable = value;
                }

                const normalizedData = normalizeEmbeddedHeaderRows(sheet.data);
                const mappings = normalizedData.filter((row: any) => {
                    const targetAttr = String(row['Target Attribute Name'] ?? '').trim();
                    const sourceAttr = String(row['Source Attribute Name'] ?? '').trim();
                    const targetTbl  = String(row['Target Table Name'] ?? '').trim();
                    const sourceTbl  = String(row['Source Table Name'] ?? '').trim();
                    if (targetTbl === 'Target Table Name') return false;
                    return targetAttr || sourceAttr || targetTbl || sourceTbl;
                }).map((row: any) => {
                    const mappingRule = String(row['Data Mapping Rule'] ?? row['Mapping Rule'] ?? '').trim();
                    const targetKeyRaw = String(row['Target Key'] ?? row['Key'] ?? '').trim().toUpperCase();
                    const isNullableRaw = String(row['IsNullable'] ?? row['Is Nullable'] ?? row['Nullable'] ?? '').trim().toLowerCase();

                    const rowSourceTable = String(row['Source Table Name'] ?? '').trim();
                    const rowTargetTable = String(row['Target Table Name'] ?? '').trim();
                    const resolvedSourceTable = rowSourceTable || globalSourceTable;
                    const resolvedTargetTable = rowTargetTable || globalTargetTable;

                    return {
                        sourceColumn: String(row['Source Attribute Name'] ?? '').trim(),
                        targetColumn: String(row['Target Attribute Name'] ?? '').trim(),
                        sourceTable: resolvedSourceTable,
                        targetTable: resolvedTargetTable,
                        transformationType: 'direct_move' as const,
                        transformationLogic: mappingRule,
                        sourceDataType: String(row['Source Attribute DataType'] ?? row['Source DataType'] ?? '').trim(),
                        targetDataType: String(row['Target DataType'] ?? row['Target Attribute DataType'] ?? '').trim(),
                        notes: String(row['Notes'] ?? '').trim(),
                        comments: String(row['Notes'] ?? '').trim(),
                        complexity: 'simple' as const,
                        isPrimaryKey: targetKeyRaw === 'PK' || targetKeyRaw === 'Y' || targetKeyRaw === 'YES' || targetKeyRaw === 'TRUE' || targetKeyRaw === '1',
                        isNullable: isNullableRaw !== 'no' && isNullableRaw !== 'false' && isNullableRaw !== '0',
                        _sheetName: sheet.name
                    };
                }).filter((m: any) => m.targetColumn);

                if (mappings.length > 0) {
                    aggregatedParsedMappings.push(...mappings);
                    const srcTableForSheet = globalSourceTable || mappings.find((m: any) => m.sourceTable)?.sourceTable || '';
                    const tgtTableForSheet = globalTargetTable || mappings.find((m: any) => m.targetTable)?.targetTable || '';
                    if (srcTableForSheet) aggregatedSourceTables.add(srcTableForSheet);
                    if (tgtTableForSheet) aggregatedTargetTables.add(tgtTableForSheet);
                } else {
                    aggregatedErrors.push(`[${sheet.name}] No valid mappings found in QA standard format.`);
                }
            }

            if (aggregatedParsedMappings.length === 0) {
                const errMsg = aggregatedErrors.length > 0 ? aggregatedErrors.join('\n') : "No mappings detected in selected sheets.";
                console.error("❌ [handleConvertAndValidate] Mapping extraction failed:", errMsg);
                setAnalysisError(errMsg);
                return { success: false, error: errMsg };
            }

            const preliminaryAnalysis = {
                sourceTables: Array.from(aggregatedSourceTables),
                targetTables: Array.from(aggregatedTargetTables),
                businessRules: [`📋 Analyzed ${convertedSheets.length} sheets`, `Total Mappings: ${aggregatedParsedMappings.length}`],
                testCases: [],
                mappings: aggregatedParsedMappings
            };

            const analysisWithPlaceholders = replaceTablePlaceholders(preliminaryAnalysis as any, sourceConnections[0], targetConnection);
            setAnalysis(analysisWithPlaceholders);

            // 3. Trigger Structure Validation against database connections
            const hasSource = multiSourceMode ? sourceConnections.some(c => c.id) : sourceConnections[0]?.id;
            if (!hasSource || !targetConnection) {
                console.warn("⚠️ [handleConvertAndValidate] Connections are not fully configured.");
                return { success: false, error: "Please select both Source and Target connections to validate structure." };
            }

            if (!selectedAgentId) {
                console.warn("⚠️ [handleConvertAndValidate] No active agent selected.");
                return { success: false, error: "Please select an active ETL Agent in Step 1 to run metadata validation." };
            }

            console.log('🔍 [handleConvertAndValidate] Triggering backend schema fetch API calls...');
            setIsValidating(true);
            const startTime = Date.now();

            const results = {
                sourceErrors: [] as string[],
                targetErrors: [] as string[],
                warnings: [] as string[],
                matches: [] as string[],
                stats: { tablesFound: 0, columnsFound: 0, totalTables: 0, totalColumns: 0 },
                success: true
            };

            let sourceSchemas: any[] = [];
            let targetSchema: any = null;

            const activeSources = multiSourceMode
                ? sourceConnections.filter(c => c.id)
                : [sourceConnections[0]].filter(c => c?.id);

            for (const src of activeSources) {
                try {
                    const { fetchDatabaseSchema } = await import('@/utils/schemaFetcher');
                    const schema = await fetchDatabaseSchema(src.id, selectedAgentId || undefined);
                    sourceSchemas.push(schema);
                    console.log(`✅ [handleConvertAndValidate] Fetched schema for ${src.name}:`, schema?.totalTables || 0, 'tables');
                } catch (e) {
                    const errorMsg = `Failed to fetch metadata for source: ${src.name}`;
                    results.warnings.push(errorMsg);
                    console.warn('❌ [handleConvertAndValidate]', errorMsg, e);
                }
            }

            if (targetConnection) {
                try {
                    const { fetchDatabaseSchema } = await import('@/utils/schemaFetcher');
                    targetSchema = await fetchDatabaseSchema(targetConnection.id, selectedAgentId || undefined);
                    console.log('✅ [handleConvertAndValidate] Fetched target schema:', targetSchema?.totalTables || 0, 'tables');
                } catch (e) {
                    const errorMsg = `Failed to fetch metadata for target: ${targetConnection.name}`;
                    results.warnings.push(errorMsg);
                    console.warn('❌ [handleConvertAndValidate]', errorMsg, e);
                }
            }

            const findTable = (schemaData: any, tableName: string) => {
                if (!schemaData || !Array.isArray(schemaData.tables)) return null;
                const cleanName = tableName.replace(/[\[\]]/g, '');
                const parts = cleanName.split('.');
                const tableBase = parts.length > 1 ? parts[1] : parts[0];
                const schemaBase = parts.length > 1 ? parts[0] : null;

                for (const table of (schemaData.tables as any[])) {
                    const schemaName = (table.schema || '').toLowerCase();
                    const tableNameLower = (table.tableName || table.name || '').toLowerCase();
                    if (tableNameLower === tableBase.toLowerCase()) {
                        if (!schemaBase || schemaName === schemaBase.toLowerCase()) {
                            return {
                                name: table.tableName || table.name,
                                columns: table.columns || [],
                            };
                        }
                    }
                }
                return null;
            };

            const processedSourceTables = new Set<string>();
            const processedTargetTables = new Set<string>();
            const sourceMatches = new Map<string, { total: Set<string>, found: Set<string>, tableFound: boolean }>();
            const targetMatches = new Map<string, { total: Set<string>, found: Set<string>, tableFound: boolean }>();

            const getTableStats = (map: Map<string, { total: Set<string>, found: Set<string>, tableFound: boolean }>, tableName: string) => {
                if (!map.has(tableName)) map.set(tableName, { total: new Set<string>(), found: new Set<string>(), tableFound: false });
                return map.get(tableName)!;
            };

            let skippedMappings = { source: 0, target: 0 };

            for (const mapping of aggregatedParsedMappings) {
                // Source
                const hasValidSourceData = mapping.sourceTable &&
                    mapping.sourceTable !== 'Source' &&
                    mapping.sourceTable !== '-.-' &&
                    !mapping.sourceTable.includes('-.-') &&
                    !mapping.sourceTable.includes('[Auto-detected') &&
                    !mapping.sourceTable.includes('[Configure') &&
                    mapping.sourceColumn &&
                    mapping.sourceColumn !== 'Unknown';

                if (sourceSchemas.length > 0 && hasValidSourceData) {
                    const tableKey = mapping.sourceTable;
                    const stats = getTableStats(sourceMatches, tableKey);
                    stats.total.add(mapping.sourceColumn);

                    let tableFound = false;
                    for (const schemaData of sourceSchemas) {
                        const table = findTable(schemaData, tableKey);
                        if (table) {
                            tableFound = true;
                            stats.tableFound = true;
                            const col = table.columns.find((c: any) => c.name.toLowerCase() === mapping.sourceColumn.toLowerCase());
                            if (col) stats.found.add(mapping.sourceColumn);
                            break;
                        }
                    }

                    if (!tableFound) {
                        if (!processedSourceTables.has(tableKey)) {
                            results.sourceErrors.push(`Source Table '${tableKey}' not found in any connected databases.`);
                            processedSourceTables.add(tableKey);
                        }
                    } else {
                        const isFound = Array.from(stats.found).some(c => c.toLowerCase() === mapping.sourceColumn.toLowerCase());
                        if (!isFound) {
                            results.sourceErrors.push(`Column '${mapping.sourceColumn}' not found in '${tableKey}'.`);
                        }
                    }
                } else if (sourceSchemas.length > 0) {
                    skippedMappings.source++;
                }

                // Target
                const hasValidTargetData = mapping.targetTable &&
                    mapping.targetTable !== 'Target' &&
                    mapping.targetTable !== '-.-' &&
                    !mapping.targetTable.includes('-.-') &&
                    !mapping.targetTable.includes('[Auto-detected') &&
                    !mapping.targetTable.includes('[Configure') &&
                    mapping.targetColumn &&
                    mapping.targetColumn !== 'Unknown';

                if (targetSchema && hasValidTargetData) {
                    const tableKey = mapping.targetTable;
                    const stats = getTableStats(targetMatches, tableKey);
                    stats.total.add(mapping.targetColumn);
                    const table = findTable(targetSchema, tableKey);

                    if (!table) {
                        if (!processedTargetTables.has(tableKey)) {
                            results.targetErrors.push(`Target Table '${tableKey}' not found.`);
                            processedTargetTables.add(tableKey);
                        }
                    } else {
                        stats.tableFound = true;
                        const col = table.columns.find((c: any) => c.name.toLowerCase() === mapping.targetColumn.toLowerCase());
                        if (!col) results.targetErrors.push(`Column '${mapping.targetColumn}' not found in '${table.name}'.`);
                        else stats.found.add(mapping.targetColumn);
                    }
                } else if (targetSchema) {
                    skippedMappings.target++;
                }
            }

            if (skippedMappings.source > 0 || skippedMappings.target > 0) {
                results.warnings.push(`⚠️ Skipped ${skippedMappings.source} source and ${skippedMappings.target} target mappings due to missing/generic table names.`);
            }

            let totalTbl = 0, foundTbl = 0, totalCol = 0, foundCol = 0;
            sourceMatches.forEach((stats, tableName) => {
                totalTbl++; totalCol += stats.total.size;
                if (stats.tableFound) { foundTbl++; foundCol += stats.found.size; results.matches.push(`source:Table '${tableName}': Verified ${stats.found.size}/${stats.total.size} cols`); }
            });
            targetMatches.forEach((stats, tableName) => {
                totalTbl++; totalCol += stats.total.size;
                if (stats.tableFound) { foundTbl++; foundCol += stats.found.size; results.matches.push(`target:Table '${tableName}': Verified ${stats.found.size}/${stats.total.size} cols`); }
            });

            results.stats = { tablesFound: foundTbl, columnsFound: foundCol, totalTables: totalTbl, totalColumns: totalCol };
            results.success = results.sourceErrors.length === 0 && results.targetErrors.length === 0;

            console.log('📊 [handleConvertAndValidate] Validation Results:', results.stats);
            console.log('✅ [handleConvertAndValidate] Matches:', results.matches.length);
            console.log('❌ [handleConvertAndValidate] Errors:', results.sourceErrors.length + results.targetErrors.length);

            setValidationResults(results);

            if (results.success) {
                console.log("✅ [handleConvertAndValidate] Database structure validation passed! Logging credit deduction...");
                // Deduct credits (insert into ai_usage_logs)
                try {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (session?.user?.id) {
                        const projectId = activeSources[0]?.project_id || targetConnection?.project_id || null;
                        const { error: creditError } = await supabase
                            .from('ai_usage_logs')
                            .insert({
                                project_id: projectId,
                                user_id: session.user.id,
                                feature_type: 'structure_validation',
                                success: true,
                                tokens_used: 10,
                                execution_time_ms: Date.now() - startTime
                            });
                        if (creditError) {
                            console.error('[handleConvertAndValidate] Credit log error:', creditError);
                        } else {
                            console.log('💳 [handleConvertAndValidate] Credit deduction successful (10 units)');
                        }
                    }
                } catch (creditErr) {
                    console.error('[handleConvertAndValidate] Failed to log usage:', creditErr);
                }

                // Advance step to Step 3
                setTimeout(() => {
                    setCurrentStep(3);
                }, 500);

                return { success: true };
            } else {
                const totalErrors = results.sourceErrors.length + results.targetErrors.length;
                console.error(`❌ [handleConvertAndValidate] Structure validation failed with ${totalErrors} unresolved issues.`);
                return { 
                    success: false, 
                    error: `Structure validation failed with ${totalErrors} errors. Please review the issues in the validation panel.` 
                };
            }
        } catch (err) {
            console.error('❌ [handleConvertAndValidate] Error during conversion/validation process:', err);
            return { success: false, error: err instanceof Error ? err.message : 'Unknown error during convert & validate' };
        } finally {
            setIsValidating(false);
        }
    };

    const handleSheetsSelectionChange = (names: string[]) => {
        setSelectedSheetNames(names);
        // Do not auto-analyze. User must click "Analyze Selected"
    };

    const handleAnalyzeSelected = () => {
        const selectedSheets = sheets.filter(s => selectedSheetNames.includes(s.name));
        if (selectedSheets.length === 0) {
            toast({ title: "No Selection", description: "Please select at least one sheet to analyze.", variant: "destructive" });
            return;
        }
        analyzeMapping(selectedSheets, { forceQaStandard: isSheetInQAStandardFormat });
    };

    const createFallbackTestCases = (mappingData: any[]): MappingAnalysis => {
        return generateMappingSpecificTests(mappingData);
    };

    // Updated to handle multiple sheets and QA Standard format
    const analyzeMapping = async (
        sheetsToAnalyze: { name: string, data: any[] }[],
        options?: { forceQaStandard?: boolean }
    ) => {
        setIsAnalyzing(true);
        setAnalysisError(null);
        setValidationResults(null); // Clear previous results

        try {
            const useQaStandardFormat = options?.forceQaStandard ?? isSheetInQAStandardFormat;
            console.log(`Analyzing ${sheetsToAnalyze.length} sheets (QA Standard: ${useQaStandardFormat})...`);

            // Keep step-2 analysis fast and deterministic.
            // Live schema metadata fetching can block (e.g., when no agent is online), and is handled in structure validation.

            // Aggregated Results
            const aggregatedParsedMappings: any[] = [];
            const aggregatedSourceTables = new Set<string>();
            const aggregatedTargetTables = new Set<string>();
            const aggregatedErrors: string[] = [];
            let hasBlockingMissingCells = false;

            // Handle QA Standard Format vs Raw Mapping Sheet
            if (useQaStandardFormat) {
                const { normalizeEmbeddedHeaderRows } = await import('@/utils/mappingSheetParser');

                // QA Standard Format: Extract mappings directly from known column headers
                for (const sheet of sheetsToAnalyze) {
                    console.log(`Extracting QA Standard format from sheet: ${sheet.name}`);

                    // --- Step 1: Extract full qualified table names from metadata section (Field | Value rows) ---
                    let globalSourceTable = '';
                    let globalTargetTable = '';
                    for (const row of sheet.data) {
                        // Look for Field/Value metadata rows at the top of the sheet
                        const fieldKey = Object.keys(row).find(k => /field|key|attribute/i.test(k));
                        const valueKey = Object.keys(row).find(k => /value|detail|name/i.test(k));
                        if (!fieldKey || !valueKey) continue;
                        const field = String(row[fieldKey] ?? '').trim().toLowerCase();
                        const value = String(row[valueKey] ?? '').trim();
                        if (!value) continue;
                        if (field === 'target table name' || field === 'target table') globalTargetTable = value;
                        if (field === 'source' || field === 'source table name' || field === 'source table') globalSourceTable = value;
                    }
                    console.log(`[QA Format] Metadata tables — Source: "${globalSourceTable}", Target: "${globalTargetTable}"`);

                    // --- Step 2: Normalize the data rows to align with headers ---
                    const normalizedData = normalizeEmbeddedHeaderRows(sheet.data);

                    // --- Step 3: Parse data rows ---
                    const mappings = normalizedData.filter((row: any) => {
                        // Must have at least a target column name — filter out metadata rows and blank rows
                        const targetAttr = String(row['Target Attribute Name'] ?? '').trim();
                        const sourceAttr = String(row['Source Attribute Name'] ?? '').trim();
                        const targetTbl  = String(row['Target Table Name'] ?? '').trim();
                        const sourceTbl  = String(row['Source Table Name'] ?? '').trim();
                        // Skip pure metadata rows (e.g. where Target Table Name === 'Target Table Name')
                        if (targetTbl === 'Target Table Name') return false;
                        return targetAttr || sourceAttr || targetTbl || sourceTbl;
                    }).map((row: any) => {
                        const mappingRule = String(row['Data Mapping Rule'] ?? row['Mapping Rule'] ?? '').trim();
                        const targetKeyRaw = String(row['Target Key'] ?? row['Key'] ?? '').trim().toUpperCase();
                        const isNullableRaw = String(row['IsNullable'] ?? row['Is Nullable'] ?? row['Nullable'] ?? '').trim().toLowerCase();

                        // Resolve table names: prefer row-level, fall back to global metadata
                        const rowSourceTable = String(row['Source Table Name'] ?? '').trim();
                        const rowTargetTable = String(row['Target Table Name'] ?? '').trim();
                        const resolvedSourceTable = rowSourceTable || globalSourceTable;
                        const resolvedTargetTable = rowTargetTable || globalTargetTable;

                        return {
                            sourceColumn: String(row['Source Attribute Name'] ?? '').trim(),
                            targetColumn: String(row['Target Attribute Name'] ?? '').trim(),
                            sourceTable: resolvedSourceTable,
                            targetTable: resolvedTargetTable,
                            transformationType: 'direct_move' as const,
                            transformationLogic: mappingRule,
                            sourceDataType: String(row['Source Attribute DataType'] ?? row['Source DataType'] ?? '').trim(),
                            targetDataType: String(row['Target DataType'] ?? row['Target Attribute DataType'] ?? '').trim(),
                            notes: String(row['Notes'] ?? '').trim(),
                            comments: String(row['Notes'] ?? '').trim(),
                            complexity: 'simple' as const,
                            // PK detection: Target Key = 'PK', 'Y', 'YES', 'TRUE'
                            isPrimaryKey: targetKeyRaw === 'PK' || targetKeyRaw === 'Y' || targetKeyRaw === 'YES' || targetKeyRaw === 'TRUE' || targetKeyRaw === '1',
                            // Nullable: IsNullable = 'no', 'false', '0' → not nullable
                            isNullable: isNullableRaw !== 'no' && isNullableRaw !== 'false' && isNullableRaw !== '0',
                            _sheetName: sheet.name
                        };
                    }).filter((m: any) => m.targetColumn); // must have a target column

                    if (mappings.length === 0) {
                        aggregatedErrors.push(`[${sheet.name}] No valid mappings found in QA Standard format.`);
                        continue;
                    }

                    aggregatedParsedMappings.push(...mappings);

                    // Extract unique tables (prefer global metadata tables, fall back to row-level)
                    const srcTableForSheet = globalSourceTable || mappings.find((m: any) => m.sourceTable)?.sourceTable || '';
                    const tgtTableForSheet = globalTargetTable || mappings.find((m: any) => m.targetTable)?.targetTable || '';
                    if (srcTableForSheet) aggregatedSourceTables.add(srcTableForSheet);
                    if (tgtTableForSheet) aggregatedTargetTables.add(tgtTableForSheet);
                }
            } else {
                // Raw Mapping Format: Use parser to detect and extract mappings
                const { parseMappingSheet } = await import('@/utils/mappingSheetParser');

                // Iterate and Parse
                for (const sheet of sheetsToAnalyze) {
                    console.log(`Parsing raw mapping sheet: ${sheet.name}`);
                    const parsed = parseMappingSheet(sheet.data);

                    if (!parsed.columnMappings || parsed.columnMappings.length === 0) {
                        aggregatedErrors.push(`[${sheet.name}] No valid mappings found.`);
                        continue;
                    }

                    const skipped = parsed.metadata?.skippedRows;
                    if (skipped && (skipped.missingSource > 0 || skipped.missingTarget > 0)) {
                        hasBlockingMissingCells = true;
                        aggregatedErrors.push(
                            `[${sheet.name}] Missing required cells: ${skipped.missingSource} row(s) missing Source Attribute Name, ${skipped.missingTarget} row(s) missing Target Attribute Name.`
                        );
                    }

                    // Add sheet name to mappings for context
                    const mappingsWithContext = parsed.columnMappings.map(m => ({
                        ...m,
                        _sheetName: sheet.name
                    }));

                    aggregatedParsedMappings.push(...mappingsWithContext);
                    parsed.sourceTables.forEach(t => aggregatedSourceTables.add(t));
                    parsed.targetTables.forEach(t => aggregatedTargetTables.add(t));
                }
            }

            if (aggregatedParsedMappings.length === 0) {
                const msg = aggregatedErrors.length > 0 ? aggregatedErrors.join('\n') : "No mappings detected in selected sheets.";
                setAnalysisError(msg);
                throw new Error("INVALID_LAYOUT");
            }

            if (hasBlockingMissingCells && !useQaStandardFormat) {
                setAnalysisError(aggregatedErrors.join('\n'));
                throw new Error("INVALID_LAYOUT");
            }

            const preliminaryAnalysis = {
                sourceTables: Array.from(aggregatedSourceTables),
                targetTables: Array.from(aggregatedTargetTables),
                businessRules: [`📋 Analyzed ${sheetsToAnalyze.length} sheets`, `Total Mappings: ${aggregatedParsedMappings.length}`],
                testCases: [],
                mappings: aggregatedParsedMappings
            };

            const analysisWithPlaceholders = replaceTablePlaceholders(preliminaryAnalysis as any, sourceConnections[0], targetConnection);
            setAnalysis(analysisWithPlaceholders);

            toast({ title: "Analysis Ready", description: "Review the mappings, then click Validate Structure when you're ready." });

        } catch (error) {
            console.error('Analysis error:', error);
            if (error instanceof Error && error.message === "INVALID_LAYOUT") {
                setIsAnalyzing(false);
                return;
            }
            // Fallback? Hard to do fallback for multiple sheets without complex logic. 
            // Just show error for now.
            toast({ title: "Analysis Failed", description: "Could not analyze selected sheets.", variant: "destructive" });
        } finally {
            setIsAnalyzing(false);
        }
    };

    // Generate test cases from validated columns and navigate to test page
    const handleProceedToTests = async () => {
        // Need uploadedFile (as fallback check) AND valid analysis/validation
        if ((!uploadedFile?.data && sheets.length === 0) || !validationResults) {
            toast({
                title: "Cannot Proceed",
                description: "Please validate structure first",
                variant: "destructive"
            });
            return;
        }

        try {
            toast({
                title: "Generating Test Cases...",
                description: "Creating tests from validated columns only"
            });

            // Fetch schemas
            let sourceSchemas: any[] = [];
            let targetSchema = null;

            if (multiSourceMode) {
                for (const conn of sourceConnections) {
                    if (conn?.id) {
                        const { fetchDatabaseSchema } = await import('@/utils/schemaFetcher');
                        const schema = await fetchDatabaseSchema(conn.id, selectedAgentId || undefined);
                        if (schema) sourceSchemas.push(schema);
                    }
                }
            } else if (sourceConnections[0]?.id) {
                const { fetchDatabaseSchema } = await import('@/utils/schemaFetcher');
                const schema = await fetchDatabaseSchema(sourceConnections[0].id, selectedAgentId || undefined);
                if (schema) sourceSchemas.push(schema);
            }

            if (targetConnection?.id) {
                const { fetchDatabaseSchema } = await import('@/utils/schemaFetcher');
                targetSchema = await fetchDatabaseSchema(targetConnection.id, selectedAgentId || undefined);
            }

            const selectedSheets = sheets.filter(s => selectedSheetNames.includes(s.name));
            const sheetsForGeneration = selectedSheets.length > 0
                ? selectedSheets
                : (uploadedFile?.data ? [{ name: uploadedFile.name, data: uploadedFile.data }] : []);

            if (sheetsForGeneration.length === 0) {
                toast({
                    title: "No Data",
                    description: "No sheet data available to generate test cases.",
                    variant: "destructive"
                });
                return;
            }
            const allTestCases = [];
            const allSourceTables = new Set<string>();
            const allTargetTables = new Set<string>();

            // Generate tests for EACH sheet
            for (const sheet of sheetsForGeneration) {
                // Use pre-parsed mappings from the analyzeMapping step (analysis.mappings) if available.
                // Filtering by _sheetName ensures each sheet only uses its own mappings.
                // This prevents re-parsing raw sheet data which can produce stale/wrong results
                // (e.g. always generating DimCustomer test cases regardless of the uploaded file).
                const allAnalyzedMappings = analysis?.mappings ?? [];
                const sheetPreParsed = allAnalyzedMappings.filter(
                    (m: any) => !m._sheetName || m._sheetName === sheet.name
                );
                const preParsedForSheet = sheetPreParsed.length > 0 ? sheetPreParsed : undefined;

                // 1. Generate mapping-specific tests (column-level)
                const analyzed = generateMappingSpecificTests(
                    sheet.data,
                    sourceSchemas[0],
                    targetSchema,
                    'Unknown_Pipeline',
                    sourceConnections[0]?.type,
                    targetConnection?.type,
                    promptInstructions,
                    preParsedForSheet  // Skip re-parsing when we already have correct mappings
                );

                // 3. Extract unique table pairs from this sheet (for metadata/row count tagging if needed)
                const { extractTablePairs } = await import('@/utils/tableSpecificETLGenerator');
                const tablePairs = extractTablePairs(
                    analyzed.mappings || sheet.data,
                    sourceSchemas[0], // Use first source for basic alignment
                    targetSchema
                );

                console.log(`Sheet ${sheet.name}: Found ${tablePairs.length} table pairs`, tablePairs);

                // Add mapping-specific tests (tagged with sheet name)
                if (analyzed.testCases) {
                    const taggedMappingTests = analyzed.testCases.map((tc: any) => ({
                        ...tc,
                        name: `[${sheet.name}] ${tc.name}`
                    }));
                    allTestCases.push(...taggedMappingTests);
                }

                analyzed.sourceTables?.forEach((t: string) => {
                    if (t) allSourceTables.add(t);
                });
                analyzed.targetTables?.forEach((t: string) => {
                    if (t) allTargetTables.add(t);
                });
            }

            // Consolidate analysis
            const consolidatedAnalysis = {
                ...analysis,
                sourceTables: Array.from(allSourceTables),
                targetTables: Array.from(allTargetTables),
                testCases: allTestCases
            }

            // Replace table placeholders
            const finalAnalysis = replaceTablePlaceholders(consolidatedAnalysis, sourceConnections[0], targetConnection);
            setAnalysis(finalAnalysis);

            // Navigate to test comparison step
            setCurrentStep(3);
            window.scrollTo({ top: 0, behavior: 'smooth' });

            toast({
                title: "Test Cases Ready!",
                description: `Generated ${allTestCases.length} test cases (mapping + ETL) from ${sheetsForGeneration.length} sheet(s)`
            });
        } catch (error) {
            console.error('Test generation error:', error);
            toast({
                title: "Error",
                description: "Failed to generate test cases",
                variant: "destructive"
            });
        }
    };

    const handleRegenerateTestCases = async () => {
        // Regeneration should rebuild tests, not only re-analyze mappings.
        await handleProceedToTests();
    };

    // --- CRUD Operations for Test Cases ---
    const handleAddTestCase = (newTestCase: TestCase) => {
        const newIndex = analysisRef.current?.testCases?.length ?? 0;
        setAnalysis((prev) => {
            if (!prev) return prev;
            return { ...prev, testCases: [...prev.testCases, newTestCase] };
        });
        if (isBatchRunningRef.current) handleQueueTestDuringRun(newIndex);
        toast({ title: "Test Case Added", description: `Added '${newTestCase.name}'` });
    };

    const handleUpdateTestCase = (index: number, updatedTestCase: TestCase) => {
        setAnalysis((prev) => {
            if (!prev) return prev;
            if (index < 0 || index >= prev.testCases.length) return prev;
            const updatedTestCases = [...prev.testCases];
            updatedTestCases[index] = updatedTestCase;
            return { ...prev, testCases: updatedTestCases };
        });
        toast({ title: "Test Case Updated", description: `Updated '${updatedTestCase.name}'` });
    };

    const handleDeleteTestCase = (index: number) => {
        setAnalysis((prev) => {
            if (!prev) return prev;
            if (index < 0 || index >= prev.testCases.length) return prev;
            const updatedTestCases = prev.testCases.filter((_, i) => i !== index);
            return { ...prev, testCases: updatedTestCases };
        });
        toast({ title: "Test Case Deleted", description: "Test case removed." });
    };

    const handleDeleteSelectedTestCases = (indices: number[]) => {
        if (!analysis || !Array.isArray(indices) || indices.length === 0) return;
        const indexSet = new Set(
            indices.filter((idx) => Number.isInteger(idx) && idx >= 0 && idx < analysis.testCases.length)
        );
        if (indexSet.size === 0) return;
        setAnalysis((prev) => {
            if (!prev) return prev;
            const updatedTestCases = prev.testCases.filter((_, i) => !indexSet.has(i));
            return { ...prev, testCases: updatedTestCases };
        });
        toast({
            title: "Test Cases Deleted",
            description: `${indexSet.size} test case(s) removed.`
        });
    };

    const formatExecutionErrorMessage = (error: unknown, context: 'poll' | 'execution' | 'submission'): string => {
        const raw = String(error || '').trim();
        const normalized = raw.toLowerCase();

        if (!raw) {
            return "Execution could not be completed. Please try again.";
        }

        // SQL Server column/object errors — surface the actual message, not a generic one
        if (
            normalized.includes('invalid column name') ||
            normalized.includes('invalid object name') ||
            normalized.includes('msg 207') ||
            normalized.includes('msg 208')
        ) {
            return `SQL Error: ${raw}`;
        }

        if (normalized.includes('network') || normalized.includes('failed to fetch')) {
            return "Unable to reach the execution service. Check network connectivity and agent availability, then retry.";
        }

        if (
            normalized.includes('syntax') ||
            normalized.includes('incorrect syntax') ||
            normalized.includes('sqlstate') ||
            normalized.includes('parse error') ||
            normalized.includes('ora-') ||
            normalized.includes('near')
        ) {
            return `SQL syntax error while executing the test query. Details: ${raw}`;
        }

        // 'not found' / 404 — check if there's a more specific SQL error buried in the message
        if (normalized.includes('not found') || normalized.includes('404')) {
            // If the raw error has SQL-specific details, surface them
            if (normalized.includes('sqlcmd') || normalized.includes('mssql') || normalized.includes('msg ')) {
                return `Agent SQL Error: ${raw}`;
            }
            return "Result is not available for this run. The job may have expired or the agent may be offline. Please run the test again.";
        }

        if (context === 'poll') {
            return `Unable to get execution status from the agent: ${raw}`;
        }

        if (context === 'submission') {
            return `Test request could not be submitted: ${raw}`;
        }

        return `Execution failed: ${raw}`;
    };

    const extractMismatchEntries = (result: any): any[] => {
        const direct = Array.isArray(result?.mismatches) ? result.mismatches : [];
        const sampleCamel = Array.isArray(result?.sampleMismatches) ? result.sampleMismatches : [];
        const sampleSnake = Array.isArray(result?.sample_mismatches) ? result.sample_mismatches : [];

        const columnMismatchRows = Array.isArray(result?.column_mismatches)
            ? result.column_mismatches.flatMap((cm: any) => {
                if (!Array.isArray(cm?.mismatches)) return [];
                return cm.mismatches.map((m: any) => ({
                    mismatchType: 'columnMismatch',
                    column: cm?.column || cm?.columnName || m?.column,
                    rowIndex: m?.rowIndex ?? m?.row_index,
                    key: m?.key,
                    sourceValue: m?.sourceValue ?? m?.source_value,
                    targetValue: m?.targetValue ?? m?.target_value
                }));
            })
            : [];

        const all = [...direct, ...sampleCamel, ...sampleSnake, ...columnMismatchRows].filter(Boolean);
        return all;
    };

    const normalizeMismatchEntry = (entry: any, index: number): any => {
        if (!entry || typeof entry !== 'object') {
            return {
                mismatchType: 'valueMismatch',
                rowIndex: index + 1,
                sourceRow: entry
            };
        }

        const type = String(entry.mismatchType || entry.type || '').toLowerCase();
        const sourceRow = entry.sourceRow ?? entry.source_row ?? (type.includes('source') ? (entry.row ?? entry.source) : undefined);
        const targetRow = entry.targetRow ?? entry.target_row ?? (type.includes('target') ? (entry.row ?? entry.target) : undefined);
        const rowIndex = entry.rowIndex ?? entry.row_index ?? entry.index ?? (index + 1);

        if (type === 'source_only' || type === 'sourceonly' || type === 'missingintarget') {
            return {
                mismatchType: 'sourceOnly',
                rowIndex,
                sourceRow
            };
        }

        if (type === 'target_only' || type === 'targetonly' || type === 'missinginsource') {
            return {
                mismatchType: 'targetOnly',
                rowIndex,
                targetRow
            };
        }

        if (type === 'columnmismatch' || entry.column || entry.sourceValue !== undefined || entry.targetValue !== undefined) {
            return {
                mismatchType: 'columnMismatch',
                rowIndex,
                column: entry.column ?? entry.columnName ?? 'unknown',
                key: entry.key,
                sourceValue: entry.sourceValue ?? entry.source_value,
                targetValue: entry.targetValue ?? entry.target_value
            };
        }

        return {
            mismatchType: entry.mismatchType || entry.type || 'valueMismatch',
            rowIndex,
            ...entry
        };
    };

    const buildActualResultMessage = (result: any, success: boolean): string => {
        const baseMessage = String(result?.message || '').trim();
        const summary = result?.summary || {};
        const sourceRows = Number(summary?.sourceRowCount ?? result?.source_count ?? 0);
        const targetRows = Number(summary?.targetRowCount ?? result?.target_count ?? 0);
        const matchedRows = Number(summary?.matchedRows ?? 0);
        const mismatchedRows = Number(summary?.mismatchedRows ?? 0);
        const sourceOnlyRows = Number(summary?.sourceOnlyRows ?? 0);
        const targetOnlyRows = Number(summary?.targetOnlyRows ?? 0);
        const mismatches = extractMismatchEntries(result);
        const errorText = String(result?.error || '').trim();

        if (mismatchedRows > 0 || sourceOnlyRows > 0 || targetOnlyRows > 0 || mismatches.length > 0) {
            const parts = [
                `source=${sourceRows}`,
                `target=${targetRows}`,
                `matched=${matchedRows}`,
                `mismatched=${mismatchedRows}`,
            ];
            if (sourceOnlyRows > 0) parts.push(`sourceOnly=${sourceOnlyRows}`);
            if (targetOnlyRows > 0) parts.push(`targetOnly=${targetOnlyRows}`);
            return `Comparison failed: ${parts.join(', ')}.`;
        }

        if (mismatches.length > 0) {
            const firstMismatch = mismatches[0];
            const keys = firstMismatch && typeof firstMismatch === 'object'
                ? Object.keys(firstMismatch).slice(0, 3).join(', ')
                : '';
            return `Mismatch found: ${mismatches.length} row(s) differ between source and target.${keys ? ` Fields: ${keys}.` : ''}`;
        }

        if (errorText) {
            return formatExecutionErrorMessage(errorText, 'execution');
        }

        if (baseMessage) return baseMessage;
        return success
            ? "Test passed successfully."
            : "Execution completed but no detailed result was returned by the agent.";
    };

    const evaluateComparisonSuccess = (result: any): boolean => {
        const summary = result?.summary || {};
        const statusText = String(
            summary?.comparisonStatus || summary?.status || result?.status || ''
        ).toLowerCase();

        const sourceRows = Number(summary?.sourceRowCount ?? result?.source_count ?? 0);
        const targetRows = Number(summary?.targetRowCount ?? result?.target_count ?? 0);
        const mismatchedRows = Number(summary?.mismatchedRows ?? 0);
        const sourceOnlyRows = Number(summary?.sourceOnlyRows ?? 0);
        const targetOnlyRows = Number(summary?.targetOnlyRows ?? 0);
        const mismatches = extractMismatchEntries(result);

        const hasDiff = mismatchedRows > 0 || sourceOnlyRows > 0 || targetOnlyRows > 0 || mismatches.length > 0;

        if (statusText.includes('fail') || statusText.includes('error') || statusText.includes('mismatch')) {
            return false;
        }

        if (hasDiff) {
            return false;
        }

        if (statusText.includes('pass') || statusText.includes('success') || statusText.includes('match')) {
            return true;
        }

        // Fallback when status text is missing: only pass if row counts align.
        return sourceRows === targetRows;
    };

    const buildMismatchReportRows = (result: any): any[] => {
        const explicitMismatches = extractMismatchEntries(result).map((entry, idx) => normalizeMismatchEntry(entry, idx));
        if (explicitMismatches.length > 0) return explicitMismatches;

        const sourceRows = Array.isArray(result?.source_data) ? result.source_data : [];
        const targetRows = Array.isArray(result?.target_data) ? result.target_data : [];
        const isObjectLike = (v: any) => v !== null && typeof v === 'object' && !Array.isArray(v);
        const isSameValue = (a: any, b: any) => {
            if (a === b) return true;
            if ((a === null || a === undefined) && (b === null || b === undefined)) return true;
            return JSON.stringify(a) === JSON.stringify(b);
        };

        if (sourceRows.length > 0 || targetRows.length > 0) {
            const maxLen = Math.max(sourceRows.length, targetRows.length);
            const derived: any[] = [];

            for (let i = 0; i < maxLen; i++) {
                const src = sourceRows[i];
                const tgt = targetRows[i];

                if (src !== undefined && tgt !== undefined) {
                    if (!isSameValue(src, tgt)) {
                        const mismatchColumns: Array<{ column: string; sourceValue: any; targetValue: any }> = [];
                        if (isObjectLike(src) || isObjectLike(tgt)) {
                            const srcObj = isObjectLike(src) ? src : { value: src };
                            const tgtObj = isObjectLike(tgt) ? tgt : { value: tgt };
                            const keys = new Set<string>([...Object.keys(srcObj), ...Object.keys(tgtObj)]);
                            keys.forEach((key) => {
                                const sourceValue = (srcObj as any)[key];
                                const targetValue = (tgtObj as any)[key];
                                if (!isSameValue(sourceValue, targetValue)) {
                                    mismatchColumns.push({ column: key, sourceValue, targetValue });
                                }
                            });
                        } else {
                            mismatchColumns.push({ column: 'value', sourceValue: src, targetValue: tgt });
                        }

                        derived.push({
                            mismatchType: 'valueMismatch',
                            rowIndex: i + 1,
                            mismatchColumnCount: mismatchColumns.length,
                            mismatchColumns,
                            sourceRow: src,
                            targetRow: tgt
                        });
                    }
                } else if (src !== undefined) {
                    derived.push({
                        mismatchType: 'sourceOnly',
                        rowIndex: i + 1,
                        mismatchColumnCount: isObjectLike(src) ? Object.keys(src).length : 1,
                        sourceRow: src
                    });
                } else if (tgt !== undefined) {
                    derived.push({
                        mismatchType: 'targetOnly',
                        rowIndex: i + 1,
                        mismatchColumnCount: isObjectLike(tgt) ? Object.keys(tgt).length : 1,
                        targetRow: tgt
                    });
                }
            }

            if (derived.length > 0) return derived;
        }

        const summary = result?.summary || {};
        const mismatchedRows = Number(summary?.mismatchedRows ?? 0);
        const sourceOnlyRows = Number(summary?.sourceOnlyRows ?? 0);
        const targetOnlyRows = Number(summary?.targetOnlyRows ?? 0);

        if (mismatchedRows > 0 || sourceOnlyRows > 0 || targetOnlyRows > 0) {
            return [{
                mismatchType: 'summaryOnly',
                mismatchedRows,
                sourceOnlyRows,
                targetOnlyRows,
                note: 'Detailed mismatch rows were not returned by the execution service.'
            }];
        }

        return [];
    };

    // --- Test Execution Logic (Agent-Based) ---
    const handleRunTestCase = async (
        testCase: TestCase,
        context?: { sequenceLabel?: string; suppressToast?: boolean }
    ): Promise<'pass' | 'fail' | 'skipped'> => {
        const hasSource = multiSourceMode ? sourceConnections.some(c => c.id) : sourceConnections[0]?.id;
        const shouldShowPerTestToast = !context?.suppressToast;
        const notifyPerTest = (payload: { title: string; description: string; variant?: "default" | "destructive" }) => {
            if (!shouldShowPerTestToast) return;
            // Guard against duplicate terminal notifications caused by repeated poll terminal callbacks.
            const now = Date.now();
            const dedupeWindowMs = 5000;
            const cache = perTestToastDedupRef.current;
            for (const [key, ts] of cache.entries()) {
                if (now - ts > dedupeWindowMs) cache.delete(key);
            }
            const key = `${testCase.name}|${payload.title}|${payload.variant || 'default'}|${payload.description}`;
            const lastSeen = cache.get(key);
            if (typeof lastSeen === 'number' && now - lastSeen <= dedupeWindowMs) return;
            cache.set(key, now);
            toast(payload);
        };

        if (!selectedAgentId) {
            toast({ title: "Agent Required", description: "Please select an active ETL Agent in Step 1.", variant: "destructive" });
            return 'skipped';
        }

        if (!hasSource || !targetConnection) {
            toast({ title: "Connections Missing", description: "Please select both Source and Target connections.", variant: "destructive" });
            return 'skipped';
        }

        const hasUnresolvedTableName = (sql: string): boolean => {
            if (!sql) return false;
            return /\bSourceTable\b/i.test(sql) || /\bTargetTable\b/i.test(sql);
        };

        if (hasUnresolvedTableName(testCase.sourceSQL) || hasUnresolvedTableName(testCase.targetSQL)) {
            const message = "Detected unresolved table placeholder (SourceTable/TargetTable). Regenerate tests after validating mapping sheet table names.";
            toast({ title: "Invalid Test SQL", description: message, variant: "destructive" });
            return 'skipped';
        }

        const updateStatus = (status: TestCase['lastRunResult']) => {
            setAnalysis(prev => {
                if (!prev) return prev;
                const updatedCases = prev.testCases.map(tc =>
                    tc.name === testCase.name ? { ...tc, lastRunResult: status } : tc
                );
                return { ...prev, testCases: updatedCases };
            });
        };

        updateStatus({ status: 'running', message: 'Queued for Agent...', timestamp: new Date() });
        setCurrentExecutingTestName(testCase.name);
        if (shouldShowPerTestToast) {
            toast({ title: "Job Queued", description: `Agent '${agents.find(a => a.id === selectedAgentId)?.agent_name || 'Unknown'}' requested.` });
        }

        try {
            // 1. Submit Job to Agent
            const config = {
                projectId: projectId || undefined,
                agentId: selectedAgentId,
                sourceConnectionId: multiSourceMode ? sourceConnections[0].id : sourceConnections[0].id, // TODO: Handle multi-source properly in agent
                targetConnectionId: targetConnection.id,
                sourceConnection: multiSourceMode ? sourceConnections[0] : sourceConnections[0],
                targetConnection: targetConnection,
                sourceQuery: testCase.sourceSQL,
                targetQuery: testCase.targetSQL,
                keyColumns: [],
                testCase,
            };

            const { data: job, error: jobError } = await compareApi.run(config);

            if (jobError || !job) {
                throw new Error(jobError || "Failed to submit job to agent");
            }

            console.log("Job submitted:", job);
            updateStatus({
                status: 'running',
                message: context?.sequenceLabel ? `Agent Processing (${context.sequenceLabel})...` : 'Agent Processing...',
                timestamp: new Date()
            });

            const jobId = job?.jobId || job?.job_id || job?.id;
            if (!jobId) {
                throw new Error("Failed to resolve job ID from comparison run response.");
            }

            return await new Promise<'pass' | 'fail' | 'skipped'>((resolve) => {
                let pollTimeoutId: ReturnType<typeof window.setTimeout> | null = null;
                let timeoutId: ReturnType<typeof setTimeout> | null = null;
                let resolved = false;
                let notFoundPollErrors = 0;
                let transientPollErrors = 0;
                let terminalStateProcessing = false;
                let pollInFlight = false;

                const clearTracking = () => {
                    if (pollTimeoutId) {
                        window.clearTimeout(pollTimeoutId);
                        pollTimeoutId = null;
                    }
                    if (timeoutId) {
                        clearTimeout(timeoutId);
                        timeoutId = null;
                    }
                };

                const scheduleNextPoll = (delayMs = 2000) => {
                    if (resolved) return;
                    pollTimeoutId = window.setTimeout(() => {
                        void runPoll();
                    }, delayMs);
                };

                const cancelActiveExecution = () => {
                    if (resolved) return;
                    resolved = true;
                    clearTracking();
                    updateStatus({
                        status: 'fail',
                        message: 'Execution stopped by user.',
                        timestamp: new Date()
                    });
                    setCurrentExecutingTestName((prev) => (prev === testCase.name ? null : prev));
                    if (activeExecutionCancelRef.current === cancelActiveExecution) {
                        activeExecutionCancelRef.current = null;
                    }
                    resolve('skipped');
                };

                activeExecutionCancelRef.current = cancelActiveExecution;

                const finalize = (status: 'pass' | 'fail', message: string, details?: any) => {
                    if (resolved) return;
                    resolved = true;
                    clearTracking();
                    updateStatus({
                        status,
                        message,
                        timestamp: new Date(),
                        details
                    });
                    setCurrentExecutingTestName((prev) => (prev === testCase.name ? null : prev));
                    if (activeExecutionCancelRef.current === cancelActiveExecution) {
                        activeExecutionCancelRef.current = null;
                    }
                    resolve(status);
                };

                const runPoll = async () => {
                    if (resolved || terminalStateProcessing || pollInFlight) return;
                    pollInFlight = true;

                    try {
                        const { data: statusData, error: statusError } = await compareApi.status(jobId);

                        if (statusError) {
                            const rawErr = String(statusError || '');
                            if (rawErr.toLowerCase().includes('not found') && notFoundPollErrors < 3) {
                                notFoundPollErrors += 1;
                                scheduleNextPoll();
                                return;
                            }
                            if (transientPollErrors < 5) {
                                transientPollErrors += 1;
                                scheduleNextPoll(3000);
                                return;
                            }

                            // Edge Function polling can briefly fail while the agent is still
                            // submitting its terminal result. Query the queue table directly so
                            // Actual Result shows the agent/SQL error instead of a generic
                            // network message whenever possible.
                            const { data: fallbackJob } = await supabase
                                .from('agent_job_queue' as any)
                                .select('status, result, error_log')
                                .eq('id', jobId)
                                .maybeSingle();

                            if (fallbackJob?.status === 'failed' || fallbackJob?.status === 'error') {
                                finalize(
                                    'fail',
                                    fallbackJob.error_log
                                        ? formatExecutionErrorMessage(fallbackJob.error_log, 'execution')
                                        : "Execution failed before comparison result was produced."
                                );
                                return;
                            }

                            if (fallbackJob?.status === 'completed') {
                                const result = fallbackJob.result || {};
                                const success = evaluateComparisonSuccess(result);
                                finalize(success ? 'pass' : 'fail', buildActualResultMessage(result, success), {
                                    sourceCount: result?.summary?.sourceRowCount ?? result?.source_count ?? 0,
                                    targetCount: result?.summary?.targetRowCount ?? result?.target_count ?? 0,
                                    sourceData: result.source_data || [],
                                    targetData: result.target_data || [],
                                    comparisonData: result.comparison_rows || [],
                                    compareColumns: result.compareColumns || [],
                                    comparisonType: testCase.category || 'general',
                                    mismatchData: buildMismatchReportRows(result)
                                });
                                return;
                            }

                            finalize('fail', formatExecutionErrorMessage(statusError, 'poll'));
                            return;
                        }

                        transientPollErrors = 0;

                        const jobStatus = statusData?.status;
                        const resultPayload = statusData?.result || {};
                        const errorText = statusData?.error_log || statusData?.error || resultPayload?.error;
                        const summary = resultPayload?.summary || {};
                        const mismatches = Array.isArray(resultPayload?.mismatches)
                            ? resultPayload.mismatches
                            : [];
                        console.log("Job Status:", jobStatus);

                        if (jobStatus === 'completed') {
                            terminalStateProcessing = true;
                            // Always fetch final result payload to prefer full mismatch rows over sampled status payload.
                            let result = resultPayload || {};
                            const { data: resultData } = await compareApi.results(jobId);
                            result = resultData?.result || resultPayload || {};

                            const success = evaluateComparisonSuccess(result);
                            const message = buildActualResultMessage(result, success);

                            const mismatchReportRows = buildMismatchReportRows(result);
                            const details = {
                                sourceCount: result?.summary?.sourceRowCount ?? result?.source_count ?? 0,
                                targetCount: result?.summary?.targetRowCount ?? result?.target_count ?? 0,
                                sourceData: result.source_data || [],
                                targetData: result.target_data || [],
                                comparisonData: result.comparison_rows || [],
                                compareColumns: result.compareColumns || [],
                                comparisonType: testCase.category || 'general',
                                mismatchData: mismatchReportRows
                            };

                            finalize(success ? 'pass' : 'fail', message, details);
                            notifyPerTest({
                                title: "Execution Completed",
                                description: `${success ? 'Pass' : 'Fail'}: ${message}`,
                                variant: success ? "default" : "destructive"
                            });
                            return;
                        }

                        if (jobStatus === 'failed' || jobStatus === 'error') {
                            terminalStateProcessing = true;
                            // Some ETL mismatches are persisted as failed with valid comparison summary.
                            if (summary && (typeof summary?.mismatchedRows === 'number' || mismatches.length > 0)) {
                                // Try to fetch full result for failed comparisons as well.
                                const { data: failedResultData } = await compareApi.results(jobId);
                                const failedResult = failedResultData?.result || resultPayload || {};
                                const fullMismatches = buildMismatchReportRows(failedResult);
                                const message = buildActualResultMessage(failedResult, false);
                                finalize('fail', message, {
                                    sourceCount: failedResult?.summary?.sourceRowCount ?? summary?.sourceRowCount ?? 0,
                                    targetCount: failedResult?.summary?.targetRowCount ?? summary?.targetRowCount ?? 0,
                                    sourceData: failedResult?.source_data || resultPayload?.source_data || [],
                                    targetData: failedResult?.target_data || resultPayload?.target_data || [],
                                    comparisonData: failedResult?.comparison_rows || resultPayload?.comparison_rows || [],
                                    compareColumns: failedResult?.compareColumns || resultPayload?.compareColumns || [],
                                    comparisonType: testCase.category || 'general',
                                    mismatchData: fullMismatches
                                });
                                notifyPerTest({ title: "Mismatch Detected", description: message, variant: "destructive" });
                                return;
                            }

                            const errorMsg = errorText
                                ? formatExecutionErrorMessage(errorText, 'execution')
                                : "Execution failed before comparison result was produced.";
                            finalize('fail', errorMsg);
                            notifyPerTest({ title: "Execution Failed", description: errorMsg, variant: "destructive" });
                            return;
                        }

                        scheduleNextPoll();
                    } finally {
                        pollInFlight = false;
                    }
                };

                // Timeout after 5 minutes. SQL Server comparisons can take longer
                // than simple API calls, especially through the self-hosted agent.
                timeoutId = setTimeout(async () => {
                    if (resolved) return;

                    const { data: timeoutJob } = await supabase
                        .from('agent_job_queue' as any)
                        .select('status, result, error_log')
                        .eq('id', jobId)
                        .maybeSingle();

                    if (timeoutJob?.status === 'completed') {
                        const result = timeoutJob.result || {};
                        const success = evaluateComparisonSuccess(result);
                        finalize(success ? 'pass' : 'fail', buildActualResultMessage(result, success), {
                            sourceCount: result?.summary?.sourceRowCount ?? result?.source_count ?? 0,
                            targetCount: result?.summary?.targetRowCount ?? result?.target_count ?? 0,
                            sourceData: result.source_data || [],
                            targetData: result.target_data || [],
                            comparisonData: result.comparison_rows || [],
                            compareColumns: result.compareColumns || [],
                            comparisonType: testCase.category || 'general',
                            mismatchData: buildMismatchReportRows(result)
                        });
                        return;
                    }

                    if (timeoutJob?.status === 'failed' || timeoutJob?.status === 'error') {
                        finalize(
                            'fail',
                            timeoutJob.error_log
                                ? formatExecutionErrorMessage(timeoutJob.error_log, 'execution')
                                : "Execution failed before comparison result was produced."
                        );
                        return;
                    }

                    const stillRunning = timeoutJob?.status === 'running' || timeoutJob?.status === 'pending';
                    finalize(
                        'fail',
                        stillRunning
                            ? "Execution is still running after 5 minutes. Check the self-hosted agent console or reduce the query size, then retry."
                            : "Execution timed out while waiting for agent response. Please retry."
                    );
                }, 300000);

                void runPoll();
            });

        } catch (error) {
            const errMsg = error instanceof Error ? error.message : 'Unknown execution error';
            updateStatus({
                status: 'fail',
                message: formatExecutionErrorMessage(errMsg, 'submission'),
                timestamp: new Date()
            });
            setCurrentExecutingTestName((prev) => (prev === testCase.name ? null : prev));
            activeExecutionCancelRef.current = null;
            toast({ title: "Submission Failed", description: formatExecutionErrorMessage(errMsg, 'submission'), variant: "destructive" });
            return 'fail';
        }
    };

    const handleStopExecution = () => {
        if (!isRunningAllTests) return;
        stopExecutionRequestedRef.current = true;
        const cancel = activeExecutionCancelRef.current;
        if (cancel) cancel();
        setIsRunningAllTests(false);
        setCurrentExecutingTestName(null);
        toast({
            title: "Execution Stop Requested",
            description: "Current execution will stop and remaining test cases will be skipped."
        });
    };

    const handleQueueTestDuringRun = (index: number) => {
        if (!isBatchRunningRef.current) return;
        if (index < 0) return;
        batchExcludedIndicesRef.current.delete(index);
        if (batchProcessedIndicesRef.current.has(index)) return;
        if (batchQueuedIndicesRef.current.includes(index)) return;
        batchQueuedIndicesRef.current.push(index);
    };

    const handleQueueTestsDuringRun = (indices: number[]) => {
        if (!Array.isArray(indices)) return;
        indices.forEach((idx) => handleQueueTestDuringRun(idx));
    };

    const handleUnqueueTestsDuringRun = (indices: number[]) => {
        if (!isBatchRunningRef.current || !Array.isArray(indices)) return;
        indices
            .filter((idx) => Number.isInteger(idx) && idx >= 0)
            .forEach((idx) => batchExcludedIndicesRef.current.add(idx));
    };

    const handleRunAllTests = async (orderedIndices?: number[]) => {
        const hasSource = multiSourceMode ? sourceConnections.some(c => c.id) : sourceConnections[0]?.id;
        if (!analysis || !hasSource || !targetConnection) {
            toast({ title: "Cannot Run All", description: "Ensure analysis exists and connections are selected.", variant: "destructive" });
            return;
        }

        if (isRunningAllTests) return;
        stopExecutionRequestedRef.current = false;
        setIsRunningAllTests(true);
        isBatchRunningRef.current = true;
        toast({ title: "Batch Execution Started", description: "Running all test cases sequentially..." });
        let completedCount = 0;
        let interrupted = false;
        try {
            const initialIndices = Array.isArray(orderedIndices) && orderedIndices.length > 0
                ? orderedIndices.filter((i) => Number.isInteger(i) && i >= 0)
                : (analysisRef.current?.testCases || []).map((_, i) => i);
            batchQueuedIndicesRef.current = Array.from(new Set(initialIndices));
            batchProcessedIndicesRef.current = new Set();
            batchExcludedIndicesRef.current = new Set();

            let pointer = 0;
            while (pointer < batchQueuedIndicesRef.current.length) {
                if (stopExecutionRequestedRef.current) {
                    interrupted = true;
                    break;
                }
                const queuedIndex = batchQueuedIndicesRef.current[pointer];
                pointer += 1;
                if (batchProcessedIndicesRef.current.has(queuedIndex)) continue;
                if (batchExcludedIndicesRef.current.has(queuedIndex)) continue;

                const tc = analysisRef.current?.testCases?.[queuedIndex];
                if (!tc) {
                    batchProcessedIndicesRef.current.add(queuedIndex);
                    continue;
                }

                batchProcessedIndicesRef.current.add(queuedIndex);
                setCurrentExecutingTestName(tc.name);
                const result = await handleRunTestCase(tc, {
                    sequenceLabel: `${completedCount + 1}/${batchQueuedIndicesRef.current.length}`,
                    suppressToast: true
                });
                if (stopExecutionRequestedRef.current) {
                    interrupted = true;
                    break;
                }
                if (result !== 'skipped') completedCount += 1;
                // Small delay to prevent overwhelming the server/browser
                if (stopExecutionRequestedRef.current) {
                    interrupted = true;
                    break;
                }
                await new Promise(r => setTimeout(r, 100));
            }
        } finally {
            activeExecutionCancelRef.current = null;
            stopExecutionRequestedRef.current = false;
            isBatchRunningRef.current = false;
            batchQueuedIndicesRef.current = [];
            batchProcessedIndicesRef.current = new Set();
            batchExcludedIndicesRef.current = new Set();
            setCurrentExecutingTestName(null);
            setIsRunningAllTests(false);
            toast({
                title: interrupted ? "Batch Stopped" : "Execution Completed",
                description: interrupted
                    ? `${completedCount} test case(s) finished before stop request.`
                    : `${completedCount} test case(s) finished. You can now save results.`
            });
        }
    };

    const handleQueryCreate = (testCase: TestCase) => {
        const formatForDialog = (sql: string, side: 'source' | 'target') => {
            const conn = side === 'source' ? sourceConnections[0] : targetConnection;
            const connLabel = conn?.name || 'Not selected';
            const connType = (conn?.type || 'unknown').toUpperCase();
            const trimmed = String(sql || '').trim().replace(/[ \t]+\n/g, '\n');
            const withSemicolon = /;\s*$/.test(trimmed) ? trimmed : `${trimmed};`;
            return `-- ${side.toUpperCase()} CONNECTION: ${connLabel} (${connType})\n${withSemicolon}`;
        };

        setSelectedSQL({
            source: formatForDialog(testCase.sourceSQL, 'source'),
            target: formatForDialog(testCase.targetSQL, 'target'),
            name: testCase.name
        });
        setShowSQLDialog(true);
    };



    const handleValidateStructure = async (directMappings?: any[]) => {
        const mappingsToValidate = Array.isArray(directMappings)
            ? directMappings
            : Array.isArray(analysis?.mappings)
                ? analysis.mappings
                : [];

        if (mappingsToValidate.length === 0) {
            toast({ title: "No Mappings Found", description: "Cannot validate structure without mapping details.", variant: "destructive" });
            return;
        }

        const hasSource = multiSourceMode ? sourceConnections.some(c => c.id) : sourceConnections[0]?.id;
        if (!hasSource || !targetConnection) {
            toast({
                title: "Connections Required",
                description: "Please select both Source and Target connections to validate structure.",
                variant: "destructive"
            });
            return;
        }

        if (!selectedAgentId) {
            toast({ title: "Agent Required", description: "Please select an active ETL Agent in Step 1 to run metadata validation.", variant: "destructive" });
            return;
        }

        // Log mapping details for debugging
        console.log('🔍 Starting Structure Validation...');
        console.log(`📊 Total mappings to validate: ${mappingsToValidate.length}`);
        console.log('Sample mappings:', mappingsToValidate.slice(0, 3));

        setIsValidating(true);
        setValidationResults(null);

        try {
            const results = {
                sourceErrors: [] as string[],
                targetErrors: [] as string[],
                warnings: [] as string[],
                matches: [] as string[],
                stats: { tablesFound: 0, columnsFound: 0, totalTables: 0, totalColumns: 0 },
                success: true
            };

            let sourceSchemas: any[] = [];
            let targetSchema: any = null;

            const activeSources = multiSourceMode
                ? sourceConnections.filter(c => c.id)
                : [sourceConnections[0]].filter(c => c?.id);

            for (const src of activeSources) {
                try {
                    const { fetchDatabaseSchema } = await import('@/utils/schemaFetcher');
                    const schema = await fetchDatabaseSchema(src.id, selectedAgentId || undefined);
                    sourceSchemas.push(schema);
                    console.log(`✅ Fetched schema for ${src.name}:`, schema?.totalTables || 0, 'tables');
                } catch (e) {
                    const errorMsg = `Failed to fetch metadata for source: ${src.name}`;
                    results.warnings.push(errorMsg);
                    console.warn('❌', errorMsg, e);
                }
            }

            if (sourceSchemas.length === 0 && (multiSourceMode ? sourceConnections.some(c => c.id) : sourceConnections[0]?.id)) {
                results.warnings.push('Selected source connection(s) could not retrieve metadata');
            }

            if (targetConnection) {
                try {
                    const { fetchDatabaseSchema } = await import('@/utils/schemaFetcher');
                    targetSchema = await fetchDatabaseSchema(targetConnection.id, selectedAgentId || undefined);
                    console.log('✅ Fetched target schema:', targetSchema?.totalTables || 0, 'tables');
                } catch (e) {
                    const errorMsg = `Failed to fetch metadata for target: ${targetConnection.name}`;
                    results.warnings.push(errorMsg);
                    console.warn('❌', errorMsg, e);
                }
            } else {
                results.warnings.push('No target connection selected - skipping target validation');
            }

            const findTable = (schemaData: any, tableName: string) => {
                if (!schemaData || !Array.isArray(schemaData.tables)) return null;
                const cleanName = tableName.replace(/[\[\]]/g, '');
                const parts = cleanName.split('.');
                const tableBase = parts.length > 1 ? parts[1] : parts[0];
                const schemaBase = parts.length > 1 ? parts[0] : null;

                for (const table of (schemaData.tables as any[])) {
                    const schemaName = (table.schema || '').toLowerCase();
                    const tableNameLower = (table.tableName || table.name || '').toLowerCase();
                    if (tableNameLower === tableBase.toLowerCase()) {
                        if (!schemaBase || schemaName === schemaBase.toLowerCase()) {
                            return {
                                name: table.tableName || table.name,
                                columns: table.columns || [],
                            };
                        }
                    }
                }
                return null;
            };

            const processedSourceTables = new Set<string>();
            const processedTargetTables = new Set<string>();
            const sourceMatches = new Map<string, { total: Set<string>, found: Set<string>, tableFound: boolean }>();
            const targetMatches = new Map<string, { total: Set<string>, found: Set<string>, tableFound: boolean }>();

            const getTableStats = (map: Map<string, { total: Set<string>, found: Set<string>, tableFound: boolean }>, tableName: string) => {
                if (!map.has(tableName)) map.set(tableName, { total: new Set<string>(), found: new Set<string>(), tableFound: false });
                return map.get(tableName)!;
            };

            let skippedMappings = { source: 0, target: 0 };

            for (const mapping of mappingsToValidate) {
                // === SOURCE VALIDATION ===
                const hasValidSourceData = mapping.sourceTable &&
                    mapping.sourceTable !== 'Source' &&
                    mapping.sourceTable !== '-.-' &&
                    !mapping.sourceTable.includes('-.-') &&
                    !mapping.sourceTable.includes('[Auto-detected') &&
                    !mapping.sourceTable.includes('[Configure') &&
                    mapping.sourceColumn &&
                    mapping.sourceColumn !== 'Unknown';

                if (sourceSchemas.length > 0 && hasValidSourceData) {
                    const tableKey = mapping.sourceTable;
                    const stats = getTableStats(sourceMatches, tableKey);
                    stats.total.add(mapping.sourceColumn);

                    // Try to find in any of the available source metadata
                    let tableFound = false;
                    for (const schemaData of sourceSchemas) {
                        const table = findTable(schemaData, tableKey);
                        if (table) {
                            tableFound = true;
                            stats.tableFound = true;
                            const col = table.columns.find((c: any) => c.name.toLowerCase() === mapping.sourceColumn.toLowerCase());
                            if (col) stats.found.add(mapping.sourceColumn);
                            break;
                        }
                    }

                    if (!tableFound) {
                        if (!processedSourceTables.has(tableKey)) {
                            results.sourceErrors.push(`Source Table '${tableKey}' not found in any connected databases.`);
                            processedSourceTables.add(tableKey);
                        }
                    } else {
                        // Check if mapped but column missing in the found table
                        const isFound = Array.from(stats.found).some(c => c.toLowerCase() === mapping.sourceColumn.toLowerCase());
                        if (!isFound) {
                            results.sourceErrors.push(`Column '${mapping.sourceColumn}' not found in '${tableKey}'.`);
                        }
                    }
                } else if (sourceSchemas.length > 0) {
                    skippedMappings.source++;
                }

                // === TARGET VALIDATION ===
                const hasValidTargetData = mapping.targetTable &&
                    mapping.targetTable !== 'Target' &&
                    mapping.targetTable !== '-.-' &&
                    !mapping.targetTable.includes('-.-') &&
                    !mapping.targetTable.includes('[Auto-detected') &&
                    !mapping.targetTable.includes('[Configure') &&
                    mapping.targetColumn &&
                    mapping.targetColumn !== 'Unknown';

                if (targetSchema && hasValidTargetData) {
                    const tableKey = mapping.targetTable;
                    const stats = getTableStats(targetMatches, tableKey);
                    stats.total.add(mapping.targetColumn);
                    const table = findTable(targetSchema, tableKey);

                    if (!table) {
                        if (!processedTargetTables.has(tableKey)) {
                            results.targetErrors.push(`Target Table '${tableKey}' not found.`);
                            processedTargetTables.add(tableKey);
                        }
                    } else {
                        stats.tableFound = true;
                        const col = table.columns.find((c: any) => c.name.toLowerCase() === mapping.targetColumn.toLowerCase());
                        if (!col) results.targetErrors.push(`Column '${mapping.targetColumn}' not found in '${table.name}'.`);
                        else stats.found.add(mapping.targetColumn);
                    }
                } else if (targetSchema) {
                    skippedMappings.target++;
                }
            }

            // Add warning if mappings were skipped
            if (skippedMappings.source > 0 || skippedMappings.target > 0) {
                results.warnings.push(`⚠️ Skipped ${skippedMappings.source} source and ${skippedMappings.target} target mappings due to missing/generic table names. Check if your mapping file has proper "Source Table" and "Target Table" columns.`);
            }

            let totalTbl = 0, foundTbl = 0, totalCol = 0, foundCol = 0;
            sourceMatches.forEach((stats, tableName) => {
                totalTbl++; totalCol += stats.total.size;
                if (stats.tableFound) { foundTbl++; foundCol += stats.found.size; results.matches.push(`source:Table '${tableName}': Verified ${stats.found.size}/${stats.total.size} cols`); }
            });
            targetMatches.forEach((stats, tableName) => {
                totalTbl++; totalCol += stats.total.size;
                if (stats.tableFound) { foundTbl++; foundCol += stats.found.size; results.matches.push(`target:Table '${tableName}': Verified ${stats.found.size}/${stats.total.size} cols`); }
            });

            results.stats = { tablesFound: foundTbl, columnsFound: foundCol, totalTables: totalTbl, totalColumns: totalCol };
            results.success = results.sourceErrors.length === 0 && results.targetErrors.length === 0;

            console.log('📊 Validation Results:', results.stats);
            console.log('✅ Matches:', results.matches.length);
            console.log('❌ Errors:', results.sourceErrors.length + results.targetErrors.length);
            console.log('⚠️ Warnings:', results.warnings);

            setValidationResults(results);
            setShowValidationDialog(true);

            // Show toast with results
            if (results.stats.totalTables === 0 && results.stats.totalColumns === 0) {
                toast({
                    title: "No Tables to Validate",
                    description: "Your mapping file may not have table names, or they are using generic placeholders. Please check your file structure.",
                    variant: "destructive"
                });
            } else if (results.success) {
                toast({
                    title: "Validation Successful",
                    description: `${foundTbl}/${totalTbl} tables and ${foundCol}/${totalCol} columns verified.`
                });
            } else {
                toast({
                    title: "Validation Issues Found",
                    description: `Found ${results.sourceErrors.length + results.targetErrors.length} issues. Review the details.`,
                    variant: "destructive"
                });
            }
        } catch (error) {
            console.error('❌ Validation error:', error);
            toast({ title: "Validation Failed", description: error instanceof Error ? error.message : "Unknown error occurred.", variant: "destructive" });
        } finally {
            setIsValidating(false);
        }
    };

    // --- SQL Generation & Export Helpers ---

    const downloadString = (content: string, filename: string) => {
        const element = document.createElement("a");
        const file = new Blob([content], { type: 'text/plain' });
        element.href = URL.createObjectURL(file);
        element.download = filename;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    };

    const handleCopySQL = (sql: string, type: string) => {
        navigator.clipboard.writeText(sql);
        toast({ title: "Copied!", description: `${type} SQL copied to clipboard` });
    };

    // 1. Test Cases SQL
    const getTestCasesSQL = () => {
        if (!analysis || !analysis.testCases) return '';
        return analysis.testCases.map(tc =>
            `-- Test Case: ${tc.name}\n-- ${tc.description}\n\n-- SOURCE SQL:\n${tc.sourceSQL};\n\n-- TARGET SQL:\n${tc.targetSQL};\n\n`
        ).join('-- --------------------------------------------------\n\n');
    };

    const exportAllSQL = () => {
        const sql = getTestCasesSQL();
        if (!sql) {
            toast({ title: "No Data", description: "No test cases to export.", variant: "destructive" });
            return;
        }
        downloadString(sql, 'test_cases.sql');
        toast({ title: "Exported", description: "Test cases exported to SQL file." });
    };

    const handleExportResults = (format: 'sql' | 'csv' | 'excel') => {
        if (!analysis || !analysis.testCases || analysis.testCases.length === 0) {
            toast({ title: "No Data", description: "No test cases to export.", variant: "destructive" });
            return;
        }

        if (format === 'sql') {
            exportAllSQL();
            return;
        }

        // Prepare data for CSV/Excel
        const exportData = analysis.testCases.map((tc, index) => ({
            ID: index + 1,
            Name: tc.name, // Ensure name exists
            Description: tc.description || '',
            Status: tc.lastRunResult?.status || 'Not executed',
            'Execution Message': tc.lastRunResult?.message || '',
            'Source SQL': tc.sourceSQL,
            'Target SQL': tc.targetSQL,
            'Executed At': tc.lastRunResult?.timestamp ? new Date(tc.lastRunResult.timestamp).toLocaleString() : ''
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(exportData);
        XLSX.utils.book_append_sheet(wb, ws, "Test Results");

        if (format === 'csv') {
            XLSX.writeFile(wb, `test_results.csv`);
            toast({ title: "Exported", description: "Test cases exported to CSV." });
        } else {
            XLSX.writeFile(wb, `test_results.xlsx`);
            toast({ title: "Exported", description: "Test cases exported to Excel." });
        }
    };

    const handleCopyTestCasesSQL = () => {
        const sql = getTestCasesSQL();
        if (!sql) {
            toast({ title: "No Data", description: "No test cases to copy.", variant: "destructive" });
            return;
        }
        handleCopySQL(sql, 'Test Cases');
    };

    // 2. Validation SQL
    const getStructureValidationSQL = () => {
        if (!validationResults) return '';
        const { sourceErrors, targetErrors, matches } = validationResults;

        let report = `-- Structure Validation Report\n`;
        report += `-- Generated: ${new Date().toLocaleString()}\n\n`;

        report += `-- ISSUES (${sourceErrors.length + targetErrors.length})\n`;
        sourceErrors.forEach((e: string) => report += `-- [SOURCE ISSUE] ${e}\n`);
        targetErrors.forEach((e: string) => report += `-- [TARGET ISSUE] ${e}\n`);

        report += `\n-- VERIFIED MATCHES (${matches.length})\n`;
        matches.forEach((m: string) => report += `-- [MATCH] ${m}\n`);

        report += `\n-- Note: This is a text report of the validation findings.\n-- To verify manually, check the existence of these objects in your database.\n`;
        return report;
    };

    const generateStructureValidationSQL = () => {
        const sql = getStructureValidationSQL();
        if (!sql) {
            toast({ title: "No Validation Results", description: "Run validation first.", variant: "destructive" });
            return;
        }
        downloadString(sql, 'validation_check.sql');
        toast({ title: "Exported", description: "Validation report saved." });
    };

    const handleCopyValidationSQL = () => {
        const sql = getStructureValidationSQL();
        if (!sql) {
            toast({ title: "No Validation Results", description: "Run validation first.", variant: "destructive" });
            return;
        }
        handleCopySQL(sql, 'Validation Report');
    };

    const handleReset = () => {
        // Reset all file and analysis state
        setUploadedFile(null);
        setAnalysis(null);
        setValidationResults(null);
        setIsValidating(false);
        setIsAnalyzing(false);
        setSelectedSQL(null);

        // Reset stepper to step 1
        setCurrentStep(1);

        // Clear selected test indices
        setSelectedTestIndices([]);

        // Clear connections (users can recreate if needed)
        setSourceConnections([{ id: null, name: 'None' }]);
        setMultiSourceMode(false);
        setTargetConnection(null);

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });

        toast({
            title: "Reset Complete",
            description: "All progress cleared. Ready for new analysis."
        });
    };

    const handleSaveResultsClick = () => {
        if (!analysis) return;
        setIsSaveDialogOpen(true);
    };

    const handleSaveResultsConfirm = async (name: string, folderName?: string) => {
        if (!analysis) return; // Connections are optional now for saving, though usually present

        try {
            const passedTests = analysis.testCases.filter(tc => tc.lastRunResult?.status === 'pass').length;
            const failedTests = analysis.testCases.filter(tc => tc.lastRunResult?.status === 'fail').length;
            const normalizedFolderName = folderName?.trim() || undefined;
            const res = await reportsApi.saveTestRun({
                sourceConnectionId: multiSourceMode ? null : sourceConnections[0]?.id,
                sourceConnectionIds: multiSourceMode ? sourceConnections.map(c => c.id).filter(Boolean) : (sourceConnections[0]?.id ? [sourceConnections[0].id] : []),
                targetConnectionId: targetConnection?.id, // Can be undefined
                testCases: analysis.testCases,
                fileName: name,
                folderName: normalizedFolderName,
                summary: {
                    isTestSuite: true,
                    fileName: name,
                    folderName: normalizedFolderName,
                    totalTests: analysis.testCases.length,
                    passedTests,
                    failedTests,
                    testCases: analysis.testCases
                }
            });

            if (res.error) throw new Error(res.error);
            toast({ title: "Results Saved", description: "Test execution results saved to history." });

            // Refresh history
            const { data } = await reportsApi.list();
            setSavedRuns(normalizeSavedRuns(data));

        } catch (error) {
            console.error('Failed to save results:', error);
            toast({ title: "Save Failed", description: "Could not save results.", variant: "destructive" });
        }
    };

    const handleLoadRun = async (runSummary: any) => {
        toast({ title: "Loading...", description: "Fetching test run details." });

        try {
            // Fetch full report details to ensure we have all data
            const { data: fullRun, error } = await reportsApi.get(runSummary.id);

            if (error || !fullRun) {
                throw new Error(error || "Could not fetch report details");
            }

            // Extract test cases safely - check both locations
            const cases = (fullRun as any).summary?.testCases || (fullRun as any).testCases;

            if (!Array.isArray(cases)) {
                toast({ title: "Invalid Data", description: "Test cases not found or corrupted in saved report.", variant: "destructive" });
                return;
            }

            // Set uploaded file info - raw mapping data is not stored in saved runs
            // Only set the file name for display purposes, actual data comes from test cases
            setUploadedFile({
                name: (fullRun as any).summary?.fileName || runSummary.summary?.fileName || 'Loaded Run',
                data: [] // Raw mapping data is not available from saved runs
            });
            setAnalysis({
                sourceTables: [],
                targetTables: [],
                businessRules: [],
                testCases: cases
            });

            // Try to restore connections if possible - handle both casings
            const sourceId = (fullRun as any).source_connection_id || (fullRun as any).sourceConnectionId || runSummary.source_connection_id;
            const targetId = (fullRun as any).target_connection_id || (fullRun as any).targetConnectionId || runSummary.target_connection_id;

            if (sourceId) {
                if (Array.isArray(sourceId)) {
                    setMultiSourceMode(true);
                    const restored = sourceId.map(sid => {
                        const found = savedConnections.find(c => c.id === sid);
                        return found || { id: sid, name: 'Restored Source', database: 'Unknown' };
                    });
                    setSourceConnections(restored);
                } else {
                    setMultiSourceMode(false);
                    const found = savedConnections.find(c => c.id === sourceId);
                    setSourceConnections([found || { id: sourceId, name: 'Restored Source', database: 'Unknown' }]);
                }
            }
            if (targetId) {
                const found = savedConnections.find(c => c.id === targetId);
                setTargetConnection(found || { id: targetId, name: 'Restored Target', database: 'Unknown' });
            }

            // Navigate to step 3 (Test Comparison) to view loaded test cases
            setCurrentStep(3);
            // Scroll to top to show the step
            window.scrollTo({ top: 0, behavior: 'smooth' });

            toast({ title: "Run Loaded", description: `Loaded ${cases.length} test cases.` });

        } catch (error) {
            console.error('Failed to load run:', error);
            toast({ title: "Load Failed", description: "Could not load test run.", variant: "destructive" });
        }
    };

    const handleDeleteRun = async (id: string) => {
        try {
            await reportsApi.delete(id);
            toast({ title: "Run Deleted", description: "Test run removed from history." });
            // Refresh history
            const listResponse = await reportsApi.list();
            setSavedRuns(normalizeSavedRuns(listResponse.data));
        } catch (error) {
            console.error("Delete failed", error);
            toast({ title: "Delete Failed", description: "Could not delete run.", variant: "destructive" });
        }
    };

    return (
        <ResizablePanelGroup direction="horizontal" dir="ltr" className="h-full min-h-0 min-w-0 overflow-hidden rounded-xl border bg-background">
            {!isHistorySidebarHidden && (
                <>
                    <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
                        <TestHistorySidebar
                            savedRuns={savedRuns}
                            onLoadRun={handleLoadRun}
                            onDeleteRun={handleDeleteRun}
                        />
                    </ResizablePanel>
                    <ResizableHandle withHandle />
                </>
            )}

            <ResizablePanel defaultSize={isHistorySidebarHidden ? 100 : 80} className="min-w-0">
                <div className="h-full min-w-0 space-y-5 overflow-y-auto overflow-x-hidden bg-muted/20 p-4 sm:p-6">
                    <div className="rounded-xl border bg-card p-4 shadow-sm">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight sm:text-3xl">
                                    <span className="rounded-lg border bg-primary/10 p-2">
                                        <FileSpreadsheet className="h-6 w-6 text-primary" />
                                    </span>
                                    ETL Workflow
                                </h1>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Upload mapping sheet, validate structure, run ETL comparisons, and save run history.
                                </p>
                            </div>
                            <div className="flex items-center gap-2 self-start sm:self-auto">
                                <Button
                                    variant={isHistorySidebarHidden ? "default" : "outline"}
                                    onClick={() => setIsHistorySidebarHidden((prev) => !prev)}
                                    className="h-9 min-w-[170px] text-sm font-medium"
                                >
                                    {isHistorySidebarHidden ? "Show Test Explorer" : "Hide Test Explorer"}
                                </Button>
                                <Button
                                    variant="ghost"
                                    onClick={handleReset}
                                    className="h-9 gap-2 px-3 text-sm text-muted-foreground hover:text-foreground"
                                >
                                    <RotateCcw className="h-4 w-4" />
                                    Reset Progress
                                </Button>
                            </div>
                        </div>
                    </div>

                    <WorkflowStepper
                        currentStep={currentStep}
                        onStepChange={setCurrentStep}
                        canAccessStep={canAccessStep}
                        onRestart={handleReset}
                    >
                        {currentStep === 1 && (
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <h2 className="text-lg font-semibold sm:text-xl">Step 1: Manage Connections</h2>
                                    <p className="text-sm text-muted-foreground">
                                        Create and manage your database connections. You need at least 2 connections (source and target) to proceed.
                                    </p>
                                </div>

                                {/* Agent Selection */}
                                <div className="rounded-lg border bg-background p-3">
                                    <div className="grid gap-3 lg:grid-cols-[1fr_360px] lg:items-start">
                                        <div className="space-y-2">
                                            <div>
                                                <h3 className="text-sm font-semibold">Select Active Agent</h3>
                                                <p className="text-sm text-muted-foreground">
                                                    Choose an online ETL agent to execute connection tests and metadata jobs.
                                                </p>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                <div className="inline-flex items-center gap-2 rounded-md border bg-muted/10 px-2.5 py-1">
                                                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total</span>
                                                    <span className="text-sm font-medium">{agents.length}</span>
                                                </div>
                                                <div className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50/70 px-2.5 py-1">
                                                    <span className="text-xs font-medium uppercase tracking-wide text-emerald-700">Active</span>
                                                    <span className="text-sm font-medium text-emerald-700">{selectableAgents.length}</span>
                                                </div>
                                                <div className="inline-flex items-center gap-2 rounded-md border bg-muted/10 px-2.5 py-1">
                                                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Offline</span>
                                                    <span className="text-sm font-medium">{offlineAgents.length}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Select
                                                value={selectedAgentId}
                                                onValueChange={(value) => setSelectedAgentId(value)}
                                                disabled={loadingAgents || selectableAgents.length === 0}
                                            >
                                                <SelectTrigger className="h-10 w-full">
                                                    <SelectValue placeholder={loadingAgents ? "Loading agents..." : "Select an active agent"} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {agents.map((agent) => {
                                                        const isSelectable = isAgentOnline(agent);
                                                        const statusLabel = agent.status === "busy" ? "Busy" : isAgentOnline(agent) ? "Online" : "Offline";
                                                        return (
                                                            <SelectItem key={agent.id} value={agent.id} disabled={!isSelectable}>
                                                                <div className="flex w-full items-center justify-between gap-2">
                                                                    <span className="truncate">{agent.agent_name}</span>
                                                                    <Badge variant={statusLabel === "Offline" ? "outline" : "default"} className="h-4 text-[10px]">
                                                                        {statusLabel}
                                                                    </Badge>
                                                                </div>
                                                            </SelectItem>
                                                        );
                                                    })}
                                                </SelectContent>
                                            </Select>
                                            {!loadingAgents && agents.length > 0 && selectableAgents.length === 0 && (
                                                <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-sm text-amber-700">
                                                    No active agent available. Start an agent to continue.
                                                </p>
                                            )}
                                            {selectedAgentId && (
                                                <p className="rounded-md border bg-muted/20 px-2.5 py-1.5 text-sm text-muted-foreground">
                                                    Selected: <span className="font-medium text-foreground">{agents.find((a) => a.id === selectedAgentId)?.agent_name || "Unknown"}</span>
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <ConnectionsPanel
                                    onConnectionSaved={handleConnectionSaved}
                                    onConnectionDeleted={handleConnectionSaved}
                                    agentId={selectedAgentId}
                                />
                            </div>
                        )}

                        {currentStep === 2 && (
                            <UploadValidationStep
                                uploadedFile={uploadedFile}
                                isDragging={isDragging}
                                isAnalyzing={isAnalyzing}
                                analysisError={analysisError}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                onFileSelect={handleFileSelect}
                                onChangeFile={() => {
                                    setUploadedFile(null);
                                    setSheets([]);
                                    setSelectedSheetNames([]);
                                    setAnalysisError(null);
                                    setAnalysis(null);
                                    setValidationResults(null);
                                    setSelectedTestIndices([]);
                                    setIsSheetInQAStandardFormat(false);
                                }}
                                mappingSheetMode={mappingSheetMode}
                                onMappingSheetModeChange={(mode) => {
                                    setMappingSheetMode(mode);
                                    // Avoid mixing states between modes.
                                    setUploadedFile(null);
                                    setSheets([]);
                                    setSelectedSheetNames([]);
                                    setAnalysisError(null);
                                    setAnalysis(null);
                                    setValidationResults(null);
                                    setSelectedTestIndices([]);
                                    setIsSheetInQAStandardFormat(false);
                                }}
                                onReplaceWorkbook={replaceWorkbook}
                                onConvertAndValidate={handleConvertAndValidate}
                                savedConnections={savedConnections}
                                sourceConnections={sourceConnections}
                                multiSourceMode={multiSourceMode}
                                onMultiSourceModeChange={setMultiSourceMode}
                                targetConnection={targetConnection}
                                onSourceConnectionsChange={setSourceConnections}
                                onTargetConnectionChange={(id) => {
                                    if (id === "none") setTargetConnection(null);
                                    else setTargetConnection(savedConnections.find(c => c.id === id));
                                }}
                                onValidate={handleValidateStructure}
                                onExportValidationSQL={generateStructureValidationSQL}
                                onCopyValidationSQL={handleCopyValidationSQL}
                                isValidating={isValidating}
                                validationResults={validationResults}
                                analysis={analysis}
                                sheets={sheets}
                                selectedSheetNames={selectedSheetNames}
                                onSheetsSelectionChange={handleSheetsSelectionChange}
                                onAnalyzeSelected={handleAnalyzeSelected}
                                promptInstructions={promptInstructions}
                                onPromptInstructionsChange={setPromptInstructions}

                            />
                        )
                        }

                        {
                            currentStep === 3 && (
                                <TestComparisonStep
                                    analysis={analysis}
                                    uploadedFile={uploadedFile}
                                    onExportResults={handleExportResults}
                                    onCopy={handleCopyTestCasesSQL}
                                    onQueryCreate={handleQueryCreate}
                                    onAddTestCase={handleAddTestCase}
                                    onUpdateTestCase={handleUpdateTestCase}
                                    onDeleteTestCase={handleDeleteTestCase}
                                    onDeleteSelected={handleDeleteSelectedTestCases}
                                    onRunTest={handleRunTestCase}
                                    onRunAll={handleRunAllTests}
                                    onQueueTestDuringRun={handleQueueTestDuringRun}
                                    onQueueTestsDuringRun={handleQueueTestsDuringRun}
                                    onUnqueueTestsDuringRun={handleUnqueueTestsDuringRun}
                                    isRunningAll={isRunningAllTests}
                                    currentExecutingTestName={currentExecutingTestName}
                                    onStopExecution={handleStopExecution}
                                    onSaveSelected={handleSaveSelected}
                                    onRegenerate={(uploadedFile?.data?.length || sheets.length > 0) ? handleRegenerateTestCases : undefined}
                                    onGenerateTests={handleProceedToTests}
                                />
                            )
                        }

                        {
                            currentStep === 4 && (
                                <SaveResultsStep
                                    analysis={analysis}
                                    uploadedFile={uploadedFile}
                                    selectedTestIndices={selectedTestIndices}
                                    onSaveResults={handleSaveResultsClick}
                                    onExportResults={handleExportResults}
                                />
                            )
                        }
                    </WorkflowStepper >


                    {/* SQL Dialog (Shared) */}
                    <Dialog open={showSQLDialog} onOpenChange={setShowSQLDialog}>
                        <DialogContent className="max-w-4xl max-h-[800px] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>{selectedSQL?.name || 'Generated SQL'}</DialogTitle>
                                <DialogDescription>Review and copy the generated test SQL</DialogDescription>
                            </DialogHeader>
                            {selectedSQL && (
                                <div className="grid grid-cols-2 gap-4 mt-4">
                                    <div className="space-y-2">
                                        <Label className="flex justify-between">
                                            Source SQL
                                            <Button variant="ghost" size="sm" onClick={() => handleCopySQL(selectedSQL.source, 'source')}>
                                                <Copy className="h-4 w-4" />
                                            </Button>
                                        </Label>
                                        <Textarea className="font-mono text-xs h-[300px]" readOnly value={selectedSQL.source} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="flex justify-between">
                                            Target SQL
                                            <Button variant="ghost" size="sm" onClick={() => handleCopySQL(selectedSQL.target, 'target')}>
                                                <Copy className="h-4 w-4" />
                                            </Button>
                                        </Label>
                                        <Textarea className="font-mono text-xs h-[300px]" readOnly value={selectedSQL.target} />
                                    </div>
                                </div>
                            )}
                            <DialogFooter>
                                <Button onClick={() => setShowSQLDialog(false)}>Close</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog >

                    <SaveRunDialog
                        open={isSaveDialogOpen}
                        onOpenChange={setIsSaveDialogOpen}
                        onSave={handleSaveResultsConfirm}
                        defaultName={uploadedFile?.name || 'Manual Test Run'}
                        existingFolders={Array.from(new Set(savedRuns.map(r => r.summary?.folderName).filter(Boolean)))}
                    />
                </div >
            </ResizablePanel >
        </ResizablePanelGroup >
    );
}
