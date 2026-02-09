import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, Trash2, Edit, GripVertical, ChevronDown, ChevronUp, 
  Loader2, Key, AlertCircle, Download, FileText, Layers
} from "lucide-react";
import { DndContext, DragEndEvent, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { ACTION_CATEGORIES, ActionType, ActionCategory, getActionDefinition, getActionIcon, getActionsByCategory } from "@/lib/playwrightActions";

interface TestStep {
  id: string;
  type: ActionType;
  selector?: string;
  value?: string;
  description: string;
  extraData?: Record<string, any>;
  skip?: boolean;
}

interface NoCodeTest {
  id: string;
  name: string;
  steps: TestStep[];
  base_url: string;
}

interface TestSuiteForImport {
  id: string;
  name: string;
  prerequisite_steps?: TestStep[];
  prerequisite_base_url?: string;
}

interface SuitePrerequisitesProps {
  prerequisiteSteps: TestStep[];
  prerequisiteBaseUrl: string;
  onSave: (steps: TestStep[], baseUrl: string) => Promise<void>;
  isSaving: boolean;
  availableTests?: NoCodeTest[];
  availableSuites?: TestSuiteForImport[];
  currentSuiteId?: string;
}

// Sortable Prerequisite Step Component
const SortablePrerequisiteStep = ({
  step,
  index,
  onEdit,
  onRemove,
  onToggleSkip
}: {
  step: TestStep;
  index: number;
  onEdit: () => void;
  onRemove: () => void;
  onToggleSkip: (skip: boolean) => void;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: step.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  return (
    <Card ref={setNodeRef} style={style} className={cn(isDragging ? "shadow-lg" : "", step.skip && "opacity-60")}>
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>
            <span className="text-sm font-semibold text-muted-foreground">{index + 1}.</span>
            <span className="text-lg">{getActionIcon(step.type)}</span>
            <Badge variant="outline" className="text-xs">{step.type}</Badge>
            <span className={cn("text-sm", step.skip && "line-through text-muted-foreground")}>{step.description}</span>
            {step.skip && <Badge variant="secondary" className="text-xs">Skipped</Badge>}
          </div>
          <div className="flex items-center gap-1">
            <div className="flex items-center gap-1 mr-2">
              <Checkbox
                id={`skip-prereq-${step.id}`}
                checked={step.skip || false}
                onCheckedChange={(checked) => onToggleSkip(checked === true)}
              />
              <Label htmlFor={`skip-prereq-${step.id}`} className="text-xs text-muted-foreground cursor-pointer">
                Skip
              </Label>
            </div>
            <Button size="sm" variant="ghost" onClick={onEdit} title="Edit step">
              <Edit className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={onRemove}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {step.selector && (
          <div className="ml-14 mt-1 text-xs text-muted-foreground font-mono truncate">
            Selector: {step.selector}
          </div>
        )}
        {step.value && (
          <div className="ml-14 mt-0.5 text-xs text-muted-foreground">
            Value: {step.value.length > 50 ? step.value.slice(0, 50) + "..." : step.value}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export const SuitePrerequisites = ({
  prerequisiteSteps,
  prerequisiteBaseUrl,
  onSave,
  isSaving,
  availableTests = [],
  availableSuites = [],
  currentSuiteId
}: SuitePrerequisitesProps) => {
  const [isExpanded, setIsExpanded] = useState(prerequisiteSteps.length > 0);
  const [steps, setSteps] = useState<TestStep[]>(prerequisiteSteps);
  const [baseUrl, setBaseUrl] = useState(prerequisiteBaseUrl);
  const [showStepDialog, setShowStepDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Import states
  const [importSource, setImportSource] = useState<"test" | "suite">("test");
  const [selectedImportTestId, setSelectedImportTestId] = useState<string>("");
  const [selectedImportSuiteId, setSelectedImportSuiteId] = useState<string>("");
  const [importStepsSelection, setImportStepsSelection] = useState<Record<string, boolean>>({});
  const [importPreviewSteps, setImportPreviewSteps] = useState<TestStep[]>([]);

  // Step form states
  const [selectedActionCategory, setSelectedActionCategory] = useState<ActionCategory>("interaction");
  const [stepType, setStepType] = useState<ActionType>("click");
  const [stepSelector, setStepSelector] = useState("");
  const [stepValue, setStepValue] = useState("");
  const [stepDescription, setStepDescription] = useState("");
  const [stepExtraData, setStepExtraData] = useState<Record<string, any>>({});
  const [stepSkip, setStepSkip] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = steps.findIndex((s) => s.id === active.id);
    const newIndex = steps.findIndex((s) => s.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      setSteps(arrayMove(steps, oldIndex, newIndex));
      setHasChanges(true);
    }
  };

  const resetStepForm = () => {
    setStepType("click");
    setStepSelector("");
    setStepValue("");
    setStepDescription("");
    setStepExtraData({});
    setStepSkip(false);
    setEditingStepIndex(null);
    setSelectedActionCategory("interaction");
  };

  const handleOpenAddStep = () => {
    resetStepForm();
    setShowStepDialog(true);
  };

  const handleOpenEditStep = (index: number) => {
    const step = steps[index];
    setStepType(step.type);
    setStepSelector(step.selector || "");
    setStepValue(step.value || "");
    setStepDescription(step.description);
    setStepExtraData(step.extraData || {});
    setStepSkip(step.skip || false);
    setEditingStepIndex(index);
    
    // Find and set the category for this action
    const actionDef = getActionDefinition(step.type);
    if (actionDef) {
      setSelectedActionCategory(actionDef.category);
    }
    
    setShowStepDialog(true);
  };

  const handleSaveStep = () => {
    const actionDef = getActionDefinition(stepType);
    const description = stepDescription || actionDef?.label || stepType;

    const newStep: TestStep = {
      id: editingStepIndex !== null ? steps[editingStepIndex].id : crypto.randomUUID(),
      type: stepType,
      selector: actionDef?.requiresSelector ? stepSelector : undefined,
      value: actionDef?.requiresValue ? stepValue : undefined,
      description,
      extraData: Object.keys(stepExtraData).length > 0 ? stepExtraData : undefined,
      skip: stepSkip
    };

    if (editingStepIndex !== null) {
      const updated = [...steps];
      updated[editingStepIndex] = newStep;
      setSteps(updated);
    } else {
      setSteps([...steps, newStep]);
    }

    setHasChanges(true);
    setShowStepDialog(false);
    resetStepForm();
  };

  const handleRemoveStep = (id: string) => {
    setSteps(steps.filter((s) => s.id !== id));
    setHasChanges(true);
  };

  const handleToggleSkip = (index: number, skip: boolean) => {
    const updated = [...steps];
    updated[index] = { ...updated[index], skip };
    setSteps(updated);
    setHasChanges(true);
  };

  const handleBaseUrlChange = (value: string) => {
    setBaseUrl(value);
    setHasChanges(true);
  };

  const handleSave = async () => {
    await onSave(steps, baseUrl);
    setHasChanges(false);
  };

  // Import handlers
  const handleOpenImport = () => {
    setImportSource("test");
    setSelectedImportTestId("");
    setSelectedImportSuiteId("");
    setImportStepsSelection({});
    setImportPreviewSteps([]);
    setShowImportDialog(true);
  };

  const handleSelectImportTest = (testId: string) => {
    setSelectedImportTestId(testId);
    const test = availableTests.find(t => t.id === testId);
    if (test && Array.isArray(test.steps)) {
      const testSteps = test.steps as TestStep[];
      setImportPreviewSteps(testSteps);
      // Select all steps by default
      const selection: Record<string, boolean> = {};
      testSteps.forEach(step => {
        selection[step.id] = true;
      });
      setImportStepsSelection(selection);
    } else {
      setImportPreviewSteps([]);
      setImportStepsSelection({});
    }
  };

  const handleSelectImportSuite = (suiteId: string) => {
    setSelectedImportSuiteId(suiteId);
    const suite = availableSuites.find(s => s.id === suiteId);
    if (suite && Array.isArray(suite.prerequisite_steps) && suite.prerequisite_steps.length > 0) {
      const suiteSteps = suite.prerequisite_steps;
      setImportPreviewSteps(suiteSteps);
      // Select all steps by default
      const selection: Record<string, boolean> = {};
      suiteSteps.forEach(step => {
        selection[step.id] = true;
      });
      setImportStepsSelection(selection);
    } else {
      setImportPreviewSteps([]);
      setImportStepsSelection({});
    }
  };

  const handleToggleImportStep = (stepId: string) => {
    setImportStepsSelection(prev => ({
      ...prev,
      [stepId]: !prev[stepId]
    }));
  };

  const handleToggleAllImportSteps = (selectAll: boolean) => {
    const selection: Record<string, boolean> = {};
    importPreviewSteps.forEach(step => {
      selection[step.id] = selectAll;
    });
    setImportStepsSelection(selection);
  };

  const handleImportSteps = () => {
    const selectedSteps = importPreviewSteps
      .filter(step => importStepsSelection[step.id])
      .map(step => ({
        ...step,
        id: crypto.randomUUID() // Generate new IDs to avoid conflicts
      }));
    
    if (selectedSteps.length > 0) {
      setSteps(prev => [...prev, ...selectedSteps]);
      setHasChanges(true);
      
      // If importing from suite and no base URL set, copy it
      if (importSource === "suite" && !baseUrl) {
        const suite = availableSuites.find(s => s.id === selectedImportSuiteId);
        if (suite?.prerequisite_base_url) {
          setBaseUrl(suite.prerequisite_base_url);
        }
      }
      // If importing from test and no base URL set, copy it
      if (importSource === "test" && !baseUrl) {
        const test = availableTests.find(t => t.id === selectedImportTestId);
        if (test?.base_url) {
          setBaseUrl(test.base_url);
        }
      }
    }
    
    setShowImportDialog(false);
  };

  const selectedImportCount = Object.values(importStepsSelection).filter(Boolean).length;
  const otherSuites = availableSuites.filter(s => s.id !== currentSuiteId && s.prerequisite_steps && s.prerequisite_steps.length > 0);

  const currentActionDef = getActionDefinition(stepType);

  return (
    <div className="border rounded-lg">
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <Key className="h-5 w-5 text-primary" />
          <div>
            <h4 className="font-medium text-sm">Prerequisites</h4>
            <p className="text-xs text-muted-foreground">
              {steps.length > 0
                ? `${steps.length} step(s) will run once before all test cases`
                : "Add steps that run once before all test cases (e.g., login)"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {steps.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {steps.length} step{steps.length !== 1 ? "s" : ""}
            </Badge>
          )}
          {hasChanges && (
            <Badge variant="outline" className="text-xs text-amber-600 border-amber-600">
              Unsaved
            </Badge>
          )}
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="border-t p-4 space-y-4">
          <Alert className="bg-primary/5 border-primary/20">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>What are Prerequisites?</AlertTitle>
            <AlertDescription className="text-sm">
              Prerequisite steps run <strong>once</strong> before executing any test case in the suite. 
              Use this for common setup like login flows. The browser session is shared across all test cases.
            </AlertDescription>
          </Alert>

          <div>
            <Label htmlFor="prereq-base-url">Base URL for Prerequisites</Label>
            <Input
              id="prereq-base-url"
              value={baseUrl}
              onChange={(e) => handleBaseUrlChange(e.target.value)}
              placeholder="https://example.com"
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              The URL to navigate to before running prerequisite steps
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <Label className="text-sm font-medium">Prerequisite Steps</Label>
              <div className="flex gap-2">
                {(availableTests.length > 0 || otherSuites.length > 0) && (
                  <Button size="sm" variant="outline" onClick={handleOpenImport}>
                    <Download className="mr-2 h-4 w-4" />
                    Import Steps
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={handleOpenAddStep}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Step
                </Button>
              </div>
            </div>

            {steps.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground border-2 border-dashed rounded-lg">
                <Key className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No prerequisite steps yet</p>
                <p className="text-xs">Add login or setup steps to run before tests</p>
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={steps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                  <ScrollArea className="max-h-[300px] pr-2">
                    <div className="space-y-2">
                      {steps.map((step, index) => (
                        <SortablePrerequisiteStep
                          key={step.id}
                          step={step}
                          index={index}
                          onEdit={() => handleOpenEditStep(index)}
                          onRemove={() => handleRemoveStep(step.id)}
                          onToggleSkip={(skip) => handleToggleSkip(index, skip)}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                </SortableContext>
              </DndContext>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSteps(prerequisiteSteps);
                setBaseUrl(prerequisiteBaseUrl);
                setHasChanges(false);
              }}
              disabled={!hasChanges || isSaving}
            >
              Reset
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!hasChanges || isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Prerequisites"
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Add/Edit Step Dialog */}
      <Dialog open={showStepDialog} onOpenChange={setShowStepDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingStepIndex !== null ? "Edit Prerequisite Step" : "Add Prerequisite Step"}
            </DialogTitle>
            <DialogDescription>
              Define an action for the prerequisite flow
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Category Selection */}
            <div>
              <Label>Action Category</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {ACTION_CATEGORIES.map((cat) => (
                  <Button
                    key={cat.id}
                    variant={selectedActionCategory === cat.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setSelectedActionCategory(cat.id as ActionCategory);
                      const categoryActions = getActionsByCategory(cat.id as ActionCategory);
                      if (categoryActions.length > 0) {
                        setStepType(categoryActions[0].type);
                      }
                    }}
                    className="gap-1"
                  >
                    <span>{cat.icon}</span>
                    {cat.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Action Type Selection */}
            <div>
              <Label>Action Type</Label>
              <Select value={stepType} onValueChange={(v) => setStepType(v as ActionType)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getActionsByCategory(selectedActionCategory).map((action) => (
                    <SelectItem key={action.type} value={action.type}>
                      <div className="flex items-center gap-2">
                        <span>{action.icon}</span>
                        <span>{action.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {currentActionDef?.description && (
                <p className="text-xs text-muted-foreground mt-1">{currentActionDef.description}</p>
              )}
            </div>

            {/* Selector Field */}
            {currentActionDef?.requiresSelector && (
              <div>
                <Label htmlFor="step-selector">Selector</Label>
                <Input
                  id="step-selector"
                  value={stepSelector}
                  onChange={(e) => setStepSelector(e.target.value)}
                  placeholder="e.g., #login-button, .submit-btn, [data-testid='login']"
                  className="mt-1 font-mono text-sm"
                />
              </div>
            )}

            {/* Value Field */}
            {currentActionDef?.requiresValue && (
              <div>
                <Label htmlFor="step-value">
                  {stepType === "navigate" ? "URL" : stepType.includes("type") || stepType === "fill" ? "Text to Type" : "Value"}
                </Label>
                <Input
                  id="step-value"
                  value={stepValue}
                  onChange={(e) => setStepValue(e.target.value)}
                  placeholder={stepType === "navigate" ? "https://example.com" : "Enter value"}
                  className="mt-1"
                />
              </div>
            )}

            {/* Extra Fields for specific actions */}
            {currentActionDef?.extraFields?.map((field) => (
              <div key={field.name}>
                <Label htmlFor={`extra-${field.name}`}>{field.label}</Label>
                {field.type === "select" && field.options ? (
                  <Select
                    value={stepExtraData[field.name] || ""}
                    onValueChange={(v) => setStepExtraData({ ...stepExtraData, [field.name]: v })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder={field.placeholder} />
                    </SelectTrigger>
                    <SelectContent>
                      {field.options.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id={`extra-${field.name}`}
                    type={field.type === "number" ? "number" : "text"}
                    value={stepExtraData[field.name] || ""}
                    onChange={(e) => setStepExtraData({ ...stepExtraData, [field.name]: e.target.value })}
                    placeholder={field.placeholder}
                    className="mt-1"
                  />
                )}
              </div>
            ))}

            {/* Description */}
            <div>
              <Label htmlFor="step-description">Description</Label>
              <Input
                id="step-description"
                value={stepDescription}
                onChange={(e) => setStepDescription(e.target.value)}
                placeholder={currentActionDef?.label || "Describe this step"}
                className="mt-1"
              />
            </div>

            {/* Skip Checkbox */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="step-skip"
                checked={stepSkip}
                onCheckedChange={(checked) => setStepSkip(checked === true)}
              />
              <Label htmlFor="step-skip" className="cursor-pointer">
                Skip this step during execution
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStepDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveStep}>
              {editingStepIndex !== null ? "Update Step" : "Add Step"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Steps Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Prerequisite Steps</DialogTitle>
            <DialogDescription>
              Import steps from an existing test case or copy from another suite's prerequisites
            </DialogDescription>
          </DialogHeader>

          <Tabs value={importSource} onValueChange={(v) => {
            setImportSource(v as "test" | "suite");
            setSelectedImportTestId("");
            setSelectedImportSuiteId("");
            setImportPreviewSteps([]);
            setImportStepsSelection({});
          }}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="test" className="gap-2">
                <FileText className="h-4 w-4" />
                From Test Case
              </TabsTrigger>
              <TabsTrigger value="suite" className="gap-2" disabled={otherSuites.length === 0}>
                <Layers className="h-4 w-4" />
                From Suite
              </TabsTrigger>
            </TabsList>

            <TabsContent value="test" className="space-y-4 mt-4">
              <div>
                <Label>Select Test Case</Label>
                <Select value={selectedImportTestId} onValueChange={handleSelectImportTest}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Choose a test case to import from" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTests.map(test => (
                      <SelectItem key={test.id} value={test.id}>
                        {test.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="suite" className="space-y-4 mt-4">
              {otherSuites.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>No suites available</AlertTitle>
                  <AlertDescription>
                    No other suites have prerequisite steps to import from.
                  </AlertDescription>
                </Alert>
              ) : (
                <div>
                  <Label>Select Suite</Label>
                  <Select value={selectedImportSuiteId} onValueChange={handleSelectImportSuite}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Choose a suite to copy prerequisites from" />
                    </SelectTrigger>
                    <SelectContent>
                      {otherSuites.map(suite => (
                        <SelectItem key={suite.id} value={suite.id}>
                          {suite.name} ({suite.prerequisite_steps?.length || 0} steps)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Steps Preview */}
          {importPreviewSteps.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Select Steps to Import</Label>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleToggleAllImportSteps(true)}
                  >
                    Select All
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleToggleAllImportSteps(false)}
                  >
                    Clear All
                  </Button>
                </div>
              </div>
              <ScrollArea className="max-h-[250px] border rounded-lg p-2">
                <div className="space-y-2">
                  {importPreviewSteps.map((step, index) => (
                    <div
                      key={step.id}
                      className={cn(
                        "flex items-center gap-3 p-2 rounded border cursor-pointer transition-colors",
                        importStepsSelection[step.id] 
                          ? "bg-primary/5 border-primary/30" 
                          : "bg-muted/30 hover:bg-muted/50"
                      )}
                      onClick={() => handleToggleImportStep(step.id)}
                    >
                      <Checkbox
                        checked={importStepsSelection[step.id] || false}
                        onCheckedChange={() => handleToggleImportStep(step.id)}
                      />
                      <span className="text-sm font-medium text-muted-foreground">{index + 1}.</span>
                      <span className="text-lg">{getActionIcon(step.type)}</span>
                      <Badge variant="outline" className="text-xs">{step.type}</Badge>
                      <span className="text-sm flex-1 truncate">{step.description}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <p className="text-xs text-muted-foreground">
                {selectedImportCount} of {importPreviewSteps.length} step(s) selected
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleImportSteps} 
              disabled={selectedImportCount === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Import {selectedImportCount} Step{selectedImportCount !== 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
