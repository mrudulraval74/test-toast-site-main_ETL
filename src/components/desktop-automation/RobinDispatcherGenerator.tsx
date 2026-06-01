import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { Copy, FileText, Loader2, Download, Upload } from "lucide-react";

interface RobinDispatcherGeneratorProps {
  projectId: string;
}

const SUBFLOW_TEMPLATES: Record<string, string> = {
  launch_app: `SUBFLOW Subflow_LaunchApp
  INPUT Value
  System.RunApplication ApplicationPath: Value
END`,
  type: `SUBFLOW Subflow_Type
  INPUT Selector, Value
  UIAutomation.FocusElement Element: Selector
  MouseAndKeyboard.SendKeys TextToSend: Value
END`,
  click: `SUBFLOW Subflow_Click
  INPUT Selector
  UIAutomation.Click Element: Selector
END`,
  double_click: `SUBFLOW Subflow_DoubleClick
  INPUT Selector
  UIAutomation.Click Element: Selector ClickType: UIAutomation.ClickType.DoubleClick
END`,
  right_click: `SUBFLOW Subflow_RightClick
  INPUT Selector
  UIAutomation.Click Element: Selector ClickType: UIAutomation.ClickType.RightClick
END`,
  clear: `SUBFLOW Subflow_Clear
  INPUT Selector
  UIAutomation.FocusElement Element: Selector
  MouseAndKeyboard.SendKeys TextToSend: '{Control}a{Delete}'
END`,
  select: `SUBFLOW Subflow_Select
  INPUT Selector, Value
  UIAutomation.SelectMenuItem Element: Selector ItemName: Value
END`,
  assert_text: `SUBFLOW Subflow_AssertText
  INPUT Selector, Value
  UIAutomation.GetElementAttribute Element: Selector Attribute: 'Name' Value=> ActualValue
  IF ActualValue <> Value THEN
    THROW 'Assertion failed: expected "' + Value + '" but got "' + ActualValue + '"'
  END
END`,
  wait: `SUBFLOW Subflow_Wait
  INPUT Value
  Wait.WaitSeconds Seconds: Value
END`,
  wait_for_element: `SUBFLOW Subflow_WaitForElement
  INPUT Selector
  UIAutomation.WaitForElement Element: Selector Timeout: 30
END`,
  screenshot: `SUBFLOW Subflow_Screenshot
  INPUT Value
  Screen.TakeScreenshot ScreenshotFile: Value
END`,
  scroll: `SUBFLOW Subflow_Scroll
  INPUT Selector, Value
  UIAutomation.ScrollElement Element: Selector Direction: Value
END`,
  hover: `SUBFLOW Subflow_Hover
  INPUT Selector
  UIAutomation.HoverElement Element: Selector
END`,
  keyboard_shortcut: `SUBFLOW Subflow_KeyboardShortcut
  INPUT Value
  MouseAndKeyboard.SendKeys TextToSend: Value
END`,
  window_switch: `SUBFLOW Subflow_WindowSwitch
  INPUT Value
  UIAutomation.FocusWindow WindowTitle: Value
END`,
  window_close: `SUBFLOW Subflow_WindowClose
  INPUT Selector
  UIAutomation.CloseWindow Window: Selector
END`,
  drag_drop: `SUBFLOW Subflow_DragDrop
  INPUT Selector, Value
  UIAutomation.DragAndDrop Source: Selector Target: Value
END`,
};

function toPascalCase(s: string) {
  return s.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join("");
}

