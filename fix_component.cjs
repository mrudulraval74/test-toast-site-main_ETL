const fs = require('fs');
const file = 'src/components/AIComparison.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
    'const lastAgentFetchAtRef = useRef(0);',
    'const lastAgentFetchAtRef = useRef(0);\n    const validationAbortControllerRef = useRef<AbortController | null>(null);'
);

content = content.replace(
    `        // Subscribe to agent changes
        const channel = supabase
            .channel('public:self_hosted_agents')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'self_hosted_agents' }, () => {
                fetchAgents({ silent: true });
            })
            .subscribe();

        // Fallback polling keeps heartbeat status fresh even if realtime events are delayed/missed.`,
    `        // Fallback polling keeps heartbeat status fresh even if realtime events are delayed/missed.`
);

content = content.replace(
    `        return () => {
            window.clearInterval(intervalId);
            supabase.removeChannel(channel);
        };`,
    `        return () => {
            window.clearInterval(intervalId);
        };`
);

content = content.replace(
    `    const handleSheetsSelectionChange = (names: string[]) => {
        setSelectedSheetNames(names);
        // Do not auto-analyze. User must click "Analyze Selected"
    };`,
    `    const handleSheetsSelectionChange = (names: string[]) => {
        setSelectedSheetNames(names);
        
        const selectedSheets = sheets.filter(s => names.includes(s.name));
        if (selectedSheets.length > 0) {
            analyzeMapping(selectedSheets, { forceQaStandard: isSheetInQAStandardFormat });
        }
    };`
);

content = content.replace(
    `    const handleValidateStructure = async () => {`,
    `    const handleStopValidation = React.useCallback(() => {
        if (validationAbortControllerRef.current) {
            validationAbortControllerRef.current.abort();
            validationAbortControllerRef.current = null;
            toast({
                title: "Validation Stopped",
                description: "The validation process was aborted.",
                variant: "destructive"
            });
            setIsValidating(false);
        }
    }, [toast]);

    const handleValidateStructure = async () => {`
);

content = content.replace(
    `onValidate={handleValidateStructure}
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
                                onPromptInstructionsChange={setPromptInstructions}`,
    `onValidate={handleValidateStructure}
                                onStopValidation={handleStopValidation}
                                onExportValidationSQL={generateStructureValidationSQL}
                                onCopyValidationSQL={handleCopyValidationSQL}
                                isValidating={isValidating}
                                validationResults={validationResults}
                                analysis={analysis}
                                sheets={sheets}
                                selectedSheetNames={selectedSheetNames}
                                onSheetsSelectionChange={handleSheetsSelectionChange}
                                promptInstructions={promptInstructions}
                                onPromptInstructionsChange={setPromptInstructions}`
);

fs.writeFileSync(file, content);
console.log('Fixed AIComparison.tsx');
