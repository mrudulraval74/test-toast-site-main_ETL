import { useState, useEffect } from 'react';
import { FileSpreadsheet, Copy } from 'lucide-react';
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
import { isAgentOnline } from "@/utils/agentUtils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { AlertCircle, Lock } from 'lucide-react';


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

    const [isDragging, setIsDragging] = useState(false);
    const [uploadedFile, setUploadedFile] = useState<{ name: string; data: any[] } | null>(null);
    const [sheets, setSheets] = useState<{ name: string; data: any[] }[]>([]);
    const [selectedSheetNames, setSelectedSheetNames] = useState<string[]>([]);
    const [analysis, setAnalysis] = useState<MappingAnalysis | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisError, setAnalysisError] = useState<string | null>(null);

    // SQL Dialog State
    const [showSQLDialog, setShowSQLDialog] = useState(false);
    const [selectedSQL, setSelectedSQL] = useState<{ source: string; target: string; name: string } | null>(null);

    // Agent State
    const [agents, setAgents] = useState<any[]>([]);
    const [selectedAgentId, setSelectedAgentId] = useState<string>("");
    const [loadingAgents, setLoadingAgents] = useState(false);

    // Fetch Agents on Mount
    useEffect(() => {
        const fetchAgents = async () => {
            setLoadingAgents(true);
            try {
                const { data, error } = await supabase
                    .from('self_hosted_agents')
                    .select('*')
                    // .eq('agent_type', 'etl') // Removed strict filter to allow general agents
                    .order('status', { ascending: false }); // Online first

                if (error) throw error;
                setAgents(data || []);

                // Auto-select first active agent
                const onlineAgent = data?.find(a => isAgentOnline(a));
                if (onlineAgent) setSelectedAgentId(onlineAgent.id);
            } catch (err) {
                console.error("Failed to fetch agents", err);
                toast({ title: "Agent Error", description: "Failed to load ETL agents", variant: "destructive" });
            } finally {
                setLoadingAgents(false);
            }
        };

        fetchAgents();

        // Subscribe to agent changes
        const channel = supabase
            .channel('public:self_hosted_agents')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'self_hosted_agents' }, () => {
                fetchAgents();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

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



    // Stepper State
    const [currentStep, setCurrentStep] = useState(1);
    const [selectedTestIndices, setSelectedTestIndices] = useState<number[]>([]); // For filtering to selected tests

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

    // Listen for analyze mapping button click from UploadValidationStep
    useEffect(() => {
        const handleAnalyzeClick = () => {
            if (uploadedFile?.data && !isAnalyzing) {
                analyzeMapping(uploadedFile.data);
            }
        };
        window.addEventListener('analyzeMapping', handleAnalyzeClick as EventListener);
        return () => window.removeEventListener('analyzeMapping', handleAnalyzeClick as EventListener);
    }, [uploadedFile, isAnalyzing]);


    // Load Connections on mount
    useEffect(() => {
        const loadConnections = async () => {
            try {
                const { data } = await connectionsApi.list();
                if (data && Array.isArray(data)) {
                    setSavedConnections(data);
                    console.log('Loaded', data.length, 'connections');
                }
            } catch (error) {
                console.error('Failed to load connections:', error);
            }
        };
        loadConnections();
    }, []);

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
                // API returns {reports: [...], total, limit, offset}
                if (data && (data as any).reports && Array.isArray((data as any).reports)) {
                    const tests = (data as any).reports.filter((r: any) => r.summary?.isTestSuite);
                    setSavedRuns(tests);
                }
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
                data: XLSX.utils.sheet_to_json(wb.Sheets[name])
            }));

            setSheets(loadedSheets);

            if (loadedSheets.length > 0) {
                const firstSheet = loadedSheets[0];
                setUploadedFile({ name: file.name, data: firstSheet.data });
                // Select first sheet by default
                setSelectedSheetNames([firstSheet.name]);

                toast({
                    title: "File Loaded",
                    description: `Loaded ${loadedSheets.length} sheet${loadedSheets.length > 1 ? 's' : ''}. Select sheets to analyze.`
                });

                // Auto-analyze first sheet
                analyzeMapping([firstSheet]);
            } else {
                toast({ title: "Empty File", description: "No sheets found in file.", variant: "destructive" });
            }
        };
        reader.readAsBinaryString(file);
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
        analyzeMapping(selectedSheets);
    };

    const createFallbackTestCases = (mappingData: any[]): MappingAnalysis => {
        return generateMappingSpecificTests(mappingData);
    };

    // Updated to handle multiple sheets
    const analyzeMapping = async (sheetsToAnalyze: { name: string, data: any[] }[]) => {
        setIsAnalyzing(true);
        setAnalysisError(null);
        setValidationResults(null); // Clear previous results

        try {
            console.log(`Analyzing ${sheetsToAnalyze.length} sheets...`);

            // Fetch schemas once (Multiple Sources)
            let sourceSchemas: any[] = [];
            let targetSchema: any = null;

            if (multiSourceMode) {
                for (const conn of sourceConnections) {
                    if (conn?.id) {
                        try {
                            const { fetchDatabaseSchema } = await import('@/utils/schemaFetcher');
                            const schema = await fetchDatabaseSchema(conn.id);
                            if (schema) sourceSchemas.push(schema);
                        } catch (e) { console.warn(`Source schema fetch failed for ${conn.name}`, e); }
                    }
                }
            } else if (sourceConnections[0]?.id) {
                try {
                    const { fetchDatabaseSchema } = await import('@/utils/schemaFetcher');
                    const schema = await fetchDatabaseSchema(sourceConnections[0].id);
                    if (schema) sourceSchemas.push(schema);
                } catch (e) { console.warn('Source schema fetch failed', e); }
            }
            if (targetConnection?.id) {
                try {
                    const { fetchDatabaseSchema } = await import('@/utils/schemaFetcher');
                    targetSchema = await fetchDatabaseSchema(targetConnection.id);
                } catch (e) { console.warn('Target schema fetch failed', e); }
            }

            // Aggregated Results
            const aggregatedParsedMappings: any[] = [];
            const aggregatedSourceTables = new Set<string>();
            const aggregatedTargetTables = new Set<string>();
            const aggregatedErrors: string[] = [];

            const { parseMappingSheet } = await import('@/utils/mappingSheetParser');

            // Iterate and Parse
            for (const sheet of sheetsToAnalyze) {
                console.log(`Parsing sheet: ${sheet.name}`);
                const parsed = parseMappingSheet(sheet.data);

                if (!parsed.columnMappings || parsed.columnMappings.length === 0) {
                    aggregatedErrors.push(`[${sheet.name}] No valid mappings found.`);
                    continue;
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

            if (aggregatedParsedMappings.length === 0) {
                const msg = aggregatedErrors.length > 0 ? aggregatedErrors.join('\n') : "No mappings detected in selected sheets.";
                setAnalysisError(msg);
                throw new Error("INVALID_LAYOUT");
            }

            const preliminaryAnalysis = {
                sourceTables: Array.from(aggregatedSourceTables),
                targetTables: Array.from(aggregatedTargetTables),
                businessRules: [`📋 Analyzed ${sheetsToAnalyze.length} sheets`, `Total Mappings: ${aggregatedParsedMappings.length}`],
                testCases: [],
                mappings: aggregatedParsedMappings
            };

            // Match to real schema
            const matchedAnalysis = await matchToRealSchema(preliminaryAnalysis, sourceSchemas[0], targetSchema);
            setAnalysis(matchedAnalysis);

            // Validate Structure
            if ((multiSourceMode ? sourceConnections.some(c => c.id) : sourceConnections[0]?.id) && targetConnection?.id) {
                setTimeout(() => {
                    handleValidateStructure(aggregatedParsedMappings);
                }, 300);
            } else {
                toast({ title: "Connections Required", description: "Select source and target connections to validate." });
            }

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
                        const schema = await fetchDatabaseSchema(conn.id);
                        if (schema) sourceSchemas.push(schema);
                    }
                }
            } else if (sourceConnections[0]?.id) {
                const { fetchDatabaseSchema } = await import('@/utils/schemaFetcher');
                const schema = await fetchDatabaseSchema(sourceConnections[0].id);
                if (schema) sourceSchemas.push(schema);
            }

            if (targetConnection?.id) {
                const { fetchDatabaseSchema } = await import('@/utils/schemaFetcher');
                targetSchema = await fetchDatabaseSchema(targetConnection.id);
            }

            const selectedSheets = sheets.filter(s => selectedSheetNames.includes(s.name));
            const allTestCases = [];
            const allSourceTables = new Set<string>();
            const allTargetTables = new Set<string>();

            // Generate tests for EACH sheet
            for (const sheet of selectedSheets) {
                // 1. Generate mapping-specific tests (column-level)
                const analyzed = generateMappingSpecificTests(
                    sheet.data,
                    sourceSchemas[0],
                    targetSchema,
                    'Unknown_Pipeline',
                    sourceConnections[0]?.type,
                    targetConnection?.type
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
                description: `Generated ${allTestCases.length} test cases (mapping + ETL) from ${selectedSheets.length} sheets`
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
        // Priority: Multi-sheet selection
        if (sheets.length > 0 && selectedSheetNames.length > 0) {
            const sheetsToAnalyze = sheets.filter(s => selectedSheetNames.includes(s.name));
            if (sheetsToAnalyze.length > 0) {
                await analyzeMapping(sheetsToAnalyze);
                return;
            }
        }

        // Fallback: Single uploaded file
        if (uploadedFile?.data) {
            // analyzeMapping now expects an array of sheets, so we wrap the single file
            await analyzeMapping([{ name: uploadedFile.name, data: uploadedFile.data }]);
            return;
        }

        toast({ title: "No Data", description: "Please upload a file first.", variant: "destructive" });
    };

    // --- CRUD Operations for Test Cases ---
    const handleAddTestCase = (newTestCase: TestCase) => {
        if (!analysis) return;
        const updatedTestCases = [...analysis.testCases, newTestCase];
        setAnalysis({ ...analysis, testCases: updatedTestCases });
        toast({ title: "Test Case Added", description: `Added '${newTestCase.name}'` });
    };

    const handleUpdateTestCase = (index: number, updatedTestCase: TestCase) => {
        if (!analysis) return;
        const updatedTestCases = [...analysis.testCases];
        updatedTestCases[index] = updatedTestCase;
        setAnalysis({ ...analysis, testCases: updatedTestCases });
        toast({ title: "Test Case Updated", description: `Updated '${updatedTestCase.name}'` });
    };

    const handleDeleteTestCase = (index: number) => {
        if (!analysis) return;
        const updatedTestCases = analysis.testCases.filter((_, i) => i !== index);
        setAnalysis({ ...analysis, testCases: updatedTestCases });
        toast({ title: "Test Case Deleted", description: "Test case removed." });
    };

    // --- Test Execution Logic (Agent-Based) ---
    const handleRunTestCase = async (testCase: TestCase) => {
        const hasSource = multiSourceMode ? sourceConnections.some(c => c.id) : sourceConnections[0]?.id;

        if (!selectedAgentId) {
            toast({ title: "Agent Required", description: "Please select an active ETL Agent in Step 1.", variant: "destructive" });
            return;
        }

        if (!hasSource || !targetConnection) {
            toast({ title: "Connections Missing", description: "Please select both Source and Target connections.", variant: "destructive" });
            return;
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
        toast({ title: "Job Queued", description: `Agent '${agents.find(a => a.id === selectedAgentId)?.agent_name || 'Unknown'}' requested.` });

        try {
            // 1. Submit Job to Agent
            const config = {
                agent_id: selectedAgentId,
                source_connection_id: multiSourceMode ? sourceConnections[0].id : sourceConnections[0].id, // TODO: Handle multi-source properly in agent
                target_connection_id: targetConnection.id,
                test_case: testCase
            };

            const { data: job, error: jobError } = await compareApi.run(config);

            if (jobError || !job) {
                throw new Error(jobError || "Failed to submit job to agent");
            }

            console.log("Job submitted:", job);
            updateStatus({ status: 'running', message: 'Agent Processing...', timestamp: new Date() });

            // 2. Poll for Completion
            const pollInterval = setInterval(async () => {
                const { data: statusData, error: statusError } = await compareApi.status(job.job_id || job.id);

                if (statusError) {
                    clearInterval(pollInterval);
                    updateStatus({ status: 'fail', message: `Poll Error: ${statusError}`, timestamp: new Date() });
                    return;
                }

                const jobStatus = statusData?.status;
                console.log("Job Status:", jobStatus);

                if (jobStatus === 'completed') {
                    clearInterval(pollInterval);
                    // Fetch full results
                    const { data: resultData } = await compareApi.results(job.job_id || job.id);

                    const result = resultData?.result || {};
                    const success = result.success || false;
                    const message = result.message || (success ? "Test Passed" : "Test Failed");

                    updateStatus({
                        status: success ? 'pass' : 'fail',
                        message: message,
                        timestamp: new Date(),
                        details: {
                            sourceCount: result.source_count || 0,
                            targetCount: result.target_count || 0,
                            sourceData: result.source_data || [],
                            targetData: result.target_data || [],
                            comparisonType: testCase.category || 'general',
                            mismatchData: result.mismatches || []
                        }
                    });

                    toast({
                        title: success ? "Test Passed" : "Issue Detected",
                        description: message,
                        variant: success ? "default" : "destructive"
                    });
                } else if (jobStatus === 'failed' || jobStatus === 'error') {
                    clearInterval(pollInterval);
                    const errorMsg = statusData?.error || "Agent failed to execute job";
                    updateStatus({ status: 'fail', message: errorMsg, timestamp: new Date() });
                    toast({ title: "Execution Failed", description: errorMsg, variant: "destructive" });
                }
            }, 2000); // Poll every 2 seconds

            // Timeout after 60 seconds
            setTimeout(() => {
                clearInterval(pollInterval);
                // check if still running?
            }, 60000);

        } catch (error) {
            const errMsg = error instanceof Error ? error.message : 'Unknown execution error';
            updateStatus({
                status: 'fail',
                message: errMsg,
                timestamp: new Date()
            });
            toast({ title: "Submission Failed", description: errMsg, variant: "destructive" });
        }
    };

    const handleRunAllTests = async () => {
        const hasSource = multiSourceMode ? sourceConnections.some(c => c.id) : sourceConnections[0]?.id;
        if (!analysis || !hasSource || !targetConnection) {
            toast({ title: "Cannot Run All", description: "Ensure analysis exists and connections are selected.", variant: "destructive" });
            return;
        }

        toast({ title: "Batch Execution Started", description: "Running all test cases sequentially..." });

        for (const tc of analysis.testCases) {
            await handleRunTestCase(tc);
            // Small delay to prevent overwhelming the server/browser
            await new Promise(r => setTimeout(r, 500));
        }

        toast({ title: "Batch Complete", description: "All tests executed." });
    };

    const handleQueryCreate = (testCase: TestCase) => {
        setSelectedSQL({
            source: testCase.sourceSQL,
            target: testCase.targetSQL,
            name: testCase.name
        });
        setShowSQLDialog(true);
    };



    const handleValidateStructure = async (directMappings?: any[]) => {
        const mappingsToValidate = directMappings || analysis?.mappings;

        if (!mappingsToValidate || mappingsToValidate.length === 0) {
            toast({ title: "No Mappings Found", description: "Cannot validate structure without mapping details.", variant: "destructive" });
            return;
        }

        const hasSource = multiSourceMode ? sourceConnections.some(c => c.id) : sourceConnections[0]?.id;
        if (!hasSource && !targetConnection) {
            toast({
                title: "Connections Required",
                description: "Please select at least one connection (source or target) to validate structure.",
                variant: "destructive"
            });
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

            let sourceMetas: any[] = [];
            let targetMeta: any = null;

            const activeSources = multiSourceMode
                ? sourceConnections.filter(c => c.id)
                : [sourceConnections[0]].filter(c => c?.id);

            for (const src of activeSources) {
                try {
                    const resp = await connectionsApi.metadata(src.id);
                    sourceMetas.push(resp.data);
                    console.log(`✅ Fetched metadata for ${src.name}:`, (resp.data as any)?.databases?.length || 0, 'databases');
                } catch (e) {
                    const errorMsg = `Failed to fetch metadata for source: ${src.name}`;
                    results.warnings.push(errorMsg);
                    console.warn('❌', errorMsg, e);
                }
            }

            if (sourceMetas.length === 0 && (multiSourceMode ? sourceConnections.some(c => c.id) : sourceConnections[0]?.id)) {
                results.warnings.push('Selected source connection(s) could not retrieve metadata');
            }

            if (targetConnection) {
                try {
                    const resp = await connectionsApi.metadata(targetConnection.id);
                    targetMeta = resp.data;
                    console.log('✅ Fetched target metadata:', (targetMeta as any)?.databases?.length || 0, 'databases');
                } catch (e) {
                    const errorMsg = `Failed to fetch metadata for target: ${targetConnection.name}`;
                    results.warnings.push(errorMsg);
                    console.warn('❌', errorMsg, e);
                }
            } else {
                results.warnings.push('No target connection selected - skipping target validation');
            }

            const findTable = (meta: any, tableName: string) => {
                if (!meta || !(meta as any).databases) return null;
                const cleanName = tableName.replace(/[\[\]]/g, '');
                const parts = cleanName.split('.');
                const tableBase = parts.length > 1 ? parts[1] : parts[0];
                const schemaBase = parts.length > 1 ? parts[0] : null;

                for (const db of ((meta as any).databases as any[])) {
                    for (const schema of (db.schemas as any[])) {
                        if (!schemaBase || schema.name.toLowerCase() === schemaBase.toLowerCase()) {
                            for (const table of (schema.tables as any[])) {
                                if (table.name.toLowerCase() === tableBase.toLowerCase()) return table;
                            }
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

                if (sourceMetas.length > 0 && hasValidSourceData) {
                    const tableKey = mapping.sourceTable;
                    const stats = getTableStats(sourceMatches, tableKey);
                    stats.total.add(mapping.sourceColumn);

                    // Try to find in any of the available source metadata
                    let tableFound = false;
                    for (const meta of sourceMetas) {
                        const table = findTable(meta, tableKey);
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
                } else if (sourceMetas.length > 0) {
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

                if (targetMeta && hasValidTargetData) {
                    const tableKey = mapping.targetTable;
                    const stats = getTableStats(targetMatches, tableKey);
                    stats.total.add(mapping.targetColumn);
                    const table = findTable(targetMeta, tableKey);

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
                } else if (targetMeta) {
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

    const handleSaveResultsConfirm = async (name: string, folderName: string) => {
        if (!analysis) return; // Connections are optional now for saving, though usually present

        try {
            const res = await reportsApi.saveTestRun({
                sourceConnectionId: multiSourceMode ? null : sourceConnections[0]?.id,
                sourceConnectionIds: multiSourceMode ? sourceConnections.map(c => c.id).filter(Boolean) : (sourceConnections[0]?.id ? [sourceConnections[0].id] : []),
                targetConnectionId: targetConnection?.id, // Can be undefined
                testCases: analysis.testCases,
                fileName: name,
                folderName: folderName
            });

            if (res.error) throw new Error(res.error);
            toast({ title: "Results Saved", description: "Test execution results saved to history." });

            // Refresh history
            const { data } = await reportsApi.list();
            // API returns {reports: [...], total, limit, offset}
            if (data && (data as any).reports && Array.isArray((data as any).reports)) {
                const tests = (data as any).reports.filter((r: any) => r.summary?.isTestSuite);
                setSavedRuns(tests);
            }

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
            // API returns {reports: [...], total, limit, offset}
            if (listResponse.data && (listResponse.data as any).reports && Array.isArray((listResponse.data as any).reports)) {
                const tests = (listResponse.data as any).reports.filter((r: any) => r.summary?.isTestSuite);
                setSavedRuns(tests);
            }
        } catch (error) {
            console.error("Delete failed", error);
            toast({ title: "Delete Failed", description: "Could not delete run.", variant: "destructive" });
        }
    };

    return (
        <ResizablePanelGroup direction="horizontal" className="h-[calc(100vh-100px)] border rounded-lg overflow-hidden">
            <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
                <TestHistorySidebar
                    savedRuns={savedRuns}
                    onLoadRun={handleLoadRun}
                    onDeleteRun={handleDeleteRun}
                />
            </ResizablePanel>

            <ResizableHandle withHandle />

            <ResizablePanel defaultSize={80}>
                <div className="space-y-6 p-6 h-full overflow-auto bg-background/50">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/30">
                                    <FileSpreadsheet className="h-7 w-7 text-primary" />
                                </div>
                                ETL Test Case Generator
                            </h1>
                            <p className="text-muted-foreground mt-1">Upload mapping sheet to auto-generate test cases</p>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                onClick={handleReset}
                                className="gap-2 border-dashed border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                            >
                                🔄 Reset Progress
                            </Button>
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
                                <div>
                                    <h2 className="text-2xl font-bold">Step 1: Manage Connections</h2>
                                    <p className="text-muted-foreground mt-1">
                                        Create and manage your database connections. You need at least 2 connections (source and target) to proceed.
                                    </p>
                                </div>

                                {/* Agent Selection */}
                                <div className="p-4 bg-muted/20 border border-muted rounded-lg flex items-center justify-between gap-4">
                                    <div className="flex-1">
                                        <h3 className="font-semibold text-sm flex items-center gap-2">
                                            <div className={`h-2 w-2 rounded-full ${agents.find(a => a.id === selectedAgentId)?.status === 'online' ? 'bg-green-500' : 'bg-gray-300'}`} />
                                            Select Active Agent
                                        </h3>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Choose an active ETL agent to execute connections and tests.
                                        </p>
                                    </div>
                                    <div className="w-[300px]">
                                        <Select
                                            value={selectedAgentId}
                                            onValueChange={(value) => setSelectedAgentId(value)}
                                            disabled={loadingAgents}
                                        >
                                            <SelectTrigger className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                                                <SelectValue placeholder="-- Select Agent --" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {agents.map((agent) => {
                                                    const isOnline = isAgentOnline(agent);
                                                    return (
                                                        <SelectItem key={agent.id} value={agent.id} disabled={!isOnline}>
                                                            <div className="flex items-center gap-2">
                                                                <span>{agent.agent_name}</span>
                                                                <Badge variant={isOnline ? "default" : "outline"} className="text-[10px] h-4">
                                                                    {isOnline ? "Online" : "Offline"}
                                                                </Badge>
                                                            </div>
                                                        </SelectItem>
                                                    );
                                                })}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <Button variant="outline" size="sm" onClick={() => window.open('/self-hosted-agents', '_blank')}>
                                        Manage Agents
                                    </Button>
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
                                    setAnalysis(null);
                                    setValidationResults(null);
                                    setSelectedTestIndices([]);
                                }}
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
                                    onRunTest={handleRunTestCase}
                                    onRunAll={handleRunAllTests}
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