export function RobinDispatcherGenerator({ projectId }: RobinDispatcherGeneratorProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [actionCounts, setActionCounts] = useState<Record<string, number>>({});
  const [selectedActions, setSelectedActions] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchActions = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("desktop_tests")
        .select("steps")
        .eq("project_id", projectId);

      const counts: Record<string, number> = {};
      for (const test of data || []) {
        const steps = Array.isArray(test.steps) ? test.steps : [];
        for (const step of steps) {
          const s = step as any;
          const action = s.action || "click";
          counts[action] = (counts[action] || 0) + 1;
        }
      }
      setActionCounts(counts);
      setSelectedActions(new Set(Object.keys(counts)));
      setLoading(false);
    };
    fetchActions();
  }, [projectId]);

  const toggleAction = (action: string) => {
    setSelectedActions((prev) => {
      const next = new Set(prev);
      if (next.has(action)) next.delete(action);
      else next.add(action);
      return next;
    });
  };

  const mainScript = useMemo(() => {
    const actions = Array.from(selectedActions).sort();
    if (actions.length === 0) return "# No actions selected";

    const cases = actions.map((a) => {
      const subflowName = `Subflow_${toPascalCase(a)}`;
      const needsValue = !["click", "double_click", "right_click", "hover", "wait_for_element", "window_close"].includes(a);
      const needsSelector = !["launch_app", "wait", "screenshot", "keyboard_shortcut", "window_switch"].includes(a);

      let callArgs = "";
      if (needsSelector && needsValue) {
        callArgs = " (Selector: CurrentStep.params.selector, Value: CurrentStep.params.value)";
      } else if (needsSelector) {
        callArgs = " (Selector: CurrentStep.params.selector)";
      } else if (needsValue) {
        callArgs = " (Value: CurrentStep.params.value)";
      }

      return `      CASE = '${a}'\n        CALL ${subflowName}${callArgs}`;
    }).join("\n");

    return `# WISPR Dispatcher — Auto-generated Robin Script
# Generated: ${new Date().toISOString().split("T")[0]}

Variables.ConvertJsonToCustomObject Json: StepsJson CustomObject=> Steps

LOOP FOREACH CurrentStep IN Steps
    SWITCH CurrentStep.action
${cases}
      DEFAULT
        Display.ShowMessageDialog Title: 'WISPR' Message: 'Unknown action: ' + CurrentStep.action
    END
END`;
  }, [selectedActions]);

  const completeScript = useMemo(() => {
    const actions = Array.from(selectedActions).sort();
    const subflows = actions.map((action) => {
      return SUBFLOW_TEMPLATES[action] || `SUBFLOW Subflow_${toPascalCase(action)}\n  # TODO: implement ${action}\nEND`;
    }).join("\n\n");
    return `${mainScript}\n\n${subflows}`;
  }, [mainScript, selectedActions]);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copied to clipboard` });
  };

  const handleDownloadRobin = () => {
    const blob = new Blob([completeScript], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "WISPR_Dispatcher.robin";
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "WISPR_Dispatcher.robin downloaded" });
  };

  const handleDeployToPad = async () => {
    toast({
      title: "Deploy to PAD",
      description: "Use the 'Push Dispatcher to PAD' button in the WISPR Desktop Recorder to deploy directly via the Flow Management API.",
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const sortedActions = Object.entries(actionCounts).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Action Inventory */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Action Inventory</CardTitle>
            <CardDescription>Select actions to include in the dispatcher</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {sortedActions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No actions found in tests</p>
                ) : (
                  sortedActions.map(([action, count]) => (
                    <div
                      key={action}
                      className="flex items-center justify-between p-2 rounded hover:bg-accent/50 cursor-pointer"
                      onClick={() => toggleAction(action)}
                    >
                      <div className="flex items-center gap-2">
                        <Checkbox checked={selectedActions.has(action)} />
                        <span className="text-sm font-mono">{action}</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">{count}</Badge>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Right: Generated Script */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm">Generated Robin Dispatcher</CardTitle>
                <CardDescription>{selectedActions.size} action(s) included</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="default" size="sm" onClick={handleDeployToPad}>
                  <Upload className="mr-1 h-3.5 w-3.5" /> Deploy to PAD
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleCopy(completeScript, "Complete script")}>
                  <Copy className="mr-1 h-3.5 w-3.5" /> Copy Complete Script
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownloadRobin}>
                  <Download className="mr-1 h-3.5 w-3.5" /> Download .robin
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px]">
              <pre className="p-4 text-xs font-mono bg-muted/30 whitespace-pre overflow-x-auto text-foreground">
                {mainScript}
              </pre>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Subflow Templates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Subflow Templates</CardTitle>
          <CardDescription>Copy each subflow into your Power Automate Desktop flow</CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple">
            {Array.from(selectedActions).sort().map((action) => {
              const template = SUBFLOW_TEMPLATES[action] || `SUBFLOW Subflow_${toPascalCase(action)}\n  # TODO: implement ${action}\nEND`;
              return (
                <AccordionItem key={action} value={action}>
                  <AccordionTrigger className="text-sm">
                    <div className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-primary" />
                      <span className="font-mono">{`Subflow_${toPascalCase(action)}`}</span>
                      <Badge variant="outline" className="text-xs">{actionCounts[action] || 0} usages</Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="relative">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-2 right-2 h-7 text-xs"
                        onClick={() => handleCopy(template, `Subflow_${toPascalCase(action)}`)}
                      >
                        <Copy className="h-3 w-3 mr-1" /> Copy
                      </Button>
                      <pre className="p-4 text-xs font-mono bg-muted/30 rounded whitespace-pre overflow-x-auto">
                        {template}
                      </pre>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>

      {/* Setup Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Setup Instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-2">Option A — Deploy via Recorder (Recommended)</h4>
              <ol className="list-decimal list-inside space-y-1.5 text-sm text-muted-foreground">
                <li><strong className="text-foreground">Open the WISPR Desktop Recorder</strong> on your Windows machine</li>
                <li><strong className="text-foreground">Select PAD engine mode</strong> and enter your Environment ID</li>
                <li><strong className="text-foreground">To UPDATE an existing flow:</strong> enter the <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">Dataverse URL</code> (e.g. https://org12345.crm.dynamics.com) and <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">PAD Flow ID</code> (GUID)</li>
                <li><strong className="text-foreground">Click "📤 Push Dispatcher to PAD"</strong> — the dispatcher flow is created or updated automatically</li>
                <li><strong className="text-foreground">Copy the Workflow ID</strong> shown on success → paste into the test's PAD Flow ID field</li>
              </ol>
            </div>
            <div className="border-t pt-3">
              <h4 className="text-sm font-semibold text-foreground mb-2">Option B — Manual Paste (Fallback)</h4>
              <ol className="list-decimal list-inside space-y-1.5 text-sm text-muted-foreground">
                <li><strong className="text-foreground">Click "Copy Complete Script"</strong> above to copy the full dispatcher + subflows</li>
                <li><strong className="text-foreground">Open Power Automate Desktop</strong> → create a new flow named <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">WISPR_Dispatcher</code></li>
                <li><strong className="text-foreground">Press <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{"{ }"}</code> (top-right)</strong> to open the Robin code editor view</li>
                <li><strong className="text-foreground">Paste the script</strong> into the code editor and save</li>
              </ol>
              <p className="text-xs text-muted-foreground mt-2 italic">Note: PAD's visual designer does not accept pasted text — you must use the Robin code editor toggle.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
