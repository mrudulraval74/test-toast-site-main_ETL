import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter } from
"@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle } from
"@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  Monitor,
  Plus,
  Play,
  Trash2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Wand2,
  Layers,
  Activity,
  Crosshair,
  Eye,
  Edit,
  Copy,
  Folder,
  FolderPlus,
  GripVertical,
  Video,
  Square,
  Loader2,
  Sparkles,
  Brain,
  Database,
  Upload,
  FileText,
  ChevronRight,
  AlertCircle,
  RotateCcw,
  Zap,
  ArrowUp,
  ArrowDown,
  Settings,
  Download } from
"lucide-react";
import ObjectRepository from "@/components/ObjectRepository";
import { PayloadBuilder } from "@/components/desktop-automation/PayloadBuilder";
import { LiveExecutionLog } from "@/components/desktop-automation/LiveExecutionLog";
import { RobinDispatcherGenerator } from "@/components/desktop-automation/RobinDispatcherGenerator";
import { RecorderSelectorPanel, SelectorData } from "@/components/desktop-automation/RecorderSelectorPanel";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent } from
"@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy } from
"@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://lghzmijzfpvrcvogxpew.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

interface DesktopAutomationProps {
  projectId: string;
}

interface DesktopTest {
  id: string;
  name: string;
  description: string | null;
  application_name: string;
  application_path: string | null;
  steps: any[];
  status: string;
  engine_mode: string;
  tags: string[];
  created_at: string;
  folder_id?: string | null;
}

interface ExecutionResult {
  id: string;
  job_id: string;
  status: string;
  duration_ms: number | null;
  total_steps: number;
  passed_steps: number;
  failed_steps: number;
  failure_category: string | null;
  engine_mode: string | null;
  trace_id: string | null;
  created_at: string;
  step_results: any[] | null;
  error_message: string | null;
  screenshots: any | null;
}

interface SelfHealingLog {
  id: string;
  original_selector: any;
  suggested_selector: any;
  confidence_score: number | null;
  status: string;
  ai_analysis: string | null;
  created_at: string;
}

interface SelectorEntry {
  id: string;
  element_name: string;
  application_name: string;
  selector: any;
  fallback_selectors: any[];
  version: number;
  is_active: boolean;
  validation_status: string;
}

interface DesktopAgent {
  id: string;
  agent_name: string;
  status: string;
  last_heartbeat: string | null;
}

const STEP_ACTIONS = [
"launch_app",
"click",
"double_click",
"right_click",
"type",
"clear",
"select",
"assert_text",
"assert_state",
"assert_visible",
"wait",
"wait_for_element",
"window_switch",
"window_close",
"screenshot",
"scroll",
"hover",
"keyboard_shortcut",
"drag_drop"];


const CONTROL_TYPES = [
"Button",
"Edit",
"ComboBox",
"ListItem",
"MenuItem",
"TreeItem",
"TabItem",
"CheckBox",
"RadioButton",
"DataGrid",
"DataItem",
"Window",
"Pane",
"Text",
"Document",
"Custom"];


interface ORElementBasic {
  id: string;
  element_uid: string;
  name: string;
  element_type: string;
  descriptor: any;
  screen_id: string;
}

interface SortableStepCardProps {
  step: any;
  index: number;
  totalSteps: number;
  steps: any[];
  setSteps: (s: any[]) => void;
  target: "new" | "edit";
  updateStep: (steps: any[], setSteps: (s: any[]) => void, index: number, field: string, value: any) => void;
  removeStep: (steps: any[], setSteps: (s: any[]) => void, index: number) => void;
  insertStepAt: (steps: any[], setSteps: (s: any[]) => void, index: number) => void;
  moveStepUp: (steps: any[], setSteps: (s: any[]) => void, index: number) => void;
  moveStepDown: (steps: any[], setSteps: (s: any[]) => void, index: number) => void;
  handleCaptureSelector: (stepIndex: number, target: "new" | "edit") => void;
  orElements: ORElementBasic[];
}

