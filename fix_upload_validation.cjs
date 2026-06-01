const fs = require('fs');
const file = 'src/components/ai-comparison-workflow/UploadValidationStep.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
    '    onAnalyzeSelected?: () => void;',
    '    onAnalyzeSelected?: () => void;\n    onStopValidation?: () => void;'
);

content = content.replace(
    `    selectedSheetNames = [],
    onSheetsSelectionChange,
    onAnalyzeSelected,
    mappingSheetMode = 'qa_standard',`,
    `    selectedSheetNames = [],
    onSheetsSelectionChange,
    onAnalyzeSelected,
    onStopValidation,
    mappingSheetMode = 'qa_standard',`
);

content = content.replace(
    `                                    {!!uploadedFile && (
                                        <Button
                                            className="w-full"
                                            size="sm"
                                            variant="outline"
                                            onClick={() => onValidate()}
                                            disabled={isValidating || isAnalyzing}
                                        >
                                            {isValidating ? (
                                                <><Loader2 className="h-3 w-3 mr-2 animate-spin" /> Validating...</>
                                            ) : (
                                                "Validate Structure"
                                            )}
                                        </Button>
                                    )}`,
    `                                    {!!uploadedFile && (
                                        <div className="flex gap-2 w-full">
                                            <Button
                                                className="flex-1"
                                                size="sm"
                                                variant="outline"
                                                onClick={() => onValidate()}
                                                disabled={isValidating || isAnalyzing}
                                            >
                                                {isValidating ? (
                                                    <><Loader2 className="h-3 w-3 mr-2 animate-spin" /> Validating...</>
                                                ) : (
                                                    "Validate Structure"
                                                )}
                                            </Button>
                                            {isValidating && onStopValidation && (
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    onClick={onStopValidation}
                                                    title="Stop Validation"
                                                >
                                                    <XCircle className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    )}`
);

content = content.replace(
    `                            <div className="mt-4 w-full max-w-xs">
                                <Button
                                    className="w-full"
                                    variant="outline"
                                    onClick={() => onValidate()}
                                    disabled={isValidating || isAnalyzing}
                                >
                                    {isValidating ? (
                                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Validating...</>
                                    ) : (
                                        "Validate Structure"
                                    )}
                                </Button>
                                {!analysis?.mappings && (
                                    <p className="mt-2 text-center text-xs text-muted-foreground">
                                        Run Analyze first to enable validation.
                                    </p>
                                )}
                            </div>`,
    `                            <div className="mt-4 w-full max-w-xs flex flex-col gap-2">
                                <Button
                                    className="w-full"
                                    variant="outline"
                                    onClick={() => onValidate()}
                                    disabled={isValidating || isAnalyzing}
                                >
                                    {isValidating ? (
                                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Validating...</>
                                    ) : (
                                        "Validate Structure"
                                    )}
                                </Button>
                                {isValidating && onStopValidation && (
                                    <Button
                                        className="w-full"
                                        variant="destructive"
                                        onClick={onStopValidation}
                                    >
                                        Stop Validation
                                    </Button>
                                )}
                                {!analysis?.mappings && (
                                    <p className="mt-2 text-center text-xs text-muted-foreground">
                                        Run Analyze first to enable validation.
                                    </p>
                                )}
                            </div>`
);

fs.writeFileSync(file, content);
console.log('Fixed UploadValidationStep.tsx');
