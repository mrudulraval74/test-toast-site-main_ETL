import { useState, useCallback, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Circle, Square, Plus, Trash2, Edit, Copy, Play, ChevronUp, ChevronDown, Save, Upload, Radio, AlertCircle, Globe, Server, Download, Puzzle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { RecordedStep, SetupConfig } from "./types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useRequestInterceptor } from "./useRequestInterceptor";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { downloadPerfExtension } from "./extensionGenerator";
import { convertRecordedToJMX, downloadJMXFile } from "./jmxConverter";

interface RecordingTabProps {
  steps: RecordedStep[];
  onStepsChange: (steps: RecordedStep[]) => void;
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  setupConfig: SetupConfig;
  recordingMode: 'proxy' | 'browser' | 'extension';
  onRecordingModeChange: (mode: 'proxy' | 'browser' | 'extension') => void;
}

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const;

const getMethodColor = (method: string) => {
  switch (method) {
    case 'GET': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
    case 'POST': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    case 'PUT': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    case 'DELETE': return 'bg-red-500/10 text-red-500 border-red-500/20';
    case 'PATCH': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
    default: return 'bg-muted text-muted-foreground';
  }
};

export const RecordingTab = ({
  steps,
  onStepsChange,
  isRecording,
  onStartRecording,
  onStopRecording,
  setupConfig,
  recordingMode,
  onRecordingModeChange
}: RecordingTabProps) => {
  const { toast } = useToast();
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const stepsRef = useRef(steps);

  // Keep stepsRef in sync
  useEffect(() => {
    stepsRef.current = steps;
  }, [steps]);

  // Handler for captured requests
  const handleRequestCaptured = useCallback((request: {
    method: RecordedStep['method'];
    url: string;
    headers: Record<string, string>;
    body: string;
    timestamp: number;
  }) => {
    const currentSteps = stepsRef.current;

    const newStep: RecordedStep = {
      id: crypto.randomUUID(),
      stepNo: currentSteps.length + 1,
      requestName: `${request.method} ${(() => {
        try {
          return new URL(request.url, window.location.origin).pathname;
        } catch {
          return request.url;
        }
      })()}`,
      method: request.method,
      url: request.url,
      headers: request.headers,
      queryParams: {},
      body: request.body,
      thinkTime: 1000,
      timestamp: request.timestamp
    };

    // Parse query params from URL
    try {
      const urlObj = new URL(request.url, window.location.origin);
      urlObj.searchParams.forEach((value, key) => {
        newStep.queryParams[key] = value;
      });
    } catch {
      // Invalid URL, skip query param parsing
    }

    onStepsChange([...currentSteps, newStep]);
    toast({
      title: "Request captured",
      description: `${newStep.method} ${newStep.requestName}`
    });
  }, [onStepsChange, toast]);

  // Use the request interceptor hook for browser mode
  useRequestInterceptor({
    enabled: isRecording && recordingMode === 'browser',
    onRequestCaptured: handleRequestCaptured
  });

  // Listen for extension messages (PERF_STEP)
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'FROM_EXTENSION') {
        if (event.data.payload?.type === 'PERF_STEP') {
          const step = event.data.payload.step;
          handleRequestCaptured({
            method: step.method as RecordedStep['method'],
            url: step.url,
            headers: {},
            body: '',
            timestamp: step.timestamp
          });
        }
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [handleRequestCaptured]);

  // Start/Stop recording via extension
  const startExtensionRecording = useCallback(() => {
    window.postMessage({
      type: 'FROM_APP',
      payload: { type: 'START_PERF_RECORDING' }
    }, '*');
  }, []);

  const stopExtensionRecording = useCallback(() => {
    window.postMessage({
      type: 'FROM_APP',
      payload: { type: 'STOP_PERF_RECORDING' }
    }, '*');
  }, []);

  // Recording duration timer
  useEffect(() => {
    if (isRecording) {
      const durationInterval = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

      recordingIntervalRef.current = durationInterval;

      return () => {
        if (recordingIntervalRef.current) {
          clearInterval(recordingIntervalRef.current);
          recordingIntervalRef.current = null;
        }
      };
    } else {
      setRecordingDuration(0);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  }, [isRecording]);


  const importJmx = useCallback((jmxXml: string) => {
    try {
      const parser = new DOMParser();
      const xml = parser.parseFromString(jmxXml, 'text/xml');

      const samplers = Array.from(xml.querySelectorAll('HTTPSamplerProxy'));

      if (samplers.length === 0) {
        toast({ title: "Import failed", description: "No HTTP samplers found in JMX", variant: "destructive" });
        return;
      }

      const newSteps: RecordedStep[] = [];
      const currentSteps = steps; // Use current steps from closure

      samplers.forEach((sampler, idx) => {
        const method = sampler.querySelector('stringProp[name="HTTPSampler.method"]')?.textContent || 'GET';
        const domain = sampler.querySelector('stringProp[name="HTTPSampler.domain"]')?.textContent || '';
        const path = sampler.querySelector('stringProp[name="HTTPSampler.path"]')?.textContent || '';
        const protocol = sampler.querySelector('stringProp[name="HTTPSampler.protocol"]')?.textContent || 'http';

        const step: RecordedStep = {
          id: crypto.randomUUID(),
          stepNo: currentSteps.length + newSteps.length + 1,
          requestName: sampler.getAttribute("testname") || `Request ${currentSteps.length + newSteps.length + 1}`,
          method: (method as RecordedStep['method']) || 'GET',
          url: `${protocol}://${domain}${path}`,
          headers: {},
          queryParams: {},
          body: '',
          thinkTime: 1000,
          timestamp: Date.now()
        };

        newSteps.push(step);
      });

      if (newSteps.length > 0) {
        onStepsChange([...currentSteps, ...newSteps]);
        console.log('Imported', samplers.length, 'JMX steps');
        toast({ title: "JMX Imported", description: `${newSteps.length} steps added from JMeter script` });
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Import failed", description: "Invalid JMX format", variant: "destructive" });
    }
  }, [steps, onStepsChange, toast]);

  const importJson = useCallback((content: string) => {
    try {
      const imported = JSON.parse(content);
      if (Array.isArray(imported)) {
        const validSteps = imported.map((s: any, idx: number) => ({
          ...s,
          id: crypto.randomUUID(),
          stepNo: steps.length + idx + 1
        }));
        onStepsChange([...steps, ...validSteps]);
        toast({ title: "Steps imported", description: `${validSteps.length} steps added` });
      }
    } catch {
      toast({ title: "Import failed", description: "Invalid JSON format", variant: "destructive" });
    }
  }, [steps, onStepsChange, toast]);

  useEffect(() => {
    const input = document.getElementById('jmx-import') as HTMLInputElement;

    if (!input) return;

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      const text = await file.text();
      if (file.name.endsWith('.jmx')) {
        importJmx(text);
      } else {
        importJson(text);
      }
      input.value = '';
    };
  }, [importJmx, importJson]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<RecordedStep | null>(null);
  const [importedJsonSteps, setImportedJsonSteps] = useState<RecordedStep[]>([]);
  const [newStep, setNewStep] = useState<Partial<RecordedStep>>({
    method: 'GET',
    url: '',
    requestName: '',
    headers: {},
    queryParams: {},
    body: '',
    thinkTime: 1000
  });
  const [headersText, setHeadersText] = useState('');
  const [queryParamsText, setQueryParamsText] = useState('');

  const parseKeyValueText = (text: string): Record<string, string> => {
    const result: Record<string, string> = {};
    text.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split(':');
      if (key?.trim()) {
        result[key.trim()] = valueParts.join(':').trim();
      }
    });
    return result;
  };

  const formatKeyValueText = (obj: Record<string, string>): string => {
    return Object.entries(obj).map(([k, v]) => `${k}: ${v}`).join('\n');
  };

  const handleAddStep = () => {
    if (!newStep.url?.trim()) {
      toast({
        title: "URL required",
        description: "Please enter a valid URL",
        variant: "destructive"
      });
      return;
    }

    const step: RecordedStep = {
      id: crypto.randomUUID(),
      stepNo: steps.length + 1,
      requestName: newStep.requestName || `Request ${steps.length + 1}`,
      method: newStep.method as RecordedStep['method'],
      url: newStep.url,
      headers: parseKeyValueText(headersText),
      queryParams: parseKeyValueText(queryParamsText),
      body: newStep.body || '',
      thinkTime: newStep.thinkTime || 1000,
      timestamp: Date.now()
    };

    onStepsChange([...steps, step]);
    resetForm();
    setIsAddDialogOpen(false);
    toast({ title: "Step added", description: `${step.method} ${step.requestName}` });
  };

  const handleEditStep = () => {
    if (!editingStep) return;

    const updatedStep = {
      ...editingStep,
      ...newStep,
      headers: parseKeyValueText(headersText),
      queryParams: parseKeyValueText(queryParamsText)
    } as RecordedStep;

    const updatedSteps = steps.map(s => s.id === updatedStep.id ? updatedStep : s);
    onStepsChange(updatedSteps);
    resetForm();
    setEditingStep(null);
    toast({ title: "Step updated" });
  };

  const handleDeleteStep = (id: string) => {
    const updatedSteps = steps
      .filter(s => s.id !== id)
      .map((s, idx) => ({ ...s, stepNo: idx + 1 }));
    onStepsChange(updatedSteps);
    toast({ title: "Step deleted" });
  };

  const handleDuplicateStep = (step: RecordedStep) => {
    const duplicatedStep: RecordedStep = {
      ...step,
      id: crypto.randomUUID(),
      stepNo: steps.length + 1,
      requestName: `${step.requestName} (Copy)`,
      timestamp: Date.now()
    };
    onStepsChange([...steps, duplicatedStep]);
    toast({ title: "Step duplicated" });
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === steps.length - 1)
    ) return;

    const newSteps = [...steps];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    [newSteps[index], newSteps[swapIndex]] = [newSteps[swapIndex], newSteps[index]];

    const reorderedSteps = newSteps.map((s, idx) => ({ ...s, stepNo: idx + 1 }));
    onStepsChange(reorderedSteps);
  };

  const resetForm = () => {
    setNewStep({
      method: 'GET',
      url: '',
      requestName: '',
      headers: {},
      queryParams: {},
      body: '',
      thinkTime: 1000
    });
    setHeadersText('');
    setQueryParamsText('');
  };

  const openEditDialog = (step: RecordedStep) => {
    setEditingStep(step);
    setNewStep({
      method: step.method,
      url: step.url,
      requestName: step.requestName,
      body: step.body,
      thinkTime: step.thinkTime
    });
    setHeadersText(formatKeyValueText(step.headers));
    setQueryParamsText(formatKeyValueText(step.queryParams));
    setIsAddDialogOpen(true);
  };



  const handleExportSteps = () => {
    const blob = new Blob([JSON.stringify(steps, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'test-template.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportToJMX = (stepsToExport: RecordedStep[] = steps) => {
    if (stepsToExport.length === 0) {
      toast({
        title: "No steps to export",
        description: "Add some steps before exporting to JMX",
        variant: "destructive"
      });
      return;
    }

    try {
      const jmxContent = convertRecordedToJMX(stepsToExport);
      downloadJMXFile(jmxContent, 'test-plan.jmx');
      toast({
        title: "JMX Exported",
        description: `Successfully exported ${stepsToExport.length} steps to JMeter format`
      });
    } catch (error) {
      console.error('JMX export error:', error);
      toast({
        title: "Export failed",
        description: "Failed to export to JMX format",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Recording Status Alert */}
      {isRecording && (
        <Alert className="border-red-500/50 bg-red-500/10">
          <Radio className="h-4 w-4 text-red-500 animate-pulse" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-red-600 dark:text-red-400">
              Recording in progress via{' '}
              <strong>{recordingMode === 'browser' ? 'Browser Interception' : `${setupConfig.browser} Proxy`}</strong>
              {recordingMode === 'proxy' && (
                <> at <code className="bg-background/50 px-1 rounded">{setupConfig.proxyHost}:{setupConfig.proxyPort}</code></>
              )}
            </span>
            <Badge variant="outline" className="ml-2 border-red-500 text-red-500">
              {formatDuration(recordingDuration)}
            </Badge>
          </AlertDescription>
        </Alert>
      )}

      {/* Setup Validation Warning */}
      {!setupConfig.enableRecording && !isRecording && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Recording is disabled. Enable recording in the Setup tab to capture requests.
          </AlertDescription>
        </Alert>
      )}

      {recordingMode === 'proxy' && setupConfig.enableRecording && setupConfig.certificate.status !== 'generated' && !isRecording && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            SSL Certificate not generated. Generate a certificate in Setup tab to capture HTTPS traffic via proxy.
          </AlertDescription>
        </Alert>
      )}

      {/* Recording Mode Selection */}
      {!isRecording && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recording Mode</CardTitle>
            <CardDescription>
              Choose how to capture HTTP requests for your test script
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={recordingMode}
              onValueChange={(value) => onRecordingModeChange(value as 'proxy' | 'browser' | 'extension')}
              className="grid grid-cols-1 md:grid-cols-3 gap-4"
            >
              <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="browser" id="mode-browser" className="mt-1" />
                <div className="space-y-1">
                  <Label htmlFor="mode-browser" className="flex items-center gap-2 cursor-pointer font-medium">
                    <Globe className="h-4 w-4 text-blue-500" />
                    Browser Interception
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Captures fetch/XHR requests from this page. No setup needed.
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="extension" id="mode-extension" className="mt-1" />
                <div className="space-y-1">
                  <Label htmlFor="mode-extension" className="flex items-center gap-2 cursor-pointer font-medium">
                    <Puzzle className="h-4 w-4 text-green-500" />
                    Browser Extension
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Record from any tab. Download extension below.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 gap-1"
                    onClick={(e) => {
                      e.preventDefault();
                      downloadPerfExtension();
                    }}
                  >
                    <Download className="h-3 w-3" />
                    Download Extension
                  </Button>
                </div>
              </div>
              <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="proxy" id="mode-proxy" className="mt-1" />
                <div className="space-y-1">
                  <Label htmlFor="mode-proxy" className="flex items-center gap-2 cursor-pointer font-medium">
                    <Server className="h-4 w-4 text-orange-500" />
                    External Proxy
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Use mitmproxy or Charles. Import captured traffic.
                  </p>
                </div>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>
      )}

      {/* Recording Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isRecording ? (
              <Circle className="h-4 w-4 fill-red-500 text-red-500 animate-pulse" />
            ) : (
              <Circle className="h-4 w-4" />
            )}
            Recording Template
            {isRecording && (
              <Badge variant="outline" className="ml-2 border-red-500 text-red-500 animate-pulse">
                LIVE
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            {isRecording
              ? recordingMode === 'browser'
                ? "Intercepting browser requests. Make API calls from this page to capture them."
                : recordingMode === 'extension'
                  ? "Extension active. Requests captured in extension will be imported via clipboard."
                  : `Capturing requests from ${setupConfig.browser} browser via proxy. Perform actions in your browser to record them.`
              : "Record API calls manually or import from external sources. Build your test script step by step."
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            {!isRecording ? (
              <Button
                onClick={() => {
                  if (recordingMode === 'extension') {
                    startExtensionRecording();
                  }
                  onStartRecording();
                }}
                className="gap-2"
                disabled={!setupConfig.enableRecording || (recordingMode === 'proxy' && setupConfig.certificate.status !== 'generated')}
              >
                <Circle className="h-4 w-4 fill-current" />
                Start Recording
              </Button>
            ) : (
              <Button
                onClick={() => {
                  if (recordingMode === 'extension') {
                    stopExtensionRecording();
                  }
                  onStopRecording();
                }}
                variant="destructive"
                className="gap-2"
              >
                <Square className="h-4 w-4 fill-current" />
                Stop Recording
              </Button>
            )}

            {isRecording && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Steps captured:</span>
                <Badge variant="secondary">{steps.length}</Badge>
              </div>
            )}

            <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
              setIsAddDialogOpen(open);
              if (!open) {
                resetForm();
                setEditingStep(null);
              }
            }}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Request
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingStep ? 'Edit Request' : 'Add New Request'}</DialogTitle>
                  <DialogDescription>
                    Configure the HTTP request details
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <Label>Method</Label>
                      <Select
                        value={newStep.method}
                        onValueChange={(v) => setNewStep({ ...newStep, method: v as RecordedStep['method'] })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {HTTP_METHODS.map(m => (
                            <SelectItem key={m} value={m}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-3">
                      <Label>URL</Label>
                      <Input
                        placeholder="https://api.example.com/endpoint"
                        value={newStep.url}
                        onChange={(e) => setNewStep({ ...newStep, url: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Request Name</Label>
                    <Input
                      placeholder="Login Request"
                      value={newStep.requestName}
                      onChange={(e) => setNewStep({ ...newStep, requestName: e.target.value })}
                    />
                  </div>

                  <Tabs defaultValue="headers" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="headers">Headers</TabsTrigger>
                      <TabsTrigger value="params">Query Params</TabsTrigger>
                      <TabsTrigger value="body">Body</TabsTrigger>
                    </TabsList>
                    <TabsContent value="headers" className="mt-2">
                      <Textarea
                        placeholder="Content-Type: application/json&#10;Authorization: Bearer ${TOKEN}"
                        value={headersText}
                        onChange={(e) => setHeadersText(e.target.value)}
                        rows={5}
                        className="font-mono text-sm"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        One header per line in format: Header-Name: value
                      </p>
                    </TabsContent>
                    <TabsContent value="params" className="mt-2">
                      <Textarea
                        placeholder="page: 1&#10;limit: 20"
                        value={queryParamsText}
                        onChange={(e) => setQueryParamsText(e.target.value)}
                        rows={5}
                        className="font-mono text-sm"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        One param per line in format: paramName: value
                      </p>
                    </TabsContent>
                    <TabsContent value="body" className="mt-2">
                      <Textarea
                        placeholder='{"username": "${USERNAME}", "password": "${PASSWORD}"}'
                        value={newStep.body}
                        onChange={(e) => setNewStep({ ...newStep, body: e.target.value })}
                        rows={8}
                        className="font-mono text-sm"
                      />
                    </TabsContent>
                  </Tabs>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Think Time (ms)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={newStep.thinkTime}
                        onChange={(e) => setNewStep({ ...newStep, thinkTime: parseInt(e.target.value) || 0 })}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Delay before next request
                      </p>
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={editingStep ? handleEditStep : handleAddStep}>
                    {editingStep ? 'Update' : 'Add'} Request
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <div className="flex-1" />

            <input
              type="file"
              accept=".json,.jmx"
              className="hidden"
              id="jmx-import"
            />
            <Button variant="outline" size="sm" onClick={() => document.getElementById('jmx-import')?.click()}>
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportSteps} disabled={steps.length === 0}>
              <Save className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExportToJMX()} disabled={steps.length === 0} className="gap-2">
              <Download className="h-4 w-4" />
              Export as JMX
            </Button>
          </div>

          <div className="mt-4 border-t pt-4">
            <Label className="text-sm text-muted-foreground mb-2 block">Quick Import from JSON</Label>
            <Textarea
              id="perf-paste-import"
              placeholder="Paste recorded steps JSON array here (Ctrl+V)..."
              className="font-mono text-xs min-h-[80px]"
              onPaste={(e) => {
                const text = e.clipboardData.getData('text');
                if (!text) return;

                try {
                  const data = JSON.parse(text);
                  if (!Array.isArray(data)) {
                    toast({ title: "Invalid data", description: "Clipboard content is not a valid JSON array", variant: "destructive" });
                    return;
                  }

                  const newSteps: RecordedStep[] = [];
                  const currentSteps = steps;

                  data.forEach((req: any) => {
                    if (!req.url) return;
                    const method = (req.method || 'GET').toUpperCase() as RecordedStep['method'];

                    const step: RecordedStep = {
                      id: crypto.randomUUID(),
                      stepNo: currentSteps.length + newSteps.length + 1,
                      requestName: `${method} ${(() => {
                        try {
                          return new URL(req.url, window.location.origin).pathname;
                        } catch {
                          return req.url || 'Unknown';
                        }
                      })()}`,
                      method,
                      url: req.url,
                      headers: req.headers || {},
                      queryParams: {},
                      body: req.body || '',
                      thinkTime: 1000,
                      timestamp: req.timestamp || Date.now()
                    };

                    try {
                      const urlObj = new URL(step.url, window.location.origin);
                      urlObj.searchParams.forEach((value, key) => {
                        step.queryParams[key] = value;
                      });
                    } catch { /* ignore */ }

                    newSteps.push(step);
                  });

                  if (newSteps.length > 0) {
                    setImportedJsonSteps(newSteps);
                    onStepsChange([...currentSteps, ...newSteps]);
                    console.log('Imported', newSteps.length, 'steps');
                    toast({ title: "Steps Imported", description: `Successfully imported ${newSteps.length} steps.` });
                    const target = e.target as HTMLTextAreaElement;
                    setTimeout(() => { target.value = ''; }, 100);
                  }
                } catch (err) {
                  toast({ title: "Paste failed", description: "Invalid JSON format", variant: "destructive" });
                }
              }}
            />
            {importedJsonSteps.length > 0 && (
              <div className="mt-3 flex gap-2">
                <Badge variant="outline" className="text-xs">
                  {importedJsonSteps.length} steps imported
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleExportToJMX(importedJsonSteps)}
                  className="gap-2 text-xs"
                >
                  <Download className="h-3 w-3" />
                  Export as JMX
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recorded Steps Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recorded Steps ({steps.length})</CardTitle>
          <CardDescription>
            Manage your test script steps. Drag to reorder, edit or delete as needed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {steps.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Play className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No steps recorded yet</p>
              <p className="text-sm">Click "Add Request" to start building your test script</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead className="w-16">Order</TableHead>
                    <TableHead>Request Name</TableHead>
                    <TableHead className="w-20">Method</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead className="w-24">Think Time</TableHead>
                    <TableHead className="w-32">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {steps.map((step, index) => (
                    <TableRow key={step.id}>
                      <TableCell className="font-mono text-muted-foreground">
                        {step.stepNo}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => moveStep(index, 'up')}
                            disabled={index === 0}
                          >
                            <ChevronUp className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => moveStep(index, 'down')}
                            disabled={index === steps.length - 1}
                          >
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{step.requestName}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getMethodColor(step.method)}>
                          {step.method}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate font-mono text-sm">
                        {step.url}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {step.thinkTime}ms
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditDialog(step)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleDuplicateStep(step)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleDeleteStep(step.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