function SortableStepCard({
  step,
  index,
  totalSteps,
  steps,
  setSteps,
  target,
  updateStep,
  removeStep,
  insertStepAt,
  moveStepUp,
  moveStepDown,
  handleCaptureSelector,
  orElements
}: SortableStepCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: step.stepId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Card className={cn("p-4", isDragging && "ring-2 ring-primary")}>
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-2">
            <button
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing touch-none p-1 rounded hover:bg-accent">
              
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </button>
            <Badge variant="outline">Step {index + 1}</Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={index === 0}
              onClick={() => moveStepUp(steps, setSteps, index)}
              title="Move up">
              
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={index === totalSteps - 1}
              onClick={() => moveStepDown(steps, setSteps, index)}
              title="Move down">
              
              <ArrowDown className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs border-primary/40 text-primary hover:bg-primary/5"
              onClick={() => handleCaptureSelector(index, target)}>
              
              <Crosshair className="h-3 w-3 mr-1" /> Capture
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeStep(steps, setSteps, index)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Action</Label>
            <Select value={step.action} onValueChange={(v) => updateStep(steps, setSteps, index, "action", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STEP_ACTIONS.map((a) =>
                <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Control Type</Label>
            <Select
              value={step.target?.controlType}
              onValueChange={(v) => updateStep(steps, setSteps, index, "target.controlType", v)}>
              
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTROL_TYPES.map((c) =>
                <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Timeout (s)</Label>
            <Input
              type="number"
              value={step.timeoutSeconds}
              onChange={(e) => updateStep(steps, setSteps, index, "timeoutSeconds", parseInt(e.target.value))} />
            
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-2">
          <div>
            <Label className="text-xs">Automation ID</Label>
            <Input
              value={step.target?.automationId}
              onChange={(e) => updateStep(steps, setSteps, index, "target.automationId", e.target.value)}
              placeholder="" />
            
          </div>
          <div>
            <Label className="text-xs">Label / Name</Label>
            <Input
              value={step.target?.label}
              onChange={(e) => updateStep(steps, setSteps, index, "target.label", e.target.value)} placeholder="" />

            
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-2">
          <div>
            <Label className="text-xs">Parent Window</Label>
            <Input
              value={step.target?.parentWindow}
              onChange={(e) => updateStep(steps, setSteps, index, "target.parentWindow", e.target.value)}
              placeholder="" />
            
          </div>
          <div>
            <Label className="text-xs">Value / Input</Label>
            <Input
              value={step.value}
              onChange={(e) => updateStep(steps, setSteps, index, "value", e.target.value)}
              placeholder="text to type or expected value" />
            
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-2">
          <div>
            <Label className="text-xs">Class Hint</Label>
            <Input
              value={step.target?.classHint}
              onChange={(e) => updateStep(steps, setSteps, index, "target.classHint", e.target.value)} placeholder="" />
            
            
          </div>
          <div>
            <Label className="text-xs">Retry Count</Label>
            <Input
              type="number"
              value={step.retryCount}
              onChange={(e) => updateStep(steps, setSteps, index, "retryCount", parseInt(e.target.value))} />
            
          </div>
        </div>
        {/* OR Descriptor Picker */}
        <div className="mt-2">
          <Label className="text-xs flex items-center gap-1">
            <Database className="h-3 w-3" /> Link Object Repository Descriptor
          </Label>
          <Select
            value={step.or_element_id || ""}
            onValueChange={(v) => {
              if (v === "__none__") {
                // Unlink
                const updated = [...steps];
                updated[index] = {
                  ...updated[index],
                  or_element_id: undefined,
                  or_element_uid: undefined
                };
                setSteps(updated);
                return;
              }
              const el = orElements.find((e) => e.id === v);
              if (!el) return;
              const desc = el.descriptor?.primary || el.descriptor || {};
              const updated = [...steps];
              updated[index] = {
                ...updated[index],
                or_element_id: el.id,
                or_element_uid: el.element_uid,
                target: {
                  ...updated[index].target,
                  automationId: desc.automationId || desc.AutomationId || updated[index].target?.automationId || "",
                  label: desc.name || desc.Name || el.name || updated[index].target?.label || "",
                  controlType: el.element_type || updated[index].target?.controlType || "Button",
                  classHint: desc.className || desc.ClassName || updated[index].target?.classHint || ""
                }
              };
              setSteps(updated);
            }}>
            
            <SelectTrigger className={cn("text-xs", step.or_element_id && "border-primary/60 bg-primary/5")}>
              <SelectValue placeholder="Select from Object Repository..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— No descriptor linked —</SelectItem>
              {orElements.map((el) =>
              <SelectItem key={el.id} value={el.id}>
                  <span className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px] px-1 py-0">
                      {el.element_uid}
                    </Badge>
                    {el.name} <span className="text-muted-foreground">({el.element_type})</span>
                  </span>
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          {step.or_element_uid &&
          <p className="text-[10px] text-muted-foreground mt-0.5">
              Linked: <span className="font-mono text-primary">{step.or_element_uid}</span>
            </p>
          }
        </div>
      </Card>
      {/* Insert step between */}
      {index < totalSteps - 1 &&
      <div className="flex justify-center py-1">
          <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs text-muted-foreground hover:text-primary"
          onClick={() => insertStepAt(steps, setSteps, index + 1)}>
          
            <Plus className="h-3 w-3 mr-1" /> Insert step here
          </Button>
        </div>
      }
    </div>);

}

export function DesktopAutomation({ projectId }: DesktopAutomationProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"tests" | "results" | "selectors" | "self-healing" | "object-repo" | "robin-generator">("tests");
  const [testDetailSubTab, setTestDetailSubTab] = useState<"steps" | "payload">("steps");
  const [tests, setTests] = useState<DesktopTest[]>([]);
  const [selectedTest, setSelectedTest] = useState<DesktopTest | null>(null);
  const [results, setResults] = useState<ExecutionResult[]>([]);
  const [testResults, setTestResults] = useState<ExecutionResult[]>([]);
  const [healingLogs, setHealingLogs] = useState<SelfHealingLog[]>([]);
  const [selectors, setSelectors] = useState<SelectorEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const [orElements, setOrElements] = useState<ORElementBasic[]>([]);

  // Create test dialog
  const [showCreateTest, setShowCreateTest] = useState(false);
  const [newTest, setNewTest] = useState({
    name: "",
    description: "",
    application_name: "",
    application_path: "",
    engine_mode: "uia",
    steps: [] as any[]
  });

  // Record test dialog
  const [showRecordDialog, setShowRecordDialog] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingAgent, setRecordingAgent] = useState<string>("");
  const [recordTestName, setRecordTestName] = useState("");
  const [recordAppPath, setRecordAppPath] = useState("");
  const [recordEngineMode, setRecordEngineMode] = useState("uia");
  const [recordAppName, setRecordAppName] = useState("");
  const [recordedSteps, setRecordedSteps] = useState<any[]>([]);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [recordingJobId, setRecordingJobId] = useState<string | null>(null);
  const [availableAgents, setAvailableAgents] = useState<DesktopAgent[]>([]);
  const [isLoadingAgents, setIsLoadingAgents] = useState(false);
  const [recordingReviewMode, setRecordingReviewMode] = useState(false);
  const [reviewSteps, setReviewSteps] = useState<any[]>([]);
  const [recordingJobStatus, setRecordingJobStatus] = useState<string>("pending");
  const [recordingElapsed, setRecordingElapsed] = useState(0);
  const [recorderWizardStep, setRecorderWizardStep] = useState<"setup" | "recording" | "review">("setup");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [selectedRunAgent, setSelectedRunAgent] = useState<string>("");
  const [cloudFlowTriggerUrl, setCloudFlowTriggerUrl] = useState<string>("");
  const [isRunningCloudFlow, setIsRunningCloudFlow] = useState(false);
  const [padEnvironmentId, setPadEnvironmentId] = useState<string>("");
  const [padWorkflowId, setPadWorkflowId] = useState<string>("");
  const [padDataverseOrgUrl, setPadDataverseOrgUrl] = useState<string>("");
  const [showExecutionDetailDialog, setShowExecutionDetailDialog] = useState(false);
  const [selectedExecutionDetail, setSelectedExecutionDetail] = useState<ExecutionResult | null>(null);
  const [fullscreenScreenshot, setFullscreenScreenshot] = useState<string | null>(null);

  // Edit test dialog
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editTest, setEditTest] = useState<DesktopTest | null>(null);
  const [editSteps, setEditSteps] = useState<any[]>([]);

  // AI generation state
  const [aiGenerateDescription, setAiGenerateDescription] = useState("");
  const [isGeneratingSteps, setIsGeneratingSteps] = useState(false);
  const [showAIGenerateDialog, setShowAIGenerateDialog] = useState(false);
  const [aiGenerateTarget, setAiGenerateTarget] = useState<"new" | "edit">("new");
  const [isExtractingSelectors, setIsExtractingSelectors] = useState(false);
  const [aiSelectorTarget, setAiSelectorTarget] = useState<{steps: any[];applicationName: string;} | null>(null);
  const [showAISelectorDialog, setShowAISelectorDialog] = useState(false);
  const [aiExtractedSelectors, setAiExtractedSelectors] = useState<any[]>([]);

  // Convert test case state
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [availableTestCases, setAvailableTestCases] = useState<any[]>([]);
  const [selectedTestCaseId, setSelectedTestCaseId] = useState("");
  const [importAppName, setImportAppName] = useState("");
  const [importAppPath, setImportAppPath] = useState("");
  const [importEngineMode, setImportEngineMode] = useState("uia");
  const [importAgentId, setImportAgentId] = useState<string>("none");
  const [isConvertingTestCase, setIsConvertingTestCase] = useState(false);
  const [conversionPreview, setConversionPreview] = useState<{
    testCase: any;
    convertedSteps: any[];
    originalSteps: string[];
    capturedSelectors?: any[];
  } | null>(null);
  const [showConversionPreviewDialog, setShowConversionPreviewDialog] = useState(false);
  // Editable converted steps in preview
  const [editableConvertedSteps, setEditableConvertedSteps] = useState<any[]>([]);

  // Agent selector capture during conversion
  const [capturePhase, setCapturePhase] = useState<
    "idle" | "generating" | "dispatching" | "polling" | "fixing" | "done">(
    "idle");
  const [captureProgress, setCaptureProgress] = useState(0);
  const [captureMessage, setCaptureMessage] = useState("");
  const [capturedLiveSelectors, setCapturedLiveSelectors] = useState<any[]>([]);
  const [captureRetryCount, setCaptureRetryCount] = useState(0);
  const [livePolledSelectors, setLivePolledSelectors] = useState<any[]>([]);

  // Capture selector state
  const [showCaptureDialog, setShowCaptureDialog] = useState(false);
  const [captureStepIndex, setCaptureStepIndex] = useState<number>(-1);
  const [captureStepTarget, setCaptureStepTarget] = useState<"new" | "edit">("new");
  const [captureAgentId, setCaptureAgentId] = useState<string>("");
  const [isCapturingSelector, setIsCapturingSelector] = useState(false);
  const [captureSelectorMessage, setCaptureSelectorMessage] = useState("");
  const [expandedSelectorStep, setExpandedSelectorStep] = useState<number | null>(null);
  const [isDownloadingRecorder, setIsDownloadingRecorder] = useState(false);

  const downloadRecorderPackage = async () => {
    setIsDownloadingRecorder(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      const recorderFiles = [
      "RecorderApp.cs",
      "RecorderProgram.cs",
      "WisprDesktopRecorder.csproj",
      "Core/ApiClient.cs",
      "Core/TestExecutor.cs",
      "Core/FullActionRecorder.cs",
      "Core/NativeMethods.cs",
      "Core/Logger.cs",
      "Core/JavaAccessBridge.cs",
      "Core/RecorderCallback.cs",
      "Core/PowerAutomateIntegration.cs",
      "Core/RobinScriptParser.cs",
      "Core/RobinScriptWriter.cs",
      "Core/CloudFlowCreator.cs",
      "Core/DesktopFlowCreator.cs",
      "Core/DesktopFlowUpdater.cs",
      "Core/TokenCache.cs"];


      const results = await Promise.all(
        recorderFiles.map((f) => fetch(`/desktop-agent/${f}`).then((r) => r.ok ? r.text() : null))
      );

      recorderFiles.forEach((fileName, i) => {
        if (results[i]) {
          zip.file(fileName, results[i]!);
        }
      });

      // Add a quick-start README
      zip.file(
        "README.md",
        `# WISPR Desktop Test Recorder

## Prerequisites
- **Windows 10/11** (x64)
- **.NET 8 SDK** — https://dotnet.microsoft.com/download/dotnet/8.0
- **Java Access Bridge** enabled (for Java apps): \`jabswitch /enable\`

## Quick Start

\`\`\`powershell
# Build the recorder
dotnet build .\\WisprDesktopRecorder.csproj -c Release

# Run the recorder
dotnet run --project .\\WisprDesktopRecorder.csproj --framework net8.0-windows
\`\`\`

## Usage
1. Launch the recorder
2. Configure your API token (from WISPR → Desktop Automation)
3. Set the target application path and engine mode
4. Click Record and interact with your application
5. Review captured steps and save to the platform
`
      );

      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = "wispr-desktop-recorder.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Download Started",
        description: "Desktop Recorder package downloaded. Follow the README to build and run."
      });
    } catch (error) {
      console.error("Error downloading recorder:", error);
      toast({
        title: "Download Failed",
        description: "Could not download the recorder package.",
        variant: "destructive"
      });
    } finally {
      setIsDownloadingRecorder(false);
    }
  };

  const isAgentOnline = (agent: DesktopAgent) => {
    if (!agent.last_heartbeat) return false;
    return Date.now() - new Date(agent.last_heartbeat).getTime() < 120000;
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [testsRes, resultsRes, healingRes, selectorsRes] = await Promise.all([
    supabase.
    from("desktop_tests").
    select(
      "id, name, description, application_name, application_path, steps, status, engine_mode, tags, created_at"
    ).
    eq("project_id", projectId).
    order("created_at", { ascending: false }).
    limit(50),
    supabase.
    from("desktop_execution_results").
    select(
      "id, job_id, status, duration_ms, total_steps, passed_steps, failed_steps, failure_category, engine_mode, trace_id, created_at, step_results, error_message, screenshots"
    ).
    eq("project_id", projectId).
    order("created_at", { ascending: false }).
    limit(30),
    supabase.
    from("desktop_self_healing_logs").
    select("id, original_selector, suggested_selector, confidence_score, status, ai_analysis, created_at").
    eq("project_id", projectId).
    order("created_at", { ascending: false }).
    limit(20),
    supabase.
    from("desktop_selector_repository").
    select(
      "id, element_name, application_name, selector, fallback_selectors, version, is_active, validation_status"
    ).
    eq("project_id", projectId).
    eq("is_active", true).
    order("element_name")]
    );
    setTests(testsRes.data as any || []);
    setResults(resultsRes.data as any || []);
    setHealingLogs(healingRes.data as any || []);
    setSelectors(selectorsRes.data as any || []);

    // Fetch OR elements for descriptor picker
    const { data: orData } = await supabase.
    from("or_elements").
    select("id, element_uid, name, element_type, descriptor, screen_id").
    eq("project_id", projectId).
    eq("is_active", true).
    order("name");
    setOrElements(orData as any || []);

    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchData();
    loadAvailableAgents();
  }, [fetchData]);

  const loadTestResults = async (testId: string) => {
    setIsLoadingResults(true);
    const { data } = await supabase.
    from("desktop_execution_results").
    select(
      "id, job_id, status, duration_ms, total_steps, passed_steps, failed_steps, failure_category, engine_mode, trace_id, created_at, step_results, error_message, screenshots"
    ).
    eq("project_id", projectId).
    eq("test_id", testId).
    order("created_at", { ascending: false }).
    limit(20);
    setTestResults(data as any || []);
    setIsLoadingResults(false);
  };

  const openExecutionDetail = (result: ExecutionResult) => {
    setSelectedExecutionDetail(result);
    setShowExecutionDetailDialog(true);
  };

  const loadAvailableAgents = async () => {
    setIsLoadingAgents(true);
    const { data } = await supabase.
    from("self_hosted_agents").
    select("id, agent_name, status, last_heartbeat, agent_type").
    eq("project_id", projectId);
    setAvailableAgents(
      (data || []).map((a: any) => ({
        id: a.id,
        agent_name: a.agent_name,
        status: a.status,
        last_heartbeat: a.last_heartbeat
      }))
    );
    setIsLoadingAgents(false);
  };

  const loadTestCases = async () => {
    const { data } = await supabase.
    from("test_cases").
    select("id, title, description, structured_steps, steps, expected_result, user_stories(title)").
    eq("project_id", projectId).
    order("created_at", { ascending: false });
    setAvailableTestCases(data || []);
  };

  const handleConvertTestCase = async () => {
    if (!selectedTestCaseId) {
      toast({ title: "Select a test case first", variant: "destructive" });
      return;
    }
    const testCase = availableTestCases.find((tc) => tc.id === selectedTestCaseId);
    if (!testCase) return;

    setIsConvertingTestCase(true);
    setShowImportDialog(false);
    setCapturePhase("generating");
    setCaptureProgress(10);
    setCaptureMessage("AI is analyzing your test steps and generating automation script...");
    setCapturedLiveSelectors([]);
    setLivePolledSelectors([]);
    setCaptureRetryCount(0);

    try {
      // Step 1: Build steps text
      let originalSteps: string[] = [];
      let parsedStructuredSteps: any[] = [];

      if (testCase.structured_steps) {
        if (Array.isArray(testCase.structured_steps)) {
          parsedStructuredSteps = testCase.structured_steps;
        } else if (typeof testCase.structured_steps === "string") {
          try {
            parsedStructuredSteps = JSON.parse(testCase.structured_steps);
          } catch {

            /* ignore */}
        }
      }

      if (parsedStructuredSteps.length > 0) {
        originalSteps = parsedStructuredSteps.
        map((s: any) => {
          if (typeof s === "string") return s;
          const text = s.action || s.step || s.description || "";
          const data = s.testData || s.test_data || "";
          const expected = s.expectedResult || s.expected_result || "";
          let line = text;
          if (data) line += ` [Test Data: ${data}]`;
          if (expected) line += ` [Expected: ${expected}]`;
          return line.trim();
        }).
        filter((s: string) => s.length > 0);
      } else if (testCase.steps) {
        try {
          const parsed = JSON.parse(testCase.steps);
          originalSteps = Array.isArray(parsed) ? parsed : [testCase.steps];
        } catch {
          originalSteps = testCase.steps.split("\n").filter((s: string) => s.trim());
        }
      }

      const testDescription = [
      `Test Case: ${testCase.title}`,
      testCase.description ? `Description: ${testCase.description}` : "",
      "",
      "Steps:",
      ...originalSteps.map((s, i) => `${i + 1}. ${s}`),
      testCase.expected_result ? `\nExpected Result: ${testCase.expected_result}` : ""].

      filter(Boolean).
      join("\n");

      // Step 2: AI generate steps
      const { result } = await callAIFunction({
        mode: "generate_steps",
        projectId,
        testDescription,
        applicationName: importAppName
      });

      if (!Array.isArray(result)) throw new Error("AI returned invalid response");

      setCaptureProgress(40);

      // Step 3: If a real agent is selected, dispatch a capture job
      let capturedSelectors: any[] = [];
      const agentSelected = importAgentId && importAgentId !== "none" && importAgentId !== "__no_agents__";

      if (agentSelected && user) {
        setCapturePhase("dispatching");
        setCaptureMessage("Dispatching selector capture job to desktop agent — agent will launch the application...");
        setCaptureProgress(50);

        const { data: job, error: jobError } = await supabase.
        from("desktop_job_queue").
        insert({
          project_id: projectId,
          run_id: `CAP-${Date.now()}`,
          steps: result,
          application_path: importAppPath || null,
          application_name: importAppName,
          engine_mode: importEngineMode,
          created_by: user.id,
          status: "pending",
          agent_id: importAgentId,
          priority: 1
        }).
        select("id").
        single();

        if (!jobError && job) {
          setCapturePhase("polling");
          setCaptureMessage("Agent is launching the application and capturing live selectors...");

          // Poll for up to 3 minutes (36 × 5s)
          let attempt = 0;
          const maxAttempts = 36;
          let fixedSteps = result;
          let retries = 0;

          await new Promise<void>((resolve) => {
            const poll = setInterval(async () => {
              attempt++;
              const progress = 50 + Math.min(40, attempt / maxAttempts * 40);
              setCaptureProgress(progress);

              const { data: jobData } = await supabase.
              from("desktop_job_queue").
              select("status, recorded_steps").
              eq("id", job.id).
              single();

              // Update live selector preview as agent captures them
              if (
              jobData?.recorded_steps &&
              Array.isArray(jobData.recorded_steps) &&
              jobData.recorded_steps.length > 0)
              {
                setLivePolledSelectors(jobData.recorded_steps);
              }

              if (jobData?.status === "passed" || jobData?.status === "completed") {
                clearInterval(poll);
                if (jobData?.recorded_steps && Array.isArray(jobData.recorded_steps)) {
                  capturedSelectors = jobData.recorded_steps;
                  setCapturedLiveSelectors(capturedSelectors);
                  setCaptureMessage(`Agent captured ${capturedSelectors.length} live selector(s)!`);
                } else {
                  setCaptureMessage("Agent completed — using AI-generated selectors.");
                }
                resolve();
              } else if (jobData?.status === "failed") {
                clearInterval(poll);
                if (retries < 2) {
                  // Auto-fix failed steps with AI and re-dispatch
                  retries++;
                  setCapturePhase("fixing");
                  setCaptureRetryCount(retries);
                  setCaptureMessage(
                    `Agent encountered issues — AI is analyzing and fixing the steps (attempt ${retries})...`
                  );
                  try {
                    const { result: fixedResult } = await callAIFunction({
                      mode: "fix_failed_steps",
                      projectId,
                      existingSteps: fixedSteps,
                      applicationName: importAppName,
                      failureInfo: jobData
                    });
                    if (Array.isArray(fixedResult) && fixedResult.length > 0) {
                      fixedSteps = fixedResult;
                      setCaptureMessage(`AI fixed ${fixedResult.length} step(s). Re-dispatching to agent...`);
                      setCapturePhase("polling");
                      attempt = 0; // reset poll counter
                      // Re-dispatch with fixed steps
                      const { data: retryJob } = await supabase.
                      from("desktop_job_queue").
                      insert({
                        project_id: projectId,
                        run_id: `CAP-RETRY-${Date.now()}`,
                        steps: fixedResult,
                        application_path: importAppPath || null,
                        application_name: importAppName,
                        engine_mode: importEngineMode,
                        created_by: user.id,
                        status: "pending",
                        agent_id: importAgentId,
                        priority: 1
                      }).
                      select("id").
                      single();

                      if (retryJob) {
                        // Start a new polling loop for the retry job
                        const retryPoll = setInterval(async () => {
                          attempt++;
                          const p = 50 + Math.min(40, attempt / maxAttempts * 40);
                          setCaptureProgress(p);
                          const { data: retryData } = await supabase.
                          from("desktop_job_queue").
                          select("status, recorded_steps").
                          eq("id", retryJob.id).
                          single();
                          if (retryData?.recorded_steps && Array.isArray(retryData.recorded_steps)) {
                            setLivePolledSelectors(retryData.recorded_steps);
                          }
                          if (
                          retryData?.status === "passed" ||
                          retryData?.status === "completed" ||
                          retryData?.status === "failed" ||
                          attempt >= maxAttempts)
                          {
                            clearInterval(retryPoll);
                            if (
                            retryData?.recorded_steps &&
                            Array.isArray(retryData.recorded_steps) &&
                            retryData.recorded_steps.length > 0)
                            {
                              capturedSelectors = retryData.recorded_steps;
                              setCapturedLiveSelectors(capturedSelectors);
                              setCaptureMessage(
                                `Agent captured ${capturedSelectors.length} live selector(s) after fix!`
                              );
                            } else {
                              setCaptureMessage("Retry complete — using AI-generated selectors.");
                            }
                            resolve();
                          }
                        }, 5000);
                        return; // don't resolve yet — wait for retryPoll
                      }
                    }
                  } catch {

                    /* ignore fix errors */}
                }
                setCaptureMessage("Agent could not complete — using AI-generated selectors only.");
                resolve();
              } else if (attempt >= maxAttempts) {
                clearInterval(poll);
                setCaptureMessage("Agent timed out — using AI-generated selectors only.");
                resolve();
              }
            }, 5000);
          });
        } else {
          setCaptureMessage("Could not dispatch to agent — using AI-generated selectors.");
        }
      }

      setCaptureProgress(95);
      setCapturePhase("done");
      setCaptureMessage("Conversion complete!");

      const finalPreview = {
        testCase,
        convertedSteps: result,
        originalSteps,
        capturedSelectors: capturedSelectors.length > 0 ? capturedSelectors : undefined
      };
      setConversionPreview(finalPreview);
      setEditableConvertedSteps([...result]);
      setShowConversionPreviewDialog(true);
    } catch (err: any) {
      toast({ title: "Conversion failed", description: err.message, variant: "destructive" });
      setShowImportDialog(true);
    } finally {
      setIsConvertingTestCase(false);
      setCapturePhase("idle");
      setCaptureProgress(0);
    }
  };

  const handleSaveConvertedTest = async () => {
    if (!conversionPreview || !user) return;
    const { testCase, capturedSelectors } = conversionPreview;
    // Use editable steps (user may have modified them in preview)
    const stepsToSave = editableConvertedSteps.length > 0 ? editableConvertedSteps : conversionPreview.convertedSteps;

    const { error } = await supabase.from("desktop_tests").insert({
      project_id: projectId,
      name: testCase.title,
      description: testCase.description || null,
      application_name: importAppName,
      application_path: importAppPath || null,
      engine_mode: importEngineMode,
      steps: stepsToSave,
      created_by: user.id
    });
    if (error) {
      toast({ title: "Error saving test", description: error.message, variant: "destructive" });
      return;
    }

    // Save AI-extracted selectors from steps
    await extractAndSaveSelectors(stepsToSave, importAppName);

    // If the agent captured live selectors, also save those (higher priority - they are real)
    if (capturedSelectors && capturedSelectors.length > 0) {
      const liveRows = capturedSelectors.
      filter((s: any) => s.element_name || s.automationId || s.label).
      map((s: any) => ({
        project_id: projectId,
        element_name: s.element_name || s.label || s.automationId || "captured-element",
        application_name: importAppName,
        selector: s.selector || s,
        fallback_selectors: s.fallback_selectors || [],
        version: 1,
        is_active: true,
        validation_status: "valid", // live-captured = validated
        created_by: user.id
      }));
      if (liveRows.length > 0) {
        await supabase.from("desktop_selector_repository").upsert(liveRows, { onConflict: "project_id,element_name" });
      }
    }

    const selectorCount =
    (capturedSelectors?.length || 0) > 0 ?
    `${capturedSelectors!.length} live + AI selectors saved` :
    `${stepsToSave.length} step(s)`;
    toast({ title: "Test created from test case", description: `"${testCase.title}" converted. ${selectorCount}.` });
    setShowConversionPreviewDialog(false);
    setConversionPreview(null);
    setEditableConvertedSteps([]);
    setSelectedTestCaseId("");
    setImportAgentId("none");
    fetchData();
  };

  const extractAndSaveSelectors = async (steps: any[], applicationName: string) => {
    if (!steps || steps.length === 0 || !user) return;
    const selectors: {element_name: string;selector: any;}[] = [];
    for (const step of steps) {
      const target = step.target || step.selector;
      if (!target) continue;
      const elementName = target.label || target.automationId || target.name || step.action;
      if (!elementName || elementName === "launch_app") continue;
      // Deduplicate by element name
      if (selectors.some((s) => s.element_name === elementName)) continue;
      selectors.push({ element_name: elementName, selector: target });
    }
    if (selectors.length === 0) return;
    // Check existing selectors to avoid duplicates
    const { data: existing } = await supabase.
    from("desktop_selector_repository").
    select("element_name").
    eq("project_id", projectId).
    eq("is_active", true).
    in(
      "element_name",
      selectors.map((s) => s.element_name)
    );
    const existingNames = new Set((existing || []).map((e: any) => e.element_name));
    const newSelectors = selectors.filter((s) => !existingNames.has(s.element_name));
    if (newSelectors.length === 0) return;
    const rows = newSelectors.map((s) => ({
      project_id: projectId,
      element_name: s.element_name,
      application_name: applicationName,
      selector: s.selector,
      fallback_selectors: [],
      version: 1,
      is_active: true,
      validation_status: "unvalidated",
      created_by: user.id
    }));
    await supabase.from("desktop_selector_repository").insert(rows);
  };

  const callAIFunction = async (body: object) => {
    const {
      data: { session }
    } = await supabase.auth.getSession();
    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-desktop-automation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token || SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "AI request failed");
    }
    return response.json();
  };

  const handleAIGenerateSteps = async () => {
    if (!aiGenerateDescription.trim()) return;
    const appName = aiGenerateTarget === "new" ? newTest.application_name : editTest?.application_name || "";
    setIsGeneratingSteps(true);
    try {
      const engineMode = aiGenerateTarget === "new" ? newTest.engine_mode : editTest?.engine_mode || "uia";
      const { result } = await callAIFunction({
        mode: "generate_steps",
        projectId,
        testDescription: aiGenerateDescription,
        applicationName: appName,
        engineMode
      });
      if (!Array.isArray(result)) throw new Error("Invalid response from AI");
      if (aiGenerateTarget === "new") {
        setNewTest((p) => ({ ...p, steps: result }));
      } else {
        setEditSteps(result);
      }
      setShowAIGenerateDialog(false);
      setAiGenerateDescription("");
      toast({
        title: `${result.length} automation steps generated`,
        description: "Review and adjust the steps before saving"
      });
    } catch (err: any) {
      toast({ title: "AI generation failed", description: err.message, variant: "destructive" });
    } finally {
      setIsGeneratingSteps(false);
    }
  };

  const handleAIExtractSelectors = async (steps: any[], applicationName: string) => {
    if (!steps || steps.length === 0) {
      toast({ title: "No steps to extract selectors from", variant: "destructive" });
      return;
    }
    setAiSelectorTarget({ steps, applicationName });
    setAiExtractedSelectors([]);
    setShowAISelectorDialog(true);
    setIsExtractingSelectors(true);
    try {
      const { result } = await callAIFunction({
        mode: "extract_selectors",
        projectId,
        existingSteps: steps,
        applicationName
      });
      if (!Array.isArray(result)) throw new Error("Invalid response from AI");
      setAiExtractedSelectors(result);
    } catch (err: any) {
      toast({ title: "Selector extraction failed", description: err.message, variant: "destructive" });
      setShowAISelectorDialog(false);
    } finally {
      setIsExtractingSelectors(false);
    }
  };

  const saveAIExtractedSelectors = async () => {
    if (!aiExtractedSelectors.length || !aiSelectorTarget || !user) return;
    const { applicationName } = aiSelectorTarget;
    const { data: existing } = await supabase.
    from("desktop_selector_repository").
    select("element_name").
    eq("project_id", projectId).
    eq("is_active", true).
    in(
      "element_name",
      aiExtractedSelectors.map((s) => s.element_name)
    );
    const existingNames = new Set((existing || []).map((e: any) => e.element_name));
    const toInsert = aiExtractedSelectors.
    filter((s) => !existingNames.has(s.element_name)).
    map((s) => ({
      project_id: projectId,
      element_name: s.element_name,
      application_name: applicationName,
      selector: s.selector,
      fallback_selectors: s.fallback_selectors || [],
      version: 1,
      is_active: true,
      validation_status: "unvalidated",
      created_by: user.id
    }));
    if (toInsert.length > 0) {
      const { error } = await supabase.from("desktop_selector_repository").insert(toInsert);
      if (error) {
        toast({ title: "Error saving selectors", description: error.message, variant: "destructive" });
        return;
      }
    }
    toast({
      title: `${toInsert.length} new selectors saved to repository`,
      description: existingNames.size > 0 ? `${existingNames.size} already existed and were skipped` : undefined
    });
    setShowAISelectorDialog(false);
    setAiExtractedSelectors([]);
    fetchData();
  };

  const createTest = async () => {
    if (!newTest.name || !user) return;
    const { error } = await supabase.from("desktop_tests").insert({
      project_id: projectId,
      name: newTest.name,
      description: newTest.description || null,
      application_name: newTest.application_name,
      application_path: newTest.application_path || null,
      engine_mode: newTest.engine_mode,
      steps: newTest.steps,
      created_by: user.id
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    // Extract selectors from test steps into repository
    await extractAndSaveSelectors(newTest.steps, newTest.application_name);
    toast({ title: "Test created" });
    setShowCreateTest(false);
    setNewTest({
      name: "",
      description: "",
      application_name: "AppName",
      application_path: "",
      engine_mode: "uia",
      steps: []
    });
    fetchData();
  };

  const runTest = async (test: DesktopTest) => {
    if (!user) return;

    // PAD engine mode requires EITHER a Cloud Flow trigger URL (web execution)
    // OR a PAD Environment ID + Workflow ID (local execution via desktop agent).
    const normalizedCloudFlowTriggerUrl = cloudFlowTriggerUrl.trim();
    const normalizedPadEnvironmentId = padEnvironmentId.trim();
    const normalizedPadWorkflowId = padWorkflowId.trim();
    const normalizedPadDataverseOrgUrl = padDataverseOrgUrl.trim();
    const hasPadLocalIds = normalizedPadEnvironmentId && normalizedPadWorkflowId;
    if (test.engine_mode === "pad" && !cloudFlowTriggerUrl.trim() && !hasPadLocalIds) {
      toast({
        title: "PAD execution target required",
        description: "Provide either a Cloud Flow HTTP Trigger URL, or a PAD Environment ID and Workflow ID for local desktop agent execution.",
        variant: "destructive",
      });
      return;
    }

    if (test.engine_mode === "pad" && !normalizedCloudFlowTriggerUrl && hasPadLocalIds && !normalizedPadDataverseOrgUrl) {
      toast({
        title: "Dataverse URL required",
        description: "Provide the Dataverse URL so the desktop agent can update the PAD flow with the latest test steps before execution.",
        variant: "destructive",
      });
      return;
    }

    // Priority 1: Cloud Flow HTTP trigger (web execution) — full payload with steps
    if (test.engine_mode === "pad" && cloudFlowTriggerUrl.trim()) {
      setIsRunningCloudFlow(true);
      try {
        const steps = Array.isArray(test.steps) ? test.steps : [];
        const payload = {
          testCaseId: test.id,
          environment: "staging",
          browser: "chrome",
          onFailure: "screenshot_and_continue",
          steps: steps.map((step: any, index: number) => ({
            stepId: index + 1,
            action: step.action || "click",
            params: {
              value: step.value || "",
              selector: step.target?.parentWindow || step.target?.automationId || "",
              label: step.target?.label || "",
              control: step.target?.controlType || "",
            },
          })),
          reportTo: `${SUPABASE_URL}/functions/v1/desktop-agent-api`,
          triggeredAt: new Date().toISOString(),
        };
        const response = await fetch(cloudFlowTriggerUrl.trim(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const responseText = await response.text();
        let webhookResponse: any = responseText;
        try { webhookResponse = JSON.parse(responseText); } catch { /* keep as string */ }

        // Insert test_runs record
        await supabase.from("test_runs").insert({
          project_id: projectId,
          name: `Cloud Run: ${test.name}`,
          created_by: user.id,
          status: "running",
          run_type: "cloud_flow",
          payload_sent: payload as any,
          webhook_response: webhookResponse,
        } as any);

        if (response.ok) {
          toast({
            title: "☁️ Flow triggered — watching for results...",
            description: `"${test.name}" triggered via Cloud Flow. Status: ${response.status}`,
          });
          setActiveTab("results");
        } else {
          toast({
            title: "☁️ Cloud Flow Execution Failed",
            description: `HTTP ${response.status}: ${responseText.substring(0, 200)}`,
            variant: "destructive",
          });
        }
      } catch (err: any) {
        toast({
          title: "☁️ Cloud Flow Trigger Error",
          description: err.message || "Failed to reach Cloud Flow trigger URL",
          variant: "destructive",
        });
      } finally {
        setIsRunningCloudFlow(false);
      }
      return;
    }

    // Priority 2: Queue to desktop agent (PAD local or other engine modes)
    const insertData: any = {
      project_id: projectId,
      test_id: test.id,
      run_id: `DESK-${Date.now()}`,
      steps:
        test.engine_mode === "pad" && Array.isArray(test.steps)
          ? test.steps.map((step: any, index: number) =>
              index === 0
                ? {
                    ...step,
                    __pad_environment_id: normalizedPadEnvironmentId || undefined,
                    __pad_workflow_id: normalizedPadWorkflowId || undefined,
                    __cloud_flow_trigger_url: normalizedCloudFlowTriggerUrl || undefined,
                    __pad_dataverse_org_url: normalizedPadDataverseOrgUrl || undefined,
                  }
                : step,
            )
          : test.steps,
      application_path: test.application_path,
      engine_mode: test.engine_mode,
      created_by: user.id
    };
    if (selectedRunAgent && selectedRunAgent !== "any") {
      insertData.agent_id = selectedRunAgent;
    }
    // Pass PAD-specific metadata for agent-side execution
    if (test.engine_mode === "pad") {
      if (normalizedCloudFlowTriggerUrl) {
        insertData.cloud_flow_trigger_url = normalizedCloudFlowTriggerUrl;
      }
      if (normalizedPadEnvironmentId) {
        insertData.pad_environment_id = normalizedPadEnvironmentId;
      }
      if (normalizedPadWorkflowId) {
        insertData.pad_workflow_id = normalizedPadWorkflowId;
      }
    }
    const { error } = await supabase.from("desktop_job_queue").insert(insertData);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: "Test queued for execution",
      description: `"${test.name}" queued to desktop agent for ${test.engine_mode === "pad" ? `PAD (Env: ${padEnvironmentId || "n/a"}, Flow: ${padWorkflowId || "n/a"})` : "local"} execution`,
    });
  };

  const deleteTest = async (id: string) => {
    await supabase.from("desktop_tests").delete().eq("id", id);
    if (selectedTest?.id === id) setSelectedTest(null);
    fetchData();
  };

  const approveHeal = async (id: string) => {
    await supabase.
    from("desktop_self_healing_logs").
    update({ status: "approved", applied_at: new Date().toISOString(), reviewed_by: user?.id }).
    eq("id", id);
    toast({ title: "Selector fix approved" });
    fetchData();
  };

  const rejectHeal = async (id: string) => {
    await supabase.from("desktop_self_healing_logs").update({ status: "rejected", reviewed_by: user?.id }).eq("id", id);
    toast({ title: "Selector fix rejected" });
    fetchData();
  };

  const addStep = (stepsState: any[], setStepsState: (s: any[]) => void) => {
    setStepsState([...stepsState, createEmptyStep()]);
  };

  const createEmptyStep = () => ({
    stepId: `step-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    action: "click",
    target: { automationId: "", label: "", controlType: "Button", classHint: "", parentWindow: "" },
    value: "",
    waitCondition: "element_exists",
    timeoutSeconds: 30,
    retryCount: 1,
    failureCategoryHint: "element_not_found",
    popupHandling: { enabled: false, knownPopups: [] }
  });

  const insertStepAt = (steps: any[], setSteps: (s: any[]) => void, index: number) => {
    const updated = [...steps];
    updated.splice(index, 0, createEmptyStep());
    setSteps(updated);
  };

  const handleDragEnd = (event: DragEndEvent, steps: any[], setSteps: (s: any[]) => void) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = steps.findIndex((s) => s.stepId === active.id);
      const newIndex = steps.findIndex((s) => s.stepId === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        setSteps(arrayMove(steps, oldIndex, newIndex));
      }
    }
  };

  const moveStepUp = (steps: any[], setSteps: (s: any[]) => void, index: number) => {
    if (index <= 0) return;
    setSteps(arrayMove(steps, index, index - 1));
  };

  const moveStepDown = (steps: any[], setSteps: (s: any[]) => void, index: number) => {
    if (index >= steps.length - 1) return;
    setSteps(arrayMove(steps, index, index + 1));
  };

  const updateStep = (steps: any[], setSteps: (s: any[]) => void, index: number, field: string, value: any) => {
    const updated = [...steps];
    if (field.startsWith("target.")) {
      const targetField = field.replace("target.", "");
      updated[index] = { ...updated[index], target: { ...updated[index].target, [targetField]: value } };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setSteps(updated);
  };

  const removeStep = (steps: any[], setSteps: (s: any[]) => void, index: number) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  const handleEditTest = (test: DesktopTest) => {
    setEditTest(test);
    setEditSteps(Array.isArray(test.steps) ? [...test.steps] : []);
    setShowEditDialog(true);
  };

  const handleCaptureSelector = (stepIndex: number, target: "new" | "edit") => {
    setCaptureStepIndex(stepIndex);
    setCaptureStepTarget(target);
    setCaptureAgentId("");
    setCaptureSelectorMessage("");
    setShowCaptureDialog(true);
    loadAvailableAgents();
  };

  const startSelectorCapture = async () => {
    if (!captureAgentId || !user) return;
    setIsCapturingSelector(true);
    setCaptureSelectorMessage("Dispatching capture job to agent — click an element in your application...");

    try {
      const appPath = captureStepTarget === "new" ? newTest.application_path : editTest?.application_path || "";
      const appName = captureStepTarget === "new" ? newTest.application_name : editTest?.application_name || "";

      const { data: job, error: jobError } = await supabase.
      from("desktop_job_queue").
      insert({
        project_id: projectId,
        run_id: `CAPTURE-${Date.now()}`,
        steps: [{ action: "capture_element", application_name: appName }],
        application_path: appPath || null,
        engine_mode: "uia",
        created_by: user.id,
        status: "pending",
        agent_id: captureAgentId,
        priority: 0
      }).
      select("id").
      single();

      if (jobError || !job) {
        throw new Error(jobError?.message || "Failed to create capture job");
      }

      setCaptureSelectorMessage("Waiting for you to click an element in the application...");

      // Poll for result up to 60 seconds
      let attempt = 0;
      const maxAttempts = 30;
      const pollResult = await new Promise<any>((resolve) => {
        const poll = setInterval(async () => {
          attempt++;
          const { data: jobData } = await supabase.
          from("desktop_job_queue").
          select("status, recorded_steps").
          eq("id", job.id).
          single();

          if (jobData?.status === "completed" || jobData?.status === "passed") {
            clearInterval(poll);
            const captured = jobData.recorded_steps?.[0];
            resolve(captured || null);
          } else if (jobData?.status === "failed" || attempt >= maxAttempts) {
            clearInterval(poll);
            resolve(null);
          }
        }, 2000);
      });

      if (pollResult) {
        // Populate the step's target fields
        const stepsRef = captureStepTarget === "new" ? newTest.steps : editSteps;
        const setStepsRef =
        captureStepTarget === "new" ? (s: any[]) => setNewTest((p) => ({ ...p, steps: s })) : setEditSteps;
        const updated = [...stepsRef];
        if (updated[captureStepIndex]) {
          updated[captureStepIndex] = {
            ...updated[captureStepIndex],
            target: {
              ...updated[captureStepIndex].target,
              automationId: pollResult.automationId || pollResult.selector?.automationId || "",
              label: pollResult.label || pollResult.name || pollResult.selector?.label || "",
              controlType:
              pollResult.controlType ||
              pollResult.selector?.controlType ||
              updated[captureStepIndex].target?.controlType ||
              "Button",
              classHint: pollResult.className || pollResult.selector?.classHint || "",
              parentWindow: pollResult.parentWindow || pollResult.selector?.parentWindow || ""
            }
          };
          setStepsRef(updated);
        }
        setCaptureSelectorMessage("Element captured successfully!");
        toast({
          title: "Selector captured",
          description: `Element "${pollResult.label || pollResult.automationId || "unknown"}" captured from the application.`
        });
        setTimeout(() => setShowCaptureDialog(false), 1000);
      } else {
        setCaptureSelectorMessage("Capture timed out or failed. Try again.");
      }
    } catch (err: any) {
      setCaptureSelectorMessage(`Error: ${err.message}`);
      toast({ title: "Capture failed", description: err.message, variant: "destructive" });
    } finally {
      setIsCapturingSelector(false);
    }
  };

  const saveEditTest = async () => {
    if (!editTest) return;
    const { error } = await supabase.
    from("desktop_tests").
    update({
      name: editTest.name,
      description: editTest.description,
      application_name: editTest.application_name,
      application_path: editTest.application_path,
      engine_mode: editTest.engine_mode,
      steps: editSteps
    }).
    eq("id", editTest.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Test updated" });
    setShowEditDialog(false);
    fetchData();
  };

  const handleStartRecording = async () => {
    if (!recordTestName || !recordingAgent) {
      toast({
        title: "Missing fields",
        description: "Please enter a test name and select an agent",
        variant: "destructive"
      });
      return;
    }
    setIsRecording(true);
    setRecorderWizardStep("recording");
    setRecordedSteps([]);
    setRecordingProgress(0);
    setRecordingJobStatus("pending");
    setRecordingElapsed(0);

    // Queue a recording job to the desktop agent
    // For PAD mode, instruct agent to launch Power Automate Desktop recorder
    const isPadMode = recordEngineMode === "pad";
    const recordSteps = isPadMode
      ? [{ action: "pad_record", application_name: recordAppName, application_path: recordAppPath, launch_pad_designer: true }]
      : [{ action: "record", application_name: recordAppName, application_path: recordAppPath }];

    const { data, error } = await supabase.
    from("desktop_job_queue").
    insert({
      project_id: projectId,
      run_id: `REC-${Date.now()}`,
      steps: recordSteps,
      application_path: recordAppPath,
      engine_mode: recordEngineMode,
      created_by: user?.id,
      status: "pending",
      agent_id: recordingAgent
    }).
    select("id").
    single();

    if (error || !data) {
      toast({
        title: "Error",
        description: "Failed to start recording session. " + (error?.message || ""),
        variant: "destructive"
      });
      setIsRecording(false);
      return;
    }

    setRecordingJobId(data.id);
    toast({
      title: isPadMode ? "Power Automate Recording started" : "Recording started",
      description: isPadMode
        ? "The agent will launch Power Automate Desktop recorder. Perform your actions in the target application."
        : "Perform actions in the desktop application. The agent will capture your interactions."
    });

    // Elapsed timer
    const elapsedInterval = setInterval(() => {
      setRecordingElapsed((prev) => prev + 1);
    }, 1000);
    (window as any).__recordingElapsedInterval = elapsedInterval;

    // Poll for recorded steps every 2 seconds
    const pollInterval = setInterval(async () => {
      try {
        const { data: job } = await supabase.
        from("desktop_job_queue").
        select("recorded_steps, status").
        eq("id", data.id).
        single();

        if (job?.status) {
          setRecordingJobStatus(job.status);
        }

        if (job?.recorded_steps && Array.isArray(job.recorded_steps)) {
          setRecordedSteps(job.recorded_steps);
          setRecordingProgress(Math.min(95, job.recorded_steps.length * 5));
        }

        // Stop polling if job completed
        if (job?.status === "passed" || job?.status === "completed" || job?.status === "failed") {
          clearInterval(pollInterval);
          clearInterval(elapsedInterval);
        }
      } catch {

        /* ignore polling errors */}
    }, 2000);

    // Store interval ID for cleanup
    (window as any).__recordingPollInterval = pollInterval;
  };

  const handleStopRecording = async () => {
    setIsRecording(false);
    setRecordingProgress(100);

    // Clear polling intervals
    if ((window as any).__recordingPollInterval) {
      clearInterval((window as any).__recordingPollInterval);
      delete (window as any).__recordingPollInterval;
    }
    if ((window as any).__recordingElapsedInterval) {
      clearInterval((window as any).__recordingElapsedInterval);
      delete (window as any).__recordingElapsedInterval;
    }

    // Signal the agent to stop recording
    if (recordingJobId) {
      try {
        await supabase.
        from("desktop_job_queue").
        update({ status: "stopped", completed_at: new Date().toISOString() }).
        eq("id", recordingJobId);
      } catch (e) {
        console.error("Failed to signal agent to stop recording:", e);
      }
    }

    // Fetch final recorded steps and enter review mode
    if (recordingJobId) {
      const { data: job } = await supabase.
      from("desktop_job_queue").
      select("recorded_steps").
      eq("id", recordingJobId).
      single();

      const finalSteps = job?.recorded_steps && Array.isArray(job.recorded_steps) ? job.recorded_steps : recordedSteps;

      const stepsForReview =
      finalSteps.length > 0 ?
      finalSteps.map((s: any, i: number) => ({
        ...s,
        stepId: s.stepId || `step-${Date.now()}-${i}`,
        target: s.target || {
          automationId: s.automationId || "",
          label: s.label || s.name || "",
          controlType: s.controlType || "Button",
          classHint: s.className || "",
          parentWindow: s.parentWindow || ""
        },
        action: s.action || "click",
        value: s.value || "",
        waitCondition: s.waitCondition || "element_exists",
        timeoutSeconds: s.timeoutSeconds || 30,
        retryCount: s.retryCount || 1
      })) :
      [];

      setReviewSteps(stepsForReview);
    }

    setRecordingReviewMode(true);
    setRecorderWizardStep("review");
    toast({ title: "Recording stopped", description: "Review and edit the captured steps before saving." });
  };

  const handleSaveRecordedTest = async () => {
    if (!user) return;
    const stepsToSave =
    reviewSteps.length > 0 ?
    reviewSteps :
    [
    {
      stepId: `step-${Date.now()}`,
      action: "launch_app",
      target: {
        automationId: "",
        label: recordAppName,
        controlType: "Window",
        classHint: "",
        parentWindow: ""
      },
      value: recordAppPath,
      waitCondition: "element_exists",
      timeoutSeconds: 30,
      retryCount: 1
    }];


    const { error } = await supabase.from("desktop_tests").insert({
      project_id: projectId,
      name: recordTestName,
      description: `Recorded from ${recordAppName} desktop session`,
      application_name: recordAppName,
      application_path: recordAppPath || null,
      engine_mode: recordEngineMode,
      steps: stepsToSave,
      created_by: user.id
    });

    if (!error) {
      await extractAndSaveSelectors(stepsToSave, recordAppName);
      toast({
        title: "Test created from recording",
        description: `"${recordTestName}" saved with ${stepsToSave.length} step(s)`
      });
      fetchData();
    } else {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }

    handleCloseRecordDialog();
  };

  const handleCloseRecordDialog = () => {
    // Clean up timers
    if ((window as any).__recordingPollInterval) {
      clearInterval((window as any).__recordingPollInterval);
      delete (window as any).__recordingPollInterval;
    }
    if ((window as any).__recordingElapsedInterval) {
      clearInterval((window as any).__recordingElapsedInterval);
      delete (window as any).__recordingElapsedInterval;
    }
    setShowRecordDialog(false);
    setIsRecording(false);
    setRecordTestName("");
    setRecordAppPath("");
    setRecordAppName("");
    setRecordEngineMode("uia");
    setRecordedSteps([]);
    setRecordingProgress(0);
    setRecordingJobId(null);
    setRecordingReviewMode(false);
    setReviewSteps([]);
    setRecordingJobStatus("pending");
    setRecordingElapsed(0);
    setRecorderWizardStep("setup");
  };

  const handleCloneTest = async (test: DesktopTest) => {
    if (!user) return;
    const { error } = await supabase.from("desktop_tests").insert({
      project_id: projectId,
      name: `${test.name} (Copy)`,
      description: test.description,
      application_name: test.application_name,
      application_path: test.application_path,
      engine_mode: test.engine_mode,
      steps: test.steps,
      created_by: user.id
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Test cloned" });
    fetchData();
  };

  const updateTestStatus = async (testId: string, newStatus: string) => {
    await supabase.from("desktop_tests").update({ status: newStatus }).eq("id", testId);
    setTests((prev) => prev.map((t) => t.id === testId ? { ...t, status: newStatus } : t));
    if (selectedTest?.id === testId) {
      setSelectedTest((prev) => prev ? { ...prev, status: newStatus } : null);
    }
  };

  const statusBadge = (status: string) => {
    const variants: Record<string, string> = {
      online: "bg-green-500/10 text-green-500 border-green-500/30",
      offline: "bg-muted text-muted-foreground border-border",
      passed: "bg-green-500/10 text-green-500 border-green-500/30",
      failed: "bg-destructive/10 text-destructive border-destructive/30",
      pending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30",
      running: "bg-blue-500/10 text-blue-500 border-blue-500/30",
      auto_applied: "bg-green-500/10 text-green-500 border-green-500/30",
      approved: "bg-green-500/10 text-green-500 border-green-500/30",
      rejected: "bg-destructive/10 text-destructive border-destructive/30",
      draft: "bg-muted text-muted-foreground border-border"
    };
    return (
      <Badge variant="outline" className={variants[status] || ""}>
        {status}
      </Badge>);

  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "passed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-destructive" />;
      case "running":
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const renderStepEditor = (steps: any[], setSteps: (s: any[]) => void, target: "new" | "edit" = "new") => {
    // Ensure each step has a stable stepId
    const stepsWithIds = steps.map((s, i) => ({
      ...s,
      stepId: s.stepId || `step-${i}-${Date.now()}`
    }));
    if (stepsWithIds.some((s, i) => s.stepId !== steps[i]?.stepId)) {
      setSteps(stepsWithIds);
    }

    return (
      <div className="space-y-1">
        <div className="flex justify-between items-center mb-3">
          <Label className="text-base font-semibold">Test Steps</Label>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setAiGenerateTarget(target);
                setShowAIGenerateDialog(true);
              }}
              className="border-primary/40 text-primary hover:bg-primary/5">
              
              <Sparkles className="h-3 w-3 mr-1" /> AI Generate Steps
            </Button>
            {steps.length > 0 &&
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const appName = target === "new" ? newTest.application_name : editTest?.application_name || "";
                handleAIExtractSelectors(steps, appName);
              }}
              className="border-primary/40 text-primary hover:bg-primary/5">
              
                <Crosshair className="h-3 w-3 mr-1" /> AI Extract Selectors
              </Button>
            }
            <Button variant="outline" size="sm" onClick={() => addStep(steps, setSteps)}>
              <Plus className="h-3 w-3 mr-1" /> Add Step
            </Button>
          </div>
        </div>

        {/* Insert before first step */}
        {steps.length > 0 &&
        <div className="flex justify-center py-1">
            <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs text-muted-foreground hover:text-primary"
            onClick={() => insertStepAt(steps, setSteps, 0)}>
            
              <Plus className="h-3 w-3 mr-1" /> Insert step here
            </Button>
          </div>
        }

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(e) => handleDragEnd(e, steps, setSteps)}>
          
          <SortableContext
            items={steps.map((s) => s.stepId || `fallback-${Math.random()}`)}
            strategy={verticalListSortingStrategy}>
            
            {steps.map((step, i) =>
            <SortableStepCard
              key={step.stepId || i}
              step={step}
              index={i}
              totalSteps={steps.length}
              steps={steps}
              setSteps={setSteps}
              target={target}
              updateStep={updateStep}
              removeStep={removeStep}
              insertStepAt={insertStepAt}
              moveStepUp={moveStepUp}
              moveStepDown={moveStepDown}
              handleCaptureSelector={handleCaptureSelector}
              orElements={orElements} />

            )}
          </SortableContext>
        </DndContext>

        {steps.length === 0 &&
        <div className="text-center py-6 text-muted-foreground border-2 border-dashed rounded-lg">
            <Plus className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No steps yet. Click "Add Step" to begin.</p>
          </div>
        }
      </div>);

  };

  return (
    <div className="space-y-6">
      {/* Header — matching NoCode style */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Desktop Automation</h1>
          <p className="text-muted-foreground mt-2">Automate desktop applications using UIA, JAB and Vision engines</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={downloadRecorderPackage} disabled={isDownloadingRecorder}>
            {isDownloadingRecorder ?
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> :

            <Download className="mr-2 h-4 w-4" />
            }
            Download Recorder
          </Button>
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
          {activeTab === "tests" &&
          <>
              <Button
              variant="outline"
              onClick={() => {
                setShowRecordDialog(true);
                loadAvailableAgents();
              }}>
              
                <Video className="mr-2 h-4 w-4" />
                Record Test
              </Button>
              <Button
              variant="outline"
              onClick={() => {
                loadTestCases();
                setShowImportDialog(true);
              }}>
              
                <Upload className="mr-2 h-4 w-4" />
                Convert Test Case
              </Button>
              <Button onClick={() => setShowCreateTest(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Test
              </Button>
            </>
          }
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList>
          <TabsTrigger value="tests">
            <Play className="mr-2 h-4 w-4" />
            Tests
          </TabsTrigger>
          <TabsTrigger value="results">
            <Activity className="mr-2 h-4 w-4" />
            Execution Results
          </TabsTrigger>
          <TabsTrigger value="selectors">
            <Crosshair className="mr-2 h-4 w-4" />
            Selector Repository
          </TabsTrigger>
          <TabsTrigger value="self-healing">
            <Wand2 className="mr-2 h-4 w-4" />
            Self-Healing
          </TabsTrigger>
          <TabsTrigger value="object-repo">
            <Database className="mr-2 h-4 w-4" />
            Object Repository
          </TabsTrigger>
          <TabsTrigger value="robin-generator">
            <FileText className="mr-2 h-4 w-4" />
            Robin Generator
          </TabsTrigger>
        </TabsList>

        {/* Tests Tab — Split Panel */}
        <TabsContent value="tests" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Test List Panel */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Tests</CardTitle>
                    <CardDescription>Your desktop test scenarios</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ?
                <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div> :
                tests.length === 0 ?
                <div className="text-center py-8 text-muted-foreground">
                    <Monitor className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">No desktop tests yet</p>
                    <p className="text-sm mt-1">Create your first test case</p>
                  </div> :

                <ScrollArea className="h-[600px] pr-4  overflow-auto">
                    <div className="space-y-2">
                      {tests.map((test) =>
                    <Card
                      key={test.id}
                      className={cn(
                        "cursor-pointer transition-all hover:shadow-md",
                        selectedTest?.id === test.id && "ring-2 ring-primary"
                      )}
                      onClick={() => {
                        setSelectedTest(test);
                        loadTestResults(test.id);
                      }}>
                      
                          <CardContent className="p-3">
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-2">
                                <GripVertical className="h-4 w-4 text-muted-foreground" />
                                <h3 className="font-medium text-sm">{test.name}</h3>
                              </div>
                              <Select value={test.status} onValueChange={(v) => updateTestStatus(test.id, v)}>
                                <SelectTrigger
                              className="w-auto h-5 px-1.5 text-xs"
                              onClick={(e) => e.stopPropagation()}>
                              
                                  <Badge
                                variant={test.status === "failed" ? "destructive" : "secondary"}
                                className={cn(
                                  "text-xs",
                                  test.status === "passed" && "bg-green-500 hover:bg-green-600",
                                  test.status === "active" && "bg-blue-500 hover:bg-blue-600"
                                )}>
                                
                                    {test.status}
                                  </Badge>
                                </SelectTrigger>
                                <SelectContent onClick={(e) => e.stopPropagation()}>
                                  <SelectItem value="draft">Draft</SelectItem>
                                  <SelectItem value="active">Active</SelectItem>
                                  <SelectItem value="passed">Passed</SelectItem>
                                  <SelectItem value="failed">Failed</SelectItem>
                                  <SelectItem value="disabled">Disabled</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 ml-6">
                              <span>{(Array.isArray(test.steps) ? test.steps : []).length} steps</span>
                              <span>•</span>
                              <span>{test.application_name}</span>
                              <span>•</span>
                              <Badge variant="outline" className="text-xs font-normal">
                                {test.engine_mode.toUpperCase()}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                    )}
                    </div>
                  </ScrollArea>
                }
              </CardContent>
            </Card>

            {/* Test Details Panel */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>{selectedTest ? selectedTest.name : "Select a test"}</CardTitle>
                    <CardDescription>
                      {selectedTest ?
                      "Test details and execution history" :
                      "Choose a test from the list to view details"}
                    </CardDescription>
                  </div>
                  {selectedTest &&
                  <div className="flex items-center gap-2">
                      <Select value={selectedRunAgent} onValueChange={setSelectedRunAgent}>
                        <SelectTrigger className="w-[200px] bg-background">
                          <SelectValue placeholder="Any agent" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover z-50">
                          <SelectItem value="any">Any available agent</SelectItem>
                          {availableAgents.map((agent) =>
                        <SelectItem key={agent.id} value={agent.id}>
                              <div className="flex items-center gap-2">
                                <span
                              className={cn(
                                "h-2 w-2 rounded-full",
                                isAgentOnline(agent) ? "bg-green-500" : "bg-red-500"
                              )} />
                            

                                {agent.agent_name}
                              </div>
                            </SelectItem>
                        )}
                        </SelectContent>
                      </Select>
                      <Button onClick={() => runTest(selectedTest)} size="sm" disabled={isRunningCloudFlow}>
                        {isRunningCloudFlow ? (
                          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Running...</>
                        ) : (
                          <><Play className="mr-2 h-4 w-4" /> {selectedTest.engine_mode === "pad" && cloudFlowTriggerUrl.trim() ? "Run Cloud Flow" : selectedTest.engine_mode === "pad" ? "Run on PAD (local)" : "Run"}</>
                        )}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleEditTest(selectedTest)}>
                        <Edit className="mr-2 h-4 w-4" /> Edit
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleCloneTest(selectedTest)}>
                        <Copy className="mr-2 h-4 w-4" /> Clone
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => setDeleteConfirmId(selectedTest.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  }
                </div>
              </CardHeader>
              <CardContent>
                {selectedTest ?
                <div className="space-y-6">
                    {/* Test Info */}
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label className="text-sm font-semibold">Application</Label>
                        <p className="text-sm text-muted-foreground mt-1">{selectedTest.application_name}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-semibold">Engine Mode</Label>
                        <p className="text-sm text-muted-foreground mt-1">{selectedTest.engine_mode.toUpperCase()}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-semibold">Path</Label>
                        <p className="text-sm text-muted-foreground mt-1 truncate">
                          {selectedTest.application_path || "—"}
                        </p>
                      </div>
                    </div>

                    {selectedTest.description &&
                  <div>
                        <Label className="text-sm font-semibold">Description</Label>
                        <p className="text-sm text-muted-foreground mt-1">{selectedTest.description}</p>
                      </div>
                  }

                    {/* Cloud Flow Trigger URL — shown for PAD engine mode */}
                    {selectedTest.engine_mode === "pad" && (
                      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                        <Label className="text-sm font-semibold flex items-center gap-2">
                          <Zap className="h-4 w-4 text-primary" />
                          Cloud Flow HTTP Trigger URL
                        </Label>
                        <p className="text-xs text-muted-foreground mt-1 mb-2">
                          Paste the HTTP trigger URL from your Cloud Flow. When set, "Run Test" will execute the flow via web API instead of local PAD.
                        </p>
                        <Input
                          value={cloudFlowTriggerUrl}
                          onChange={(e) => setCloudFlowTriggerUrl(e.target.value)}
                          placeholder="https://prod-XX.westus.logic.azure.com:443/workflows/..."
                          className="font-mono text-xs"
                        />
                        {cloudFlowTriggerUrl.trim() && (
                          <div className="flex items-center gap-1.5 mt-2">
                            <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                            <span className="text-xs text-green-700 dark:text-green-400">
                              Cloud Flow trigger configured — Run Test will execute via web API
                            </span>
                          </div>
                        )}

                        {/* Local PAD execution fallback */}
                        {!cloudFlowTriggerUrl.trim() && (
                          <div className="mt-4 pt-4 border-t border-primary/20">
                            <Label className="text-sm font-semibold flex items-center gap-2">
                              <Zap className="h-4 w-4 text-primary" />
                              Local PAD Execution (fallback)
                            </Label>
                            <p className="text-xs text-muted-foreground mt-1 mb-2">
                              No Cloud Flow URL provided. Enter the PAD Environment ID, Workflow ID, and Dataverse URL — the Desktop Agent will first update the flow with the latest test steps, then run it locally in Power Automate Desktop.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              <div>
                                <Label className="text-xs">PAD Environment ID</Label>
                                <Input
                                  value={padEnvironmentId}
                                  onChange={(e) => setPadEnvironmentId(e.target.value)}
                                  placeholder="e.g. Default-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                                  className="font-mono text-xs"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">PAD Workflow ID</Label>
                                <Input
                                  value={padWorkflowId}
                                  onChange={(e) => setPadWorkflowId(e.target.value)}
                                  placeholder="e.g. xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                                  className="font-mono text-xs"
                                />
                              </div>
                            </div>
                            <div className="mt-2">
                              <Label className="text-xs">Dataverse URL</Label>
                              <Input
                                value={padDataverseOrgUrl}
                                onChange={(e) => setPadDataverseOrgUrl(e.target.value)}
                                placeholder="https://org12345.crm.dynamics.com"
                                className="font-mono text-xs"
                              />
                            </div>
                            {padEnvironmentId.trim() && padWorkflowId.trim() && padDataverseOrgUrl.trim() && (
                              <div className="flex items-center gap-1.5 mt-2">
                                <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                                <span className="text-xs text-green-700 dark:text-green-400">
                                  Local PAD target configured — Run Test will update the flow, then dispatch to the Desktop Agent
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Steps / Payload Sub-tabs */}
                    <Tabs value={testDetailSubTab} onValueChange={(v) => setTestDetailSubTab(v as any)}>
                      <TabsList className="mb-3">
                        <TabsTrigger value="steps">
                          Steps ({(Array.isArray(selectedTest.steps) ? selectedTest.steps : []).length})
                        </TabsTrigger>
                        <TabsTrigger value="payload">
                          <FileText className="mr-1 h-3.5 w-3.5" /> Payload
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="steps">
                        <div className="space-y-2">
                          {(Array.isArray(selectedTest.steps) ? selectedTest.steps : []).map(
                          (step: any, index: number) =>
                          <Card key={step.stepId || index} className="border-l-4 border-l-primary/50">
                                <CardContent className="p-4">
                                  <div className="flex items-start gap-3">
                                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                                      {index + 1}
                                    </div>
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <Badge variant="outline">{step.action}</Badge>
                                        <Badge variant="secondary" className="text-xs">
                                          {step.target?.controlType}
                                        </Badge>
                                        {step.visionScreenshot &&
                                    <Badge
                                      variant="outline"
                                      className="text-xs gap-1 border-primary/40 text-primary">
                                            <Eye className="h-3 w-3" /> Vision
                                          </Badge>
                                    }
                                      </div>
                                      <p className="text-sm font-medium">
                                        {step.target?.label || step.target?.automationId || step.action}
                                      </p>
                                      {step.value && <p className="text-xs text-muted-foreground">Value: {step.value}</p>}
                                      {step.target?.parentWindow &&
                                  <p className="text-xs text-muted-foreground">
                                          Window: {step.target.parentWindow}
                                        </p>
                                  }
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                          )}
                          {(Array.isArray(selectedTest.steps) ? selectedTest.steps : []).length === 0 &&
                        <p className="text-sm text-muted-foreground text-center py-4">No steps defined</p>
                        }
                        </div>
                      </TabsContent>

                      <TabsContent value="payload">
                        <PayloadBuilder
                          test={selectedTest}
                          cloudFlowTriggerUrl={cloudFlowTriggerUrl}
                          projectId={projectId}
                          onRunTriggered={() => setActiveTab("results")}
                        />
                      </TabsContent>
                    </Tabs>

                    {/* Execution History */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <Label className="text-sm font-semibold">Recent Executions</Label>
                        <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => selectedTest && loadTestResults(selectedTest.id)}
                        className="h-7 w-7 p-0"
                        disabled={isLoadingResults}>
                        
                          <RefreshCw className={cn("h-4 w-4", isLoadingResults && "animate-spin")} />
                        </Button>
                      </div>
                      {testResults.length === 0 ?
                    <p className="text-sm text-muted-foreground">No executions yet</p> :

                    <div className="space-y-2">
                          {testResults.map((r) =>
                      <Card
                        key={r.id}
                        className="hover:bg-accent/50 transition-colors cursor-pointer"
                        onClick={() => openExecutionDetail(r)}>
                        
                              <CardContent className="p-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    {getStatusIcon(r.status)}
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <p className="text-sm font-medium capitalize">{r.status}</p>
                                        {r.engine_mode &&
                                  <Badge variant="outline" className="text-xs">
                                            {r.engine_mode.toUpperCase()}
                                          </Badge>
                                  }
                                      </div>
                                      <p className="text-xs text-muted-foreground">
                                        {new Date(r.created_at).toLocaleString()}
                                        {" • "}
                                        <span className="text-green-500">{r.passed_steps}</span>/{r.total_steps} passed
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {r.failure_category &&
                              <Badge variant="outline" className="bg-destructive/10 text-destructive text-xs">
                                        {r.failure_category}
                                      </Badge>
                              }
                                    {r.duration_ms &&
                              <Badge variant="secondary">{(r.duration_ms / 1000).toFixed(1)}s</Badge>
                              }
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                      )}
                        </div>
                    }
                    </div>
                  </div> :

                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <Eye className="h-12 w-12 mb-4 opacity-50" />
                    <p>Select a test to view details</p>
                  </div>
                }
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Execution Results Tab */}
        <TabsContent value="results" className="mt-6 space-y-4">
          <LiveExecutionLog projectId={projectId} testId={selectedTest?.id} />
          {results.length === 0 ?
          <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">No execution results yet</p>
                <p className="text-sm mt-1">Run a test to see results here</p>
              </CardContent>
            </Card> :

          <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Engine</TableHead>
                      <TableHead>Steps</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Failure Category</TableHead>
                      <TableHead>Trace ID</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((r) =>
                  <TableRow
                    key={r.id}
                    className="cursor-pointer hover:bg-accent/50"
                    onClick={() => openExecutionDetail(r)}>
                    
                        <TableCell>{statusBadge(r.status)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{r.engine_mode?.toUpperCase() || "N/A"}</Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-green-500">{r.passed_steps}</span>
                          {" / "}
                          <span className="text-destructive">{r.failed_steps}</span>
                          {" / "}
                          {r.total_steps}
                        </TableCell>
                        <TableCell>{r.duration_ms ? `${(r.duration_ms / 1000).toFixed(1)}s` : "N/A"}</TableCell>
                        <TableCell>
                          {r.failure_category ?
                      <Badge variant="outline" className="bg-destructive/10 text-destructive">
                              {r.failure_category}
                            </Badge> :

                      "—"
                      }
                        </TableCell>
                        <TableCell className="font-mono text-xs">{r.trace_id || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(r.created_at).toLocaleString()}
                        </TableCell>
                      </TableRow>
                  )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          }
        </TabsContent>

        {/* Selector Repository Tab */}
        <TabsContent value="selectors" className="mt-6 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-semibold">Selector Repository</h3>
              <p className="text-sm text-muted-foreground">Versioned UI element selectors for your desktop tests</p>
            </div>
            {tests.length > 0 &&
            <div className="flex gap-2">
                <Select
                onValueChange={(testId) => {
                  const t = tests.find((x) => x.id === testId);
                  if (t) handleAIExtractSelectors(Array.isArray(t.steps) ? t.steps : [], t.application_name);
                }}>
                
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="AI Extract from Test..." />
                  </SelectTrigger>
                  <SelectContent>
                    {tests.map((t) =>
                  <SelectItem key={t.id} value={t.id}>
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-3 w-3 text-primary" />
                          {t.name}
                        </div>
                      </SelectItem>
                  )}
                  </SelectContent>
                </Select>
              </div>
            }
          </div>
          {selectors.length === 0 ?
          <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Crosshair className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">No selectors in repository yet</p>
                <p className="text-sm mt-1">Selectors are created during test creation or auto-discovered by agents</p>
              </CardContent>
            </Card> :

          <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Element</TableHead>
                      <TableHead>App</TableHead>
                      <TableHead>AutomationId</TableHead>
                      <TableHead>Control Type</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectors.map((s) =>
                  <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.element_name}</TableCell>
                        <TableCell>{s.application_name}</TableCell>
                        <TableCell className="font-mono text-xs">{s.selector?.automationId || "—"}</TableCell>
                        <TableCell>{s.selector?.controlType || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">v{s.version}</Badge>
                        </TableCell>
                        <TableCell>{statusBadge(s.validation_status)}</TableCell>
                      </TableRow>
                  )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          }
        </TabsContent>

        {/* Self-Healing Tab */}
        <TabsContent value="self-healing" className="mt-6 space-y-4">
          {healingLogs.length === 0 ?
          <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Wand2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">No self-healing events yet</p>
                <p className="text-sm mt-1">When tests fail due to selector issues, the AI engine will suggest fixes</p>
              </CardContent>
            </Card> :

          <div className="space-y-3">
              {healingLogs.map((log) =>
            <Card key={log.id}>
                  <CardContent className="py-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Wand2 className="h-4 w-4 text-yellow-500" />
                        {statusBadge(log.status)}
                        {log.confidence_score !== null &&
                    <Badge
                      variant="outline"
                      className={
                      log.confidence_score >= 0.9 ?
                      "bg-green-500/10 text-green-500" :
                      log.confidence_score >= 0.7 ?
                      "bg-yellow-500/10 text-yellow-600" :
                      "bg-destructive/10 text-destructive"
                      }>
                      
                            {(log.confidence_score * 100).toFixed(0)}% confidence
                          </Badge>
                    }
                        <span className="text-xs text-muted-foreground">
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                      </div>
                      {log.status === "pending" &&
                  <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => approveHeal(log.id)}>
                            <CheckCircle className="h-4 w-4 mr-1 text-green-500" /> Approve
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => rejectHeal(log.id)}>
                            <XCircle className="h-4 w-4 mr-1 text-destructive" /> Reject
                          </Button>
                        </div>
                  }
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Original Selector</p>
                        <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
                          {JSON.stringify(log.original_selector, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Suggested Selector</p>
                        <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
                          {JSON.stringify(log.suggested_selector, null, 2)}
                        </pre>
                      </div>
                    </div>
                    {log.ai_analysis &&
                <div className="text-sm bg-muted/50 p-3 rounded">
                        <p className="text-xs font-medium text-muted-foreground mb-1">AI Analysis</p>
                        <p>{log.ai_analysis}</p>
                      </div>
                }
                  </CardContent>
                </Card>
            )}
            </div>
          }
        </TabsContent>

        {/* Object Repository Tab */}
        <TabsContent value="object-repo" className="mt-6">
          <ObjectRepository projectId={projectId} />
        </TabsContent>

        {/* Robin Generator Tab */}
        <TabsContent value="robin-generator" className="mt-6">
          <RobinDispatcherGenerator projectId={projectId} />
        </TabsContent>
      </Tabs>

      {/* Create Test Dialog */}
      <Dialog open={showCreateTest} onOpenChange={setShowCreateTest}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Desktop Test</DialogTitle>
            <DialogDescription>Define test steps for thick-client automation</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Test Name</Label>
                <Input
                  value={newTest.name}
                  onChange={(e) => setNewTest((p) => ({ ...p, name: e.target.value }))}
                  placeholder="" />
                
              </div>
              <div>
                <Label>Application</Label>
                <Input
                  value={newTest.application_name}
                  onChange={(e) => setNewTest((p) => ({ ...p, application_name: e.target.value }))} />
                
              </div>
            </div>
            <div>
              <Label>Application Path</Label>
              <Input
                value={newTest.application_path}
                onChange={(e) => setNewTest((p) => ({ ...p, application_path: e.target.value }))}
                placeholder="" />
              
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={newTest.description}
                onChange={(e) => setNewTest((p) => ({ ...p, description: e.target.value }))} />
              
            </div>
            <div>
              <Label>Engine Mode</Label>
              <Select value={newTest.engine_mode} onValueChange={(v) => setNewTest((p) => ({ ...p, engine_mode: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="uia">UIA (UI Automation) — Primary</SelectItem>
                  <SelectItem value="jab">JAB (Java Access Bridge) — Java Apps</SelectItem>
                  <SelectItem value="vision">Vision (OCR + Template Match) — Fallback</SelectItem>
                  <SelectItem value="hybrid">Hybrid (UIA + JAB + Vision fallback)</SelectItem>
                  <SelectItem value="pad">PAD (Power Automate Desktop)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {renderStepEditor(newTest.steps, (steps) => setNewTest((p) => ({ ...p, steps })), "new")}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateTest(false)}>
              Cancel
            </Button>
            <Button onClick={createTest} disabled={!newTest.name}>
              Create Test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Test Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Desktop Test</DialogTitle>
            <DialogDescription>Modify test configuration and steps</DialogDescription>
          </DialogHeader>
          {editTest &&
          <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Test Name</Label>
                  <Input value={editTest.name} onChange={(e) => setEditTest({ ...editTest, name: e.target.value })} />
                </div>
                <div>
                  <Label>Application</Label>
                  <Input
                  value={editTest.application_name}
                  onChange={(e) => setEditTest({ ...editTest, application_name: e.target.value })} />
                
                </div>
              </div>
              <div>
                <Label>Application Path</Label>
                <Input
                value={editTest.application_path || ""}
                onChange={(e) => setEditTest({ ...editTest, application_path: e.target.value })} />
              
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                value={editTest.description || ""}
                onChange={(e) => setEditTest({ ...editTest, description: e.target.value })} />
              
              </div>
              <div>
                <Label>Engine Mode</Label>
                <Select
                value={editTest.engine_mode}
                onValueChange={(v) => setEditTest({ ...editTest, engine_mode: v })}>
                
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="uia">UIA (UI Automation) — Primary</SelectItem>
                    <SelectItem value="jab">JAB (Java Access Bridge) — Java Apps</SelectItem>
                    <SelectItem value="vision">Vision (OCR + Template Match) — Fallback</SelectItem>
                    <SelectItem value="hybrid">Hybrid (UIA + JAB + Vision fallback)</SelectItem>
                    <SelectItem value="pad">PAD (Power Automate Desktop)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {renderStepEditor(editSteps, setEditSteps, "edit")}
            </div>
          }
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={saveEditTest}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Test Dialog */}
      <Dialog
        open={showRecordDialog}
        onOpenChange={(v) => {
          if (!isRecording && !recordingReviewMode) handleCloseRecordDialog();
        }}>
        
        <DialogContent
          className={cn("max-h-[90vh] flex flex-col", recorderWizardStep !== "setup" ? "max-w-4xl" : "max-w-lg")}>
          
          {/* Wizard Stepper */}
          <div className="flex items-center gap-2 mb-2">
            {[
            { key: "setup", label: "1. Setup", icon: Settings },
            { key: "recording", label: "2. Recording", icon: Video },
            { key: "review", label: "3. Review", icon: CheckCircle }].
            map((s, idx) => {
              const stepKeys = ["setup", "recording", "review"];
              const currentIdx = stepKeys.indexOf(recorderWizardStep);
              const thisIdx = idx;
              const isActive = recorderWizardStep === s.key;
              const isCompleted = thisIdx < currentIdx;
              const Icon = s.icon;
              return (
                <div key={s.key} className="flex items-center gap-2">
                  {idx > 0 && <div className={cn("h-px w-6", isCompleted || isActive ? "bg-primary" : "bg-border")} />}
                  <div
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                      isActive && "bg-primary text-primary-foreground",
                      isCompleted && "bg-primary/10 text-primary",
                      !isActive && !isCompleted && "bg-muted text-muted-foreground"
                    )}>
                    
                    <Icon className="h-3.5 w-3.5" />
                    {s.label}
                  </div>
                </div>);

            })}
          </div>

          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="h-5 w-5 text-primary" />
              {recorderWizardStep === "review" ?
              "Review Recorded Steps" :
              recorderWizardStep === "recording" ?
              "Recording in Progress" :
              "Record Desktop Test"}
            </DialogTitle>
            <DialogDescription>
              {recorderWizardStep === "review" ?
              "Review, edit, reorder, or remove steps before saving the test." :
              recorderWizardStep === "recording" ?
              "Perform actions in the desktop application. The agent captures your interactions." :
              "Configure the recording session details, then start recording."}
            </DialogDescription>
          </DialogHeader>

          {recorderWizardStep === "setup" &&
          <div className="space-y-4">
              <div>
                <Label>Test Name</Label>
                <Input
                value={recordTestName}
                onChange={(e) => setRecordTestName(e.target.value)}
                placeholder="e.g., Login Flow Recording"
                disabled={isRecording} />
              
              </div>
              <div>
                <Label>Application Name</Label>
                <Input
                value={recordAppName}
                onChange={(e) => setRecordAppName(e.target.value)}
                placeholder=""
                disabled={isRecording} />
              
              </div>
              <div>
                <Label>Application Path (optional)</Label>
                <Input
                value={recordAppPath}
                onChange={(e) => setRecordAppPath(e.target.value)}
                placeholder=""
                disabled={isRecording} />
              
              </div>
              <div>
                <Label>Engine Mode</Label>
                <Select value={recordEngineMode} onValueChange={setRecordEngineMode} disabled={isRecording}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select engine mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="uia">UIA (Windows Native)</SelectItem>
                    <SelectItem value="jab">JAB (Java Access Bridge)</SelectItem>
                    <SelectItem value="vision">Vision (AI-based)</SelectItem>
                    <SelectItem value="hybrid">Hybrid (UIA + JAB + Vision)</SelectItem>
                    <SelectItem value="pad">Power Automate Desktop (Robin Script)</SelectItem>
                  </SelectContent>
                </Select>
                {recordEngineMode === "pad" && (
                  <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    The agent will launch Power Automate Desktop recorder. Ensure PAD is installed on the agent machine.
                  </p>
                )}
              </div>
              <div>
                <Label>Desktop Agent</Label>
                <Select value={recordingAgent} onValueChange={setRecordingAgent} disabled={isRecording}>
                  <SelectTrigger>
                    <SelectValue placeholder={isLoadingAgents ? "Loading agents..." : "Select an agent"} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableAgents.map((agent) =>
                  <SelectItem key={agent.id} value={agent.id}>
                        <div className="flex items-center gap-2">
                          <div
                        className={cn(
                          "w-2 h-2 rounded-full",
                          isAgentOnline(agent) ? "bg-green-500" : "bg-destructive"
                        )} />
                      

                          <span>{agent.agent_name}</span>
                          <span className="text-xs text-muted-foreground">
                            {isAgentOnline(agent) ? "(online)" : "(offline)"}
                          </span>
                        </div>
                      </SelectItem>
                  )}
                    {availableAgents.length === 0 && !isLoadingAgents &&
                  <SelectItem value="none" disabled>
                        No agents registered
                      </SelectItem>
                  }
                  </SelectContent>
                </Select>
              </div>
            </div>
          }

          {/* Live recording steps view - Wizard Step 2 */}
          {recorderWizardStep === "recording" &&
          <div className="space-y-3 flex-1 flex flex-col min-h-0">
              {/* Job status indicator */}
              <div className="p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-destructive animate-pulse" />
                  <span className="font-medium text-destructive">Recording in progress...</span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {recordedSteps.length} action(s) captured
                  </span>
                </div>
                <Progress value={recordingProgress} className="h-2" />
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Agent Status:</span>
                    {recordingJobStatus === "pending" &&
                  <Badge
                    variant="outline"
                    className="text-xs bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
                    
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Waiting for agent to pick up...
                      </Badge>
                  }
                    {recordingJobStatus === "assigned" &&
                  <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-500 border-blue-500/30">
                        <Activity className="h-3 w-3 mr-1" /> Agent assigned, initializing...
                      </Badge>
                  }
                    {recordingJobStatus === "running" &&
                  <Badge variant="outline" className="text-xs bg-green-500/10 text-green-500 border-green-500/30">
                        <CheckCircle className="h-3 w-3 mr-1" /> Agent recording
                      </Badge>
                  }
                    {!["pending", "assigned", "running"].includes(recordingJobStatus) &&
                  <Badge variant="outline" className="text-xs">
                        {recordingJobStatus}
                      </Badge>
                  }
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">
                    {Math.floor(recordingElapsed / 60).
                  toString().
                  padStart(2, "0")}
                    :{(recordingElapsed % 60).toString().padStart(2, "0")}
                  </span>
                </div>
                {recordingJobStatus === "pending" && recordingElapsed > 15 &&
              <p className="text-xs text-yellow-600 mt-2 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Agent hasn't picked up the job yet. Make sure the desktop agent is running and connected.
                  </p>
              }
                <p className="text-xs text-muted-foreground mt-1">
                  Perform actions in {recordAppName || "the application"}. Steps appear below in real-time.
                </p>
              </div>

              <ScrollArea className="flex-1 min-h-[200px] max-h-[40vh] pr-2  overflow-auto">
                {recordedSteps.length === 0 ?
              <div className="text-center py-10 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                    <p className="text-sm">
                      {recordingJobStatus === "pending" ?
                  "Waiting for agent to start recording..." :
                  "Waiting for actions to be captured..."}
                    </p>
                  </div> :

              <div className="space-y-2">
                    {recordedSteps.map((step: any, i: number) => {
                  const actionNeedsValue = [
                  "type",
                  "assert_text",
                  "select",
                  "keyboard_shortcut",
                  "scroll"].
                  includes(step.action);
                  return (
                    <Card
                      key={step.stepId || `rec-${i}`}
                      className="p-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="text-xs">
                              Step {i + 1}
                            </Badge>
                            <Select
                          value={step.action || "click"}
                          onValueChange={(v) => {
                            const updated = [...recordedSteps];
                            updated[i] = { ...updated[i], action: v };
                            setRecordedSteps(updated);
                          }}>
                          
                              <SelectTrigger className="h-7 w-[140px] text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {STEP_ACTIONS.map((a) =>
                            <SelectItem key={a} value={a} className="text-xs">
                                    {a}
                                  </SelectItem>
                            )}
                              </SelectContent>
                            </Select>
                            <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs ml-auto"
                          onClick={() => setExpandedSelectorStep(expandedSelectorStep === i ? null : i)}>
                          
                              <Settings className="h-3 w-3 mr-1" /> Selector
                            </Button>
                            <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => {
                            setRecordedSteps(recordedSteps.filter((_, idx) => idx !== i));
                            if (expandedSelectorStep === i) setExpandedSelectorStep(null);
                          }}>
                          
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                            {step.recordedAt &&
                        <span className="text-xs text-muted-foreground">
                                {new Date(step.recordedAt).toLocaleTimeString()}
                              </span>
                        }
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            {(step.target?.label || step.label || step.name) &&
                        <div>
                                <span className="text-muted-foreground">Label:</span>{" "}
                                <span className="font-mono">{step.target?.label || step.label || step.name}</span>
                              </div>
                        }
                            {(step.target?.automationId || step.automationId) &&
                        <div>
                                <span className="text-muted-foreground">AutoID:</span>{" "}
                                <span className="font-mono">{step.target?.automationId || step.automationId}</span>
                              </div>
                        }
                            {(step.target?.controlType || step.controlType) &&
                        <div>
                                <span className="text-muted-foreground">Type:</span>{" "}
                                <span className="font-mono">{step.target?.controlType || step.controlType}</span>
                              </div>
                        }
                            {(step.target?.parentWindow || step.parentWindow) &&
                        <div className="col-span-2">
                                <span className="text-muted-foreground">Window:</span>{" "}
                                <span className="font-mono">{step.target?.parentWindow || step.parentWindow}</span>
                              </div>
                        }
                            {step.visionScreenshot &&
                        <div className="col-span-3 flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs gap-1 border-primary/40 text-primary">
                                  <Eye className="h-3 w-3" /> Vision Captured
                                </Badge>
                                <img
                            src={step.visionScreenshot}
                            alt="Vision capture"
                            className="h-8 rounded border border-border" />
                          
                              </div>
                        }
                          </div>
                          {actionNeedsValue &&
                      <div className="mt-2">
                              <Input
                          className="h-7 text-xs"
                          placeholder={
                          step.action === "type" ?
                          "Text to type..." :
                          step.action === "assert_text" ?
                          "Expected text..." :
                          step.action === "keyboard_shortcut" ?
                          "e.g. Ctrl+S" :
                          "Value..."
                          }
                          value={step.value || ""}
                          onChange={(e) => {
                            const updated = [...recordedSteps];
                            updated[i] = { ...updated[i], value: e.target.value };
                            setRecordedSteps(updated);
                          }} />
                        
                            </div>
                      }
                          {/* Expandable Selector Panel */}
                          {expandedSelectorStep === i &&
                      <div className="mt-3">
                              <RecorderSelectorPanel
                          step={{ ...step, applicationName: recordAppName }}
                          onUpdate={(selectorData) => {
                            const updated = [...recordedSteps];
                            updated[i] = { ...updated[i], selectorConfig: selectorData };
                            setRecordedSteps(updated);
                          }}
                          onValidate={() => {
                            toast({
                              title: "Validating selector...",
                              description: "Sending validation request to desktop agent."
                            });
                          }}
                          onConfirm={() => {
                            setExpandedSelectorStep(null);
                            toast({ title: "Selector confirmed", description: `Step ${i + 1} selector saved.` });
                          }}
                          onCancel={() => setExpandedSelectorStep(null)} />
                        
                            </div>
                      }
                        </Card>);

                })}
                    <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-1"
                  onClick={() =>
                  setRecordedSteps([
                  ...recordedSteps,
                  {
                    stepId: `step-manual-${Date.now()}`,
                    action: "click",
                    target: {
                      automationId: "",
                      label: "",
                      controlType: "Button",
                      classHint: "",
                      parentWindow: ""
                    },
                    value: "",
                    recordedAt: new Date().toISOString(),
                    retryCount: 1,
                    waitCondition: "element_exists",
                    timeoutSeconds: 30
                  }]
                  )
                  }>
                  
                      <Plus className="h-3 w-3 mr-1" /> Add Step Manually
                    </Button>
                  </div>
              }
              </ScrollArea>

              {/* Stop & Cancel buttons always visible during recording */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <Button
                variant="outline"
                onClick={() => {
                  handleStopRecording();
                  handleCloseRecordDialog();
                }}>
                
                  <XCircle className="mr-2 h-4 w-4" /> Cancel Recording
                </Button>
                <Button onClick={handleStopRecording} variant="destructive">
                  <Square className="mr-2 h-4 w-4" /> Stop Recording & Review
                </Button>
              </div>
            </div>
          }

          {/* Review mode - Wizard Step 3 */}
          {recorderWizardStep === "review" &&
          <ScrollArea className="flex-1 max-h-[60vh] pr-2 overflow-auto">
              {reviewSteps.length === 0 ?
            <div className="text-center py-10 text-muted-foreground border-2 border-dashed rounded-lg">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No steps were captured. You can add steps manually.</p>
                  <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => setReviewSteps([createEmptyStep()])}>
                
                    <Plus className="h-3 w-3 mr-1" /> Add Step
                  </Button>
                </div> :

            <div className="space-y-1">{renderStepEditor(reviewSteps, setReviewSteps, "new")}</div>
            }
            </ScrollArea>
          }

          <DialogFooter>
            {recorderWizardStep === "setup" &&
            <>
                <Button variant="outline" onClick={handleCloseRecordDialog}>
                  Cancel
                </Button>
                <Button
                onClick={handleStartRecording}
                disabled={!recordTestName || !recordingAgent}
                className="bg-destructive hover:bg-destructive/90">
                
                  <Video className="mr-2 h-4 w-4" /> Start Recording
                </Button>
              </>
            }
            {/* Stop button moved inline above during recording */}
            {recorderWizardStep === "review" &&
            <>
                <Button variant="outline" onClick={handleCloseRecordDialog}>
                  Discard
                </Button>
                <Button onClick={handleSaveRecordedTest} disabled={reviewSteps.length === 0}>
                  <CheckCircle className="mr-2 h-4 w-4" /> Save Test ({reviewSteps.length} steps)
                </Button>
              </>
            }
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Test</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this test? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirmId) {
                  deleteTest(deleteConfirmId);
                  setDeleteConfirmId(null);
                }
              }}>
              
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AI Generate Steps Dialog */}
      <Dialog
        open={showAIGenerateDialog}
        onOpenChange={(v) => {
          if (!isGeneratingSteps) setShowAIGenerateDialog(v);
        }}>
        
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Generate Automation Steps
            </DialogTitle>
            <DialogDescription>
              Describe the test scenario in plain English or paste manual test case steps. AI will generate structured
              desktop automation steps.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Test Scenario Description</Label>
              <Textarea
                value={aiGenerateDescription}
                onChange={(e) => setAiGenerateDescription(e.target.value)}
                placeholder={``}
                className="min-h-[160px] font-mono text-sm"
                disabled={isGeneratingSteps} />
              
            </div>
            <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg text-sm text-muted-foreground">
              <Brain className="h-4 w-4 inline mr-1 text-primary" />
              AI will generate UIA-compatible automation steps with realistic selectors, control types, and wait
              conditions for{" "}
              <strong>{aiGenerateTarget === "new" ? newTest.application_name : editTest?.application_name}</strong>.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAIGenerateDialog(false)} disabled={isGeneratingSteps}>
              Cancel
            </Button>
            <Button onClick={handleAIGenerateSteps} disabled={isGeneratingSteps || !aiGenerateDescription.trim()}>
              {isGeneratingSteps ?
              <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...
                </> :

              <>
                  <Sparkles className="mr-2 h-4 w-4" /> Generate Steps
                </>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Extract Selectors Dialog */}
      <Dialog
        open={showAISelectorDialog}
        onOpenChange={(v) => {
          if (!isExtractingSelectors) setShowAISelectorDialog(v);
        }}>
        
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crosshair className="h-5 w-5 text-primary" />
              AI Selector Extraction
            </DialogTitle>
            <DialogDescription>
              AI has analyzed your test steps and extracted UI element selectors with fallback strategies.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {isExtractingSelectors ?
            <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground">Analyzing steps and extracting selectors...</p>
              </div> :
            aiExtractedSelectors.length === 0 ?
            <div className="text-center py-8 text-muted-foreground">No selectors extracted.</div> :

            <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Found <strong>{aiExtractedSelectors.length}</strong> UI elements. These will be saved to the Selector
                  Repository.
                </p>
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                  {aiExtractedSelectors.map((s, i) =>
                <Card key={i} className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">{s.element_name}</span>
                            <Badge variant="outline" className="text-xs">
                              {s.selector?.controlType}
                            </Badge>
                            {s.confidence >= 0.9 ?
                        <Badge className="text-xs bg-green-500/10 text-green-600 border-green-500/30">
                                High confidence
                              </Badge> :
                        s.confidence >= 0.7 ?
                        <Badge className="text-xs bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
                                Medium
                              </Badge> :

                        <Badge className="text-xs bg-destructive/10 text-destructive border-destructive/30">
                                Low
                              </Badge>
                        }
                          </div>
                          <div className="text-xs text-muted-foreground space-y-0.5">
                            {s.selector?.automationId &&
                        <p>
                                AutomationId: <span className="font-mono">{s.selector.automationId}</span>
                              </p>
                        }
                            {s.selector?.label &&
                        <p>
                                Label: <span className="font-mono">{s.selector.label}</span>
                              </p>
                        }
                            {s.selector?.parentWindow &&
                        <p>
                                Window: <span className="font-mono">{s.selector.parentWindow}</span>
                              </p>
                        }
                            {s.fallback_selectors?.length > 0 &&
                        <p className="text-primary/70">{s.fallback_selectors.length} fallback selector(s)</p>
                        }
                          </div>
                          {s.suggested_description &&
                      <p className="text-xs text-muted-foreground mt-1 italic">{s.suggested_description}</p>
                      }
                        </div>
                        <Database className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
                      </div>
                    </Card>
                )}
                </div>
              </div>
            }
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAISelectorDialog(false)} disabled={isExtractingSelectors}>
              Cancel
            </Button>
            <Button
              onClick={saveAIExtractedSelectors}
              disabled={isExtractingSelectors || aiExtractedSelectors.length === 0}>
              
              <Database className="mr-2 h-4 w-4" />
              Save {aiExtractedSelectors.length} Selectors to Repository
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert Test Case — Import Dialog */}
      <Dialog
        open={showImportDialog}
        onOpenChange={(open) => {
          if (!isConvertingTestCase) {
            setShowImportDialog(open);
            if (!open) setSelectedTestCaseId("");
          }
        }}>
        
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              Convert Manual Test Case to Desktop Automation
            </DialogTitle>
            <DialogDescription>
              Select a manual test case and configure the target application. AI will convert the steps and optionally
              dispatch a desktop agent to capture live selectors.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {/* Mode info card */}
            <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <Zap className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">AI + Agent Conversion</p>
                <p>
                  AI generates the automation script from your test steps. Optionally select a desktop agent — it will
                  run the script live to capture accurate UI selectors. If any step fails, AI will automatically fix it
                  and retry.
                </p>
              </div>
            </div>

            {/* Test Case Selection */}
            <div className="space-y-2">
              <Label className="font-medium">Select Test Case</Label>
              {availableTestCases.length === 0 ?
              <div className="text-center py-6 text-muted-foreground border-2 border-dashed rounded-lg">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No test cases found in this project.</p>
                  <p className="text-xs mt-1">Create test cases in the Test Cases tab first.</p>
                </div> :

              <Select value={selectedTestCaseId} onValueChange={setSelectedTestCaseId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a test case to convert" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTestCases.map((tc) =>
                  <SelectItem key={tc.id} value={tc.id}>
                        <span className="font-medium">{tc.title}</span>
                        {tc.user_stories &&
                    <span className="text-muted-foreground ml-1">— {tc.user_stories.title}</span>
                    }
                      </SelectItem>
                  )}
                  </SelectContent>
                </Select>
              }
            </div>

            {/* Test Case Preview */}
            {selectedTestCaseId &&
            (() => {
              const tc = availableTestCases.find((t) => t.id === selectedTestCaseId);
              if (!tc) return null;
              let steps: string[] = [];
              if (tc.structured_steps) {
                const arr = Array.isArray(tc.structured_steps) ?
                tc.structured_steps :
                (() => {
                  try {
                    return JSON.parse(tc.structured_steps);
                  } catch {
                    return [];
                  }
                })();
                steps = arr.
                map((s: any) => typeof s === "string" ? s : s.action || s.step || s.description || "").
                filter(Boolean);
              } else if (tc.steps) {
                try {
                  steps = JSON.parse(tc.steps);
                } catch {
                  steps = tc.steps.split("\n").filter((s: string) => s.trim());
                }
              }
              return (
                <div className="space-y-2">
                    <Label className="font-medium text-sm">Test Case Preview</Label>
                    <Card className="p-3 bg-muted/30">
                      <p className="font-medium text-sm mb-2">{tc.title}</p>
                      {tc.description && <p className="text-xs text-muted-foreground mb-2">{tc.description}</p>}
                      <div className="space-y-1 max-h-[150px] overflow-y-auto">
                        {steps.slice(0, 10).map((s, i) =>
                      <div key={i} className="flex items-start gap-2 text-xs">
                            <span className="text-muted-foreground font-mono w-5 flex-shrink-0">{i + 1}.</span>
                            <span>{s}</span>
                          </div>
                      )}
                        {steps.length > 10 &&
                      <p className="text-xs text-muted-foreground mt-1">...and {steps.length - 10} more steps</p>
                      }
                        {steps.length === 0 &&
                      <p className="text-xs text-muted-foreground italic">No steps found in this test case.</p>
                      }
                      </div>
                    </Card>
                  </div>);

            })()}

            {/* Application Configuration */}
            {selectedTestCaseId &&
            <div className="space-y-3 pt-1">
                <Label className="font-medium">Target Application Configuration</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Application Name</Label>
                    <Input value={importAppName} onChange={(e) => setImportAppName(e.target.value)} placeholder="" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Engine Mode</Label>
                    <Select value={importEngineMode} onValueChange={setImportEngineMode}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="uia">UIA — Primary</SelectItem>
                        <SelectItem value="jab">JAB — Java Apps</SelectItem>
                        <SelectItem value="vision">Vision — OCR fallback</SelectItem>
                        <SelectItem value="hybrid">Hybrid (UIA + JAB + Vision)</SelectItem>
                        <SelectItem value="pad">PAD (Power Automate Desktop)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Application Path (optional)</Label>
                  <Input value={importAppPath} onChange={(e) => setImportAppPath(e.target.value)} placeholder="" />
                </div>

                {/* Agent selection for live selector capture */}
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1">
                    <Crosshair className="h-3 w-3 text-primary" />
                    Desktop Agent for Live Selector Capture (optional)
                  </Label>
                  <Select value={importAgentId} onValueChange={setImportAgentId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Skip agent capture — AI selectors only" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        <div className="flex items-center gap-2">
                          <Brain className="h-3 w-3 text-muted-foreground" />
                          <span>AI selectors only (no agent needed)</span>
                        </div>
                      </SelectItem>
                      {availableAgents.map((agent) =>
                    <SelectItem key={agent.id} value={agent.id}>
                          <div className="flex items-center gap-2">
                            <span
                          className={cn(
                            "h-2 w-2 rounded-full flex-shrink-0",
                            isAgentOnline(agent) ? "bg-green-500" : "bg-destructive"
                          )} />
                        

                            <span>{agent.agent_name}</span>
                            <span className="text-xs text-muted-foreground">
                              ({isAgentOnline(agent) ? "online" : "offline"})
                            </span>
                          </div>
                        </SelectItem>
                    )}
                      {availableAgents.length === 0 &&
                    <SelectItem value="__no_agents__" disabled>
                          No agents registered
                        </SelectItem>
                    }
                    </SelectContent>
                  </Select>
                  {importAgentId && importAgentId !== "none" &&
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <RotateCcw className="h-3 w-3 text-primary" />
                      If the agent run fails, AI will auto-fix the steps and retry automatically.
                    </p>
                }
                </div>
              </div>
            }
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleConvertTestCase} disabled={!selectedTestCaseId || isConvertingTestCase}>
              {isConvertingTestCase ?
              <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Converting...
                </> :
              importAgentId && importAgentId !== "none" ?
              <>
                  <Zap className="mr-2 h-4 w-4" /> Convert + Capture Selectors
                </> :

              <>
                  <Sparkles className="mr-2 h-4 w-4" /> Convert with AI
                </>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Live Conversion Progress Overlay */}
      {isConvertingTestCase && capturePhase !== "idle" &&
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <Card className="w-[480px] shadow-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Zap className="h-5 w-5 text-primary" />
                Converting Test Case
              </CardTitle>
              <CardDescription>AI + Agent are working together to build your automation script</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress value={captureProgress} className="h-2" />
              <div className="flex items-start gap-3">
                {capturePhase === "fixing" ?
              <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" /> :
              capturePhase === "done" ?
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" /> :

              <Loader2 className="h-5 w-5 text-primary animate-spin mt-0.5 flex-shrink-0" />
              }
                <div>
                  <p className="text-sm font-medium">{captureMessage}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {capturePhase === "generating" && "This takes ~10 seconds"}
                    {capturePhase === "dispatching" && "Sending job to agent..."}
                    {capturePhase === "polling" && "Agent is running the script on your application..."}
                    {capturePhase === "fixing" && `Retry ${captureRetryCount + 1} — AI is rewriting failed steps`}
                    {capturePhase === "done" && "Opening preview..."}
                  </p>
                </div>
              </div>
              {capturePhase === "polling" &&
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 rounded-lg bg-muted/50">
                    <p className="font-medium">Phase 1</p>
                    <p className="text-muted-foreground">AI Script</p>
                    <CheckCircle className="h-4 w-4 text-green-500 mx-auto mt-1" />
                  </div>
                  <div className="p-2 rounded-lg bg-primary/5 border border-primary/20">
                    <p className="font-medium">Phase 2</p>
                    <p className="text-muted-foreground">Agent Capture</p>
                    <Loader2 className="h-4 w-4 text-primary animate-spin mx-auto mt-1" />
                  </div>
                  <div className="p-2 rounded-lg bg-muted/50 opacity-50">
                    <p className="font-medium">Phase 3</p>
                    <p className="text-muted-foreground">Save Selectors</p>
                    <Database className="h-4 w-4 text-muted-foreground mx-auto mt-1" />
                  </div>
                </div>
            }
              {capturePhase === "fixing" &&
            <div className="flex items-center gap-2 p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-lg text-xs text-yellow-700 dark:text-yellow-400">
                  <RotateCcw className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>
                    Agent detected failing steps. AI is analyzing the error and rewriting them for a successful retry.
                  </span>
                </div>
            }
            </CardContent>
          </Card>
        </div>
      }

      {/* Conversion Preview & Confirm Dialog */}
      <Dialog open={showConversionPreviewDialog} onOpenChange={setShowConversionPreviewDialog}>
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Conversion Preview — {conversionPreview?.testCase.title}
            </DialogTitle>
            <DialogDescription>
              Review and edit the AI-generated automation steps before saving. Changes here are saved with the test.
            </DialogDescription>
          </DialogHeader>

          {conversionPreview &&
          <div className="space-y-4">
              {/* Live selector capture banner */}
              {(conversionPreview.capturedSelectors?.length ?? 0) > 0 &&
            <div className="flex items-center gap-3 p-3 bg-green-500/5 border border-green-500/20 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-green-700 dark:text-green-400">
                      Agent captured {conversionPreview.capturedSelectors!.length} live selectors
                    </p>
                    <p className="text-muted-foreground text-xs">
                      These real selectors are more accurate than AI-generated ones and will be saved as validated in
                      the repository.
                    </p>
                  </div>
                </div>
            }

              {/* Side-by-side: Original Steps | Editable Converted Steps */}
              <div className="grid grid-cols-2 gap-4">
                {/* Original steps */}
                <div className="space-y-2">
                  <p className="text-sm font-semibold flex items-center gap-1">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    Original Test Steps ({conversionPreview.originalSteps.length})
                  </p>
                  <ScrollArea className="h-[280px] border rounded-lg p-3 bg-muted/30 overflow-auto">
                    <div className="space-y-2">
                      {conversionPreview.originalSteps.map((s, i) =>
                    <div key={i} className="flex items-start gap-2 text-xs">
                          <span className="text-muted-foreground font-mono w-5 flex-shrink-0">{i + 1}.</span>
                          <span>{s}</span>
                        </div>
                    )}
                    </div>
                  </ScrollArea>
                </div>

                {/* Editable Converted Steps */}
                <div className="space-y-2">
                  <p className="text-sm font-semibold flex items-center gap-1">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Generated Automation Steps ({editableConvertedSteps.length})
                    <span className="text-xs font-normal text-muted-foreground ml-1">— editable</span>
                  </p>
                  <ScrollArea className="h-[280px] border rounded-lg p-2 overflow-auto">
                    <div className="space-y-2 pr-1">
                      {editableConvertedSteps.map((step, i) =>
                    <Card key={i} className="p-3 border-l-4 border-l-primary/50">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {i + 1}
                              </Badge>
                              <Select
                            value={step.action}
                            onValueChange={(v) => {
                              const updated = [...editableConvertedSteps];
                              updated[i] = { ...updated[i], action: v };
                              setEditableConvertedSteps(updated);
                            }}>
                            
                                <SelectTrigger className="h-6 text-xs w-[130px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {STEP_ACTIONS.map((a) =>
                              <SelectItem key={a} value={a} className="text-xs">
                                      {a}
                                    </SelectItem>
                              )}
                                </SelectContent>
                              </Select>
                            </div>
                            <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          onClick={() => {
                            setEditableConvertedSteps(editableConvertedSteps.filter((_, idx) => idx !== i));
                          }}>
                          
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            <div>
                              <p className="text-xs text-muted-foreground mb-0.5">AutomationId</p>
                              <Input
                            className="h-6 text-xs"
                            value={step.target?.automationId || ""}
                            onChange={(e) => {
                              const updated = [...editableConvertedSteps];
                              updated[i] = {
                                ...updated[i],
                                target: { ...updated[i].target, automationId: e.target.value }
                              };
                              setEditableConvertedSteps(updated);
                            }}
                            placeholder="btnOK" />
                          
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-0.5">Label</p>
                              <Input
                            className="h-6 text-xs"
                            value={step.target?.label || ""}
                            onChange={(e) => {
                              const updated = [...editableConvertedSteps];
                              updated[i] = {
                                ...updated[i],
                                target: { ...updated[i].target, label: e.target.value }
                              };
                              setEditableConvertedSteps(updated);
                            }}
                            placeholder="OK" />
                          
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-0.5">Control Type</p>
                              <Select
                            value={step.target?.controlType || "Button"}
                            onValueChange={(v) => {
                              const updated = [...editableConvertedSteps];
                              updated[i] = { ...updated[i], target: { ...updated[i].target, controlType: v } };
                              setEditableConvertedSteps(updated);
                            }}>
                            
                                <SelectTrigger className="h-6 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {CONTROL_TYPES.map((c) =>
                              <SelectItem key={c} value={c} className="text-xs">
                                      {c}
                                    </SelectItem>
                              )}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-0.5">Value</p>
                              <Input
                            className="h-6 text-xs"
                            value={step.value || ""}
                            onChange={(e) => {
                              const updated = [...editableConvertedSteps];
                              updated[i] = { ...updated[i], value: e.target.value };
                              setEditableConvertedSteps(updated);
                            }}
                            placeholder="input value" />
                          
                            </div>
                          </div>
                          {step.target?.parentWindow &&
                      <div className="mt-1.5">
                              <p className="text-xs text-muted-foreground mb-0.5">Parent Window</p>
                              <Input
                          className="h-6 text-xs"
                          value={step.target.parentWindow || ""}
                          onChange={(e) => {
                            const updated = [...editableConvertedSteps];
                            updated[i] = {
                              ...updated[i],
                              target: { ...updated[i].target, parentWindow: e.target.value }
                            };
                            setEditableConvertedSteps(updated);
                          }} />
                        
                            </div>
                      }
                        </Card>
                    )}
                      <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => {
                        setEditableConvertedSteps([
                        ...editableConvertedSteps,
                        {
                          stepId: `step-${Date.now()}`,
                          action: "click",
                          target: {
                            automationId: "",
                            label: "",
                            controlType: "Button",
                            classHint: "",
                            parentWindow: ""
                          },
                          value: "",
                          waitCondition: "element_exists",
                          timeoutSeconds: 30,
                          retryCount: 1
                        }]
                        );
                      }}>
                      
                        <Plus className="h-3 w-3 mr-1" /> Add Step
                      </Button>
                    </div>
                  </ScrollArea>
                </div>
              </div>

              {/* Live selector preview (shown when agent was used) */}
              {(conversionPreview.capturedSelectors?.length ?? livePolledSelectors.length) > 0 &&
            <div className="space-y-2">
                  <p className="text-sm font-semibold flex items-center gap-1">
                    <Crosshair className="h-4 w-4 text-primary" />
                    Live-Captured Selectors ({(conversionPreview.capturedSelectors ?? livePolledSelectors).length})
                    <Badge
                  variant="outline"
                  className="text-xs bg-green-500/10 text-green-600 border-green-500/30 ml-1">
                  
                      validated
                    </Badge>
                  </p>
                  <ScrollArea className="h-[140px] border rounded-lg p-3 bg-green-500/5 overflow-auto">
                    <div className="space-y-1.5">
                      {(conversionPreview.capturedSelectors ?? livePolledSelectors).map((s: any, i: number) =>
                  <div
                    key={i}
                    className="flex items-center gap-3 text-xs border-b border-border/40 pb-1.5 last:border-0">
                    
                          <CheckCircle className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                          <span className="font-mono font-medium flex-1">
                            {s.element_name || s.automationId || s.label || `element-${i + 1}`}
                          </span>
                          {s.selector?.controlType &&
                    <Badge variant="outline" className="text-xs py-0">
                              {s.selector.controlType}
                            </Badge>
                    }
                          {s.selector?.automationId &&
                    <span className="font-mono text-muted-foreground">{s.selector.automationId}</span>
                    }
                        </div>
                  )}
                    </div>
                  </ScrollArea>
                </div>
            }

              {/* Summary */}
              <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg text-sm">
                <ChevronRight className="h-4 w-4 text-primary" />
                <span>
                  {conversionPreview.originalSteps.length} manual steps →{" "}
                  <strong>{editableConvertedSteps.length} automation steps</strong> for <strong>{importAppName}</strong>{" "}
                  using <strong>{importEngineMode.toUpperCase()}</strong> engine
                  {(conversionPreview.capturedSelectors?.length ?? 0) > 0 &&
                <span className="text-green-600 dark:text-green-400 ml-2">
                      + {conversionPreview.capturedSelectors!.length} live selectors
                    </span>
                }
                </span>
              </div>
            </div>
          }

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowConversionPreviewDialog(false);
                setShowImportDialog(true);
              }}>
              
              Back
            </Button>
            <Button onClick={handleSaveConvertedTest} disabled={!conversionPreview}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Save as Desktop Test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Capture Selector Dialog */}
      <Dialog
        open={showCaptureDialog}
        onOpenChange={(v) => {
          if (!isCapturingSelector) setShowCaptureDialog(v);
        }}>
        
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crosshair className="h-5 w-5 text-primary" />
              Capture Selector from Application
            </DialogTitle>
            <DialogDescription>
              Select a desktop agent, then click an element in your running application to capture its selector.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Desktop Agent</Label>
              <Select value={captureAgentId} onValueChange={setCaptureAgentId} disabled={isCapturingSelector}>
                <SelectTrigger>
                  <SelectValue placeholder={isLoadingAgents ? "Loading agents..." : "Select an agent"} />
                </SelectTrigger>
                <SelectContent>
                  {availableAgents.map((agent) =>
                  <SelectItem key={agent.id} value={agent.id}>
                      <div className="flex items-center gap-2">
                        <div
                        className={cn(
                          "w-2 h-2 rounded-full",
                          isAgentOnline(agent) ? "bg-green-500" : "bg-destructive"
                        )} />
                      

                        <span>{agent.agent_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {isAgentOnline(agent) ? "(online)" : "(offline)"}
                        </span>
                      </div>
                    </SelectItem>
                  )}
                  {availableAgents.length === 0 && !isLoadingAgents &&
                  <SelectItem value="none" disabled>
                      No agents registered
                    </SelectItem>
                  }
                </SelectContent>
              </Select>
            </div>

            {isCapturingSelector &&
            <div className="space-y-3 p-4 bg-primary/5 border border-primary/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 text-primary animate-spin" />
                  <span className="font-medium text-sm">Waiting for element selection...</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Click on any element in your desktop application. The agent will capture its properties.
                </p>
              </div>
            }

            {captureSelectorMessage && !isCapturingSelector &&
            <div
              className={cn(
                "p-3 rounded-lg text-sm",
                captureSelectorMessage.includes("success") ?
                "bg-green-500/10 text-green-700 dark:text-green-400" :
                captureSelectorMessage.includes("Error") ||
                captureSelectorMessage.includes("failed") ||
                captureSelectorMessage.includes("timed out") ?
                "bg-destructive/10 text-destructive" :
                "bg-muted text-muted-foreground"
              )}>
              
                {captureSelectorMessage}
              </div>
            }
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCaptureDialog(false)} disabled={isCapturingSelector}>
              Cancel
            </Button>
            <Button onClick={startSelectorCapture} disabled={isCapturingSelector || !captureAgentId}>
              {isCapturingSelector ?
              <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Capturing...
                </> :

              <>
                  <Crosshair className="mr-2 h-4 w-4" /> Start Capture
                </>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Execution Detail Dialog */}
      <Dialog open={showExecutionDetailDialog} onOpenChange={setShowExecutionDetailDialog}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Execution Details</DialogTitle>
            <DialogDescription>
              Detailed step-by-step execution results
              {selectedExecutionDetail && ` — ${new Date(selectedExecutionDetail.created_at).toLocaleString()}`}
            </DialogDescription>
          </DialogHeader>

          {selectedExecutionDetail &&
          <div className="flex-1 overflow-hidden flex flex-col">
              {/* Summary Section */}
              <div className="grid grid-cols-4 gap-4 mb-4 p-4 bg-muted/30 rounded-lg">
                <div>
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <div className="flex items-center gap-2 mt-1">
                    {getStatusIcon(selectedExecutionDetail.status)}
                    <span className="font-semibold capitalize">{selectedExecutionDetail.status}</span>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Duration</Label>
                  <p className="font-semibold mt-1">
                    {selectedExecutionDetail.duration_ms ?
                  `${(selectedExecutionDetail.duration_ms / 1000).toFixed(1)}s` :
                  "N/A"}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Engine</Label>
                  <p className="mt-1">
                    <Badge variant="outline">{selectedExecutionDetail.engine_mode?.toUpperCase() || "N/A"}</Badge>
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Steps</Label>
                  <p className="font-semibold mt-1">
                    <span className="text-green-500">{selectedExecutionDetail.passed_steps}</span>
                    {" / "}
                    <span className="text-destructive">{selectedExecutionDetail.failed_steps}</span>
                    {" / "}
                    {selectedExecutionDetail.total_steps}
                  </p>
                </div>
              </div>

              <ScrollArea className="flex-1 pr-4 overflow-auto" style={{ maxHeight: "60vh" }}>
                {/* Error Message */}
                {selectedExecutionDetail.error_message &&
              <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertCircle className="h-4 w-4 text-destructive" />
                      <span className="text-sm font-semibold text-destructive">Execution Error</span>
                    </div>
                    <p className="text-sm text-destructive">{selectedExecutionDetail.error_message}</p>
                  </div>
              }

                {/* Step Results with Test Steps */}
                {(() => {
                const stepResults = selectedExecutionDetail.step_results;
                const testSteps = selectedTest?.steps || [];
                const hasDetailedResults = Array.isArray(stepResults) && stepResults.length > 0;
                const maxLen = Math.max(hasDetailedResults ? stepResults.length : 0, testSteps.length);

                if (maxLen === 0) {
                  return (
                    <div className="text-center py-8 text-muted-foreground">
                        <Activity className="h-8 w-8 mx-auto mb-3 opacity-50" />
                        <p className="text-sm">No detailed step results available for this execution</p>
                        <p className="text-xs mt-1">
                          Step-level details are captured when tests run via a desktop agent
                        </p>
                      </div>);

                }

                // When step_results is empty but we have pass/fail counts,
                // infer status from the counts: first N steps passed, rest failed
                const inferStatus = (idx: number): string => {
                  if (hasDetailedResults) return "unknown";
                  const passedCount = selectedExecutionDetail.passed_steps || 0;
                  const failedCount = selectedExecutionDetail.failed_steps || 0;
                  const totalExecuted = passedCount + failedCount;
                  if (idx >= totalExecuted) return "skipped";
                  // If all passed, mark all as passed; if some failed, last ones failed
                  if (failedCount === 0) return "passed";
                  if (idx < passedCount) return "passed";
                  return "failed";
                };

                return (
                  <div className="space-y-3">
                      {Array.from({ length: maxLen }).map((_, index) => {
                      const result: any = hasDetailedResults ? stepResults[index] : null;
                      const testStep: any = testSteps[index];
                      const status = result?.status || inferStatus(index);

                      return (
                        <Card
                          key={index}
                          className={cn(
                            "border-l-4",
                            status === "passed" ?
                            "border-l-green-500" :
                            status === "failed" ?
                            "border-l-destructive" :
                            "border-l-yellow-500"
                          )}>
                          
                            <CardContent className="p-4">
                              <div className="space-y-3">
                                {/* Step Header */}
                                <div className="flex items-start justify-between">
                                  <div className="flex items-start gap-3">
                                    <div
                                    className={cn(
                                      "flex items-center justify-center w-7 h-7 rounded-full font-semibold text-sm",
                                      status === "passed" ?
                                      "bg-green-500/10 text-green-600" :
                                      status === "failed" ?
                                      "bg-destructive/10 text-destructive" :
                                      "bg-primary/10 text-primary"
                                    )}>
                                    
                                      {index + 1}
                                    </div>
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <Badge variant="outline" className="font-mono text-xs">
                                          {result?.action || testStep?.action || testStep?.type || "unknown"}
                                        </Badge>
                                        {status === "passed" ?
                                      <CheckCircle className="h-4 w-4 text-green-500" /> :
                                      status === "failed" ?
                                      <XCircle className="h-4 w-4 text-destructive" /> :

                                      <Clock className="h-4 w-4 text-yellow-500" />
                                      }
                                        <span className="text-xs font-semibold capitalize">{status}</span>
                                      </div>
                                      {/* Test Step Description */}
                                      <p className="text-sm font-medium">
                                        {result?.description ||
                                      testStep?.description ||
                                      result?.step_description ||
                                      `Step ${index + 1}`}
                                      </p>
                                    </div>
                                  </div>
                                  {(result?.duration || result?.duration_ms) &&
                                <Badge variant="secondary" className="text-xs">
                                      {result.duration || result.duration_ms}ms
                                    </Badge>
                                }
                                </div>

                                {/* Test Step Details */}
                                <div className="ml-10 space-y-2">
                                  {/* Original test step info */}
                                  {testStep &&
                                <div className="p-2 bg-muted/40 rounded-md space-y-1 border border-border/50">
                                      <span className="text-xs font-semibold text-muted-foreground">
                                        Test Step Definition
                                      </span>
                                      {testStep.target?.label &&
                                  <div className="flex items-start gap-2 text-xs">
                                          <span className="text-muted-foreground font-semibold min-w-[80px]">
                                            Target:
                                          </span>
                                          <code className="font-mono bg-background px-2 py-0.5 rounded">
                                            {testStep.target.label}
                                          </code>
                                        </div>
                                  }
                                      {testStep.value &&
                                  <div className="flex items-start gap-2 text-xs">
                                          <span className="text-muted-foreground font-semibold min-w-[80px]">
                                            Input:
                                          </span>
                                          <span className="font-mono bg-background px-2 py-0.5 rounded">
                                            {testStep.value}
                                          </span>
                                        </div>
                                  }
                                      {(testStep.expectedValue || testStep.expected) &&
                                  <div className="flex items-start gap-2 text-xs">
                                          <span className="text-muted-foreground font-semibold min-w-[80px]">
                                            Expected:
                                          </span>
                                          <span className="font-mono bg-background px-2 py-0.5 rounded">
                                            {testStep.expectedValue || testStep.expected}
                                          </span>
                                        </div>
                                  }
                                    </div>
                                }

                                  {/* Execution result details */}
                                  {result &&
                                <>
                                      {(result.selector || result.step?.selector || result.element_name) &&
                                  <div className="flex items-start gap-2 text-xs">
                                          <span className="text-muted-foreground font-semibold min-w-[80px]">
                                            Selector:
                                          </span>
                                          <code className="font-mono bg-muted px-2 py-1 rounded">
                                            {typeof (result.selector || result.step?.selector) === "object" ?
                                      JSON.stringify(result.selector || result.step?.selector) :
                                      result.selector || result.step?.selector || result.element_name}
                                          </code>
                                        </div>
                                  }
                                      {(result.value || result.step?.value || result.input_value) &&
                                  <div className="flex items-start gap-2 text-xs">
                                          <span className="text-muted-foreground font-semibold min-w-[80px]">
                                            Value:
                                          </span>
                                          <span className="font-mono bg-muted px-2 py-1 rounded">
                                            {result.value || result.step?.value || result.input_value}
                                          </span>
                                        </div>
                                  }
                                      {(result.expected_value || result.expected) &&
                                  <div className="flex items-start gap-2 text-xs">
                                          <span className="text-muted-foreground font-semibold min-w-[80px]">
                                            Expected:
                                          </span>
                                          <span className="font-mono bg-muted px-2 py-1 rounded">
                                            {result.expected_value || result.expected}
                                          </span>
                                        </div>
                                  }
                                      {(result.actual_value || result.actual) &&
                                  <div className="flex items-start gap-2 text-xs">
                                          <span className="text-muted-foreground font-semibold min-w-[80px]">
                                            Actual:
                                          </span>
                                          <span className="font-mono bg-muted px-2 py-1 rounded">
                                            {result.actual_value || result.actual}
                                          </span>
                                        </div>
                                  }
                                      {(result.error || result.error_message) &&
                                  <div className="flex flex-col gap-2 text-xs mt-2">
                                          <span className="text-destructive font-semibold">Error Log:</span>
                                          <pre className="text-destructive bg-destructive/5 px-3 py-2 rounded text-xs whitespace-pre-wrap overflow-x-auto max-h-60 overflow-y-auto font-mono border border-destructive/20">
                                            {result.error || result.error_message}
                                          </pre>
                                        </div>
                                  }
                                      {result.screenshot &&
                                  <div className="mt-2">
                                          <Label className="text-xs text-muted-foreground mb-1 block">
                                            {result.status === "failed" ? "📸 Failure Screenshot" : "Screenshot"}
                                          </Label>
                                          <img
                                      src={result.screenshot}
                                      alt={`Step ${index + 1} ${result.status === "failed" ? "failure" : ""} screenshot`}
                                      className="w-full max-w-xl border rounded-lg shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
                                      onClick={() => setFullscreenScreenshot(result.screenshot)}
                                      title="Click to view fullscreen" />
                                    
                                        </div>
                                  }
                                    </>
                                }
                                </div>
                              </div>
                            </CardContent>
                          </Card>);

                    })}
                    </div>);

              })()}
              </ScrollArea>
            </div>
          }

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExecutionDetailDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fullscreen Screenshot Dialog */}
      <Dialog open={!!fullscreenScreenshot} onOpenChange={() => setFullscreenScreenshot(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-2">
          {fullscreenScreenshot &&
          <img src={fullscreenScreenshot} alt="Screenshot" className="w-full h-full object-contain rounded" />
          }
        </DialogContent>
      </Dialog>
    </div>);

}