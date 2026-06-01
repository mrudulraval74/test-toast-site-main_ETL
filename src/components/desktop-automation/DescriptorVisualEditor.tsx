import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Save, History, Trash2, MousePointer, ChevronDown, ChevronUp,
  Plus, Wrench, FlaskConical, Code, LayoutGrid, X
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DescriptorAttribute {
  name: string;
  operator: string;
  value: string;
  enabled: boolean;
}

interface DescriptorHierarchyNode {
  index: number;
  type: string;
  label: string;
  enabled: boolean;
  attributes: DescriptorAttribute[];
}

interface DescriptorVisualEditorProps {
  element: {
    id: string;
    name: string;
    element_type: string;
    element_uid: string;
    current_version: number;
    confidence_score: number;
    retry_count: number;
    timeout_ms: number;
    failure_count: number;
    descriptor: any;
    is_active: boolean;
  };
  onSave: (descriptor: any) => void;
  onViewHistory: () => void;
  onClose: () => void;
  onDelete: () => void;
}

const OPERATORS = ["Equal to", "Contains", "Starts with", "Ends with", "Regex"];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function descriptorToHierarchy(descriptor: any): DescriptorHierarchyNode[] {
  if (descriptor?.hierarchy && Array.isArray(descriptor.hierarchy)) {
    return descriptor.hierarchy;
  }

  const primary = descriptor?.primary || descriptor || {};
  const nodes: DescriptorHierarchyNode[] = [];

  // Window node
  const windowAttrs: DescriptorAttribute[] = [];
  if (primary.className || primary.windowClass) {
    windowAttrs.push({ name: "Class", operator: "Equal to", value: primary.className || primary.windowClass || "", enabled: true });
  }
  const winName = primary.windowTitle || primary.parentWindow || primary.name;
  if (winName) {
    windowAttrs.push({ name: "Name", operator: "Equal to", value: winName, enabled: true });
  }
  if (windowAttrs.length > 0) {
    nodes.push({
      index: 1, type: "Window",
      label: `Window '${winName || "App"}'`,
      enabled: true, attributes: windowAttrs,
    });
  }

  // Intermediate nodes from hierarchyPath
  if (primary.hierarchyPath && Array.isArray(primary.hierarchyPath)) {
    primary.hierarchyPath.forEach((node: any) => {
      const attrs: DescriptorAttribute[] = [];
      if (node.class) attrs.push({ name: "Class", operator: "Equal to", value: node.class, enabled: true });
      if (node.id) attrs.push({ name: "Id", operator: "Equal to", value: node.id, enabled: true });
      if (node.name) attrs.push({ name: "Name", operator: "Equal to", value: node.name, enabled: false });
      nodes.push({
        index: nodes.length + 1, type: node.type || "Group",
        label: `${node.type || "Group"} '${node.name || node.id || ""}'`,
        enabled: true, attributes: attrs,
      });
    });
  }

  // AutomationId container
  if (primary.automationId && !primary.hierarchyPath) {
    nodes.push({
      index: nodes.length + 1, type: "Custom", label: "UI Custom",
      enabled: true,
      attributes: [{ name: "Id", operator: "Equal to", value: primary.automationId, enabled: true }],
    });
  }

  // Target element
  const controlType = primary.controlType || "Button";
  const targetAttrs: DescriptorAttribute[] = [
    { name: "Class", operator: "Equal to", value: controlType, enabled: true },
    { name: "Enabled", operator: "Equal to", value: "True", enabled: false },
  ];
  if (primary.automationId) targetAttrs.push({ name: "Id", operator: "Equal to", value: primary.automationId, enabled: true });
  targetAttrs.push({ name: "IsDefault", operator: "Equal to", value: "False", enabled: false });
  if (primary.name || primary.label) targetAttrs.push({ name: "Name", operator: "Equal to", value: primary.name || primary.label || "", enabled: false });
  targetAttrs.push({ name: "Ordinal", operator: "Equal to", value: "0", enabled: false });
  targetAttrs.push({ name: "Visible", operator: "Equal to", value: "True", enabled: false });

  nodes.push({
    index: nodes.length + 1, type: controlType,
    label: `${controlType} '${primary.name || primary.label || "element"}'`,
    enabled: true, attributes: targetAttrs,
  });

  if (nodes.length === 0) {
    nodes.push({ index: 1, type: "Custom", label: "Element", enabled: true, attributes: [{ name: "Name", operator: "Equal to", value: "", enabled: true }] });
  }

  return nodes;
}

function hierarchyToDescriptor(hierarchy: DescriptorHierarchyNode[], originalDescriptor: any): any {
  const previewSelector = buildPreviewSelector(hierarchy);
  const primary: any = { ...(originalDescriptor?.primary || {}) };

  const targetNode = hierarchy[hierarchy.length - 1];
  if (targetNode) {
    const getAttr = (n: string) => targetNode.attributes.find(a => a.name === n && a.enabled)?.value;
    if (getAttr("Id")) primary.automationId = getAttr("Id");
    if (getAttr("Name")) primary.name = getAttr("Name");
    if (getAttr("Class")) primary.controlType = getAttr("Class");
  }
  const windowNode = hierarchy.find(h => h.type === "Window");
  if (windowNode) {
    const wn = windowNode.attributes.find(a => a.name === "Name" && a.enabled)?.value;
    if (wn) primary.windowTitle = wn;
    const wc = windowNode.attributes.find(a => a.name === "Class" && a.enabled)?.value;
    if (wc) primary.className = wc;
  }

  return { ...originalDescriptor, hierarchy, previewSelector, primary };
}

function buildPreviewSelector(hierarchy: DescriptorHierarchyNode[]): string {
  return hierarchy
    .filter(el => el.enabled)
    .map(el => {
      const attrs = el.attributes.filter(a => a.enabled).map(a => `[${a.name}="${a.value}"]`).join("");
      return `${el.type.toLowerCase()}${attrs}`;
    })
    .join(" > ");
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function DescriptorVisualEditor({ element, onSave, onViewHistory, onClose, onDelete }: DescriptorVisualEditorProps) {
  const [editorMode, setEditorMode] = useState<"visual" | "json">("visual");
  const [hierarchy, setHierarchy] = useState<DescriptorHierarchyNode[]>(() => descriptorToHierarchy(element.descriptor));
  const [selectedIdx, setSelectedIdx] = useState<number>(() => Math.max(0, descriptorToHierarchy(element.descriptor).length - 1));
  const [previewOpen, setPreviewOpen] = useState(true);
  const [jsonText, setJsonText] = useState(() => JSON.stringify(element.descriptor || {}, null, 2));
  const [jsonValid, setJsonValid] = useState(true);

  const previewSelector = useMemo(() => buildPreviewSelector(hierarchy), [hierarchy]);
  const selectedNode = hierarchy[selectedIdx] || null;

  useEffect(() => {
    if (editorMode === "json") {
      const desc = hierarchyToDescriptor(hierarchy, element.descriptor);
      setJsonText(JSON.stringify(desc, null, 2));
      setJsonValid(true);
    }
  }, [editorMode]);

  const toggleNodeEnabled = (idx: number) => {
    const updated = [...hierarchy];
    updated[idx] = { ...updated[idx], enabled: !updated[idx].enabled };
    setHierarchy(updated);
  };

  const toggleAttribute = (attrIdx: number) => {
    if (!selectedNode) return;
    const updated = [...hierarchy];
    const attrs = [...updated[selectedIdx].attributes];
    attrs[attrIdx] = { ...attrs[attrIdx], enabled: !attrs[attrIdx].enabled };
    updated[selectedIdx] = { ...updated[selectedIdx], attributes: attrs };
    setHierarchy(updated);
  };

  const updateAttrField = (attrIdx: number, field: string, value: string) => {
    if (!selectedNode) return;
    const updated = [...hierarchy];
    const attrs = [...updated[selectedIdx].attributes];
    attrs[attrIdx] = { ...attrs[attrIdx], [field]: value };
    updated[selectedIdx] = { ...updated[selectedIdx], attributes: attrs };
    setHierarchy(updated);
  };

  const addAttribute = () => {
    if (!selectedNode) return;
    const updated = [...hierarchy];
    const attrs = [...updated[selectedIdx].attributes, { name: "NewAttr", operator: "Equal to", value: "", enabled: true }];
    updated[selectedIdx] = { ...updated[selectedIdx], attributes: attrs };
    setHierarchy(updated);
  };

  const removeAttribute = (attrIdx: number) => {
    if (!selectedNode) return;
    const updated = [...hierarchy];
    updated[selectedIdx] = { ...updated[selectedIdx], attributes: updated[selectedIdx].attributes.filter((_, i) => i !== attrIdx) };
    setHierarchy(updated);
  };

  const addHierarchyNode = () => {
    const updated = [...hierarchy];
    updated.splice(Math.max(0, updated.length - 1), 0, {
      index: 0, type: "Group", label: "Group 'New'", enabled: true,
      attributes: [{ name: "Name", operator: "Equal to", value: "", enabled: true }],
    });
    updated.forEach((n, i) => { n.index = i + 1; });
    setHierarchy(updated);
  };

  const removeHierarchyNode = (idx: number) => {
    if (hierarchy.length <= 1) return;
    const updated = hierarchy.filter((_, i) => i !== idx);
    updated.forEach((n, i) => { n.index = i + 1; });
    setHierarchy(updated);
    if (selectedIdx >= updated.length) setSelectedIdx(updated.length - 1);
  };

  const handleJsonChange = (val: string) => {
    setJsonText(val);
    try { JSON.parse(val); setJsonValid(true); } catch { setJsonValid(false); }
  };

  const handleSave = () => {
    if (editorMode === "json") {
      if (!jsonValid) return;
      try { onSave(JSON.parse(jsonText)); } catch { /* noop */ }
    } else {
      onSave(hierarchyToDescriptor(hierarchy, element.descriptor));
    }
  };

  const handleModeSwitch = (mode: string) => {
    if (mode === "visual" && editorMode === "json" && jsonValid) {
      try {
        const parsed = JSON.parse(jsonText);
        const h = descriptorToHierarchy(parsed);
        setHierarchy(h);
        setSelectedIdx(Math.max(0, h.length - 1));
      } catch { /* keep current */ }
    }
    setEditorMode(mode as "visual" | "json");
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MousePointer className="h-6 w-6 text-primary" />
          <div>
            <h3 className="font-semibold text-lg">{element.name}</h3>
            <div className="flex gap-2 mt-1 flex-wrap">
              <Badge variant="outline">{element.element_type}</Badge>
              <Badge variant="outline" className="font-mono">{element.element_uid}</Badge>
              <Badge variant="outline">v{element.current_version}</Badge>
              <Badge variant="outline" className={cn(
                Number(element.confidence_score) >= 0.9 ? "bg-green-500/10 text-green-600" :
                Number(element.confidence_score) >= 0.7 ? "bg-yellow-500/10 text-yellow-600" :
                "bg-destructive/10 text-destructive"
              )}>
                {(Number(element.confidence_score) * 100).toFixed(0)}% confidence
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onViewHistory}>
            <History className="mr-2 h-4 w-4" />History
          </Button>
          <Button size="sm" variant="destructive" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div><span className="text-muted-foreground">Retry Count:</span> <span className="font-medium">{element.retry_count}</span></div>
        <div><span className="text-muted-foreground">Timeout:</span> <span className="font-medium">{element.timeout_ms}ms</span></div>
        <div><span className="text-muted-foreground">Failures:</span> <span className="font-medium">{element.failure_count}</span></div>
      </div>

      {/* Editor Tabs */}
      <Tabs value={editorMode} onValueChange={handleModeSwitch}>
        <TabsList>
          <TabsTrigger value="visual" className="gap-1.5">
            <LayoutGrid className="h-3.5 w-3.5" />Visual Editor
          </TabsTrigger>
          <TabsTrigger value="json" className="gap-1.5">
            <Code className="h-3.5 w-3.5" />JSON Editor
          </TabsTrigger>
        </TabsList>

        {/* Visual Editor */}
        <TabsContent value="visual" className="mt-3">
          <div className="border rounded-lg overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center gap-1 px-3 py-1.5 border-b bg-muted/20">
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={addHierarchyNode}>
                <Plus className="h-3.5 w-3.5" /> Add Node
              </Button>
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={addAttribute} disabled={!selectedNode}>
                <Plus className="h-3.5 w-3.5" /> Add Attribute
              </Button>
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                <Wrench className="h-3.5 w-3.5" /> Repair
              </Button>
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                <FlaskConical className="h-3.5 w-3.5" /> Test
              </Button>
            </div>

            {/* Split panel */}
            <div className="flex" style={{ minHeight: 280 }}>
              {/* Left: Hierarchy */}
              <div className="w-[260px] border-r flex flex-col">
                <div className="px-3 py-2 border-b">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Elements</span>
                </div>
                <ScrollArea className="flex-1">
                  <div className="py-1">
                    {hierarchy.map((node, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedIdx(idx)}
                        className={cn(
                          "flex items-center gap-2 w-full px-3 py-2 text-left text-sm transition-colors group",
                          selectedIdx === idx ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
                        )}
                      >
                        <Checkbox
                          checked={node.enabled}
                          onCheckedChange={() => toggleNodeEnabled(idx)}
                          onClick={(e) => e.stopPropagation()}
                          className="h-4 w-4"
                        />
                        <span className="text-muted-foreground text-xs w-4 text-right">{node.index}</span>
                        <span className="truncate flex-1">{node.label}</span>
                        {hierarchy.length > 1 && (
                          <span
                            role="button"
                            onClick={(e) => { e.stopPropagation(); removeHierarchyNode(idx); }}
                            className="opacity-0 group-hover:opacity-100 hover:text-destructive cursor-pointer"
                          >
                            <X className="h-3 w-3" />
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* Right: Attributes */}
              <div className="flex-1 flex flex-col min-w-0">
                {selectedNode ? (
                  <ScrollArea className="flex-1">
                    <div className="grid grid-cols-[32px_1fr_1fr_1fr_28px] gap-0 px-3 py-2 border-b bg-muted/20 text-xs font-semibold text-muted-foreground">
                      <span />
                      <span>Attribute</span>
                      <span>Operator</span>
                      <span>Value</span>
                      <span />
                    </div>
                    {selectedNode.attributes.map((attr, attrIdx) => (
                      <div
                        key={attrIdx}
                        className={cn(
                          "grid grid-cols-[32px_1fr_1fr_1fr_28px] gap-0 items-center px-3 py-2 border-b text-sm",
                          attr.enabled && "bg-primary/5"
                        )}
                      >
                        <Checkbox
                          checked={attr.enabled}
                          onCheckedChange={() => toggleAttribute(attrIdx)}
                          className="h-4 w-4"
                        />
                        <Input
                          value={attr.name}
                          onChange={(e) => updateAttrField(attrIdx, "name", e.target.value)}
                          className="h-7 text-xs border-0 shadow-none bg-transparent p-0 focus-visible:ring-0 font-medium"
                        />
                        <Select value={attr.operator} onValueChange={(v) => updateAttrField(attrIdx, "operator", v)}>
                          <SelectTrigger className="h-7 text-xs w-[110px] border-0 shadow-none bg-transparent">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {OPERATORS.map(op => (
                              <SelectItem key={op} value={op} className="text-xs">{op}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex items-center gap-1">
                          <Input
                            value={attr.value}
                            onChange={(e) => updateAttrField(attrIdx, "value", e.target.value)}
                            className="h-7 text-xs border-0 shadow-none bg-transparent p-0 focus-visible:ring-0"
                          />
                          {(attr.value === "True" || attr.value === "False") && (
                            <Select value={attr.value} onValueChange={(v) => updateAttrField(attrIdx, "value", v)}>
                              <SelectTrigger className="h-7 w-7 border-0 shadow-none bg-transparent p-0">
                                <ChevronDown className="h-3 w-3" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="True" className="text-xs">True</SelectItem>
                                <SelectItem value="False" className="text-xs">False</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                        <button
                          onClick={() => removeAttribute(attrIdx)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </ScrollArea>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                    Select an element to view its attributes
                  </div>
                )}
              </div>
            </div>

            {/* Preview Selector */}
            <Collapsible open={previewOpen} onOpenChange={setPreviewOpen}>
              <CollapsibleTrigger className="flex items-center gap-2 w-full px-4 py-2 border-t hover:bg-muted/30 transition-colors">
                {previewOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                <span className="text-sm font-medium">Preview Selector</span>
              </CollapsibleTrigger>
              <CollapsibleContent className="px-4 pb-3">
                <div className="bg-muted/30 rounded border p-3 font-mono text-xs leading-relaxed break-all">
                  <span className="text-muted-foreground">&gt; </span>
                  {hierarchy.filter(el => el.enabled).map((el, i, arr) => (
                    <span key={i}>
                      {el.type.toLowerCase()}
                      {el.attributes.filter(a => a.enabled).map(a => (
                        <span key={a.name}>
                          [<span className="text-primary">{a.name}</span>
                          =&quot;<span className="text-chart-4">{a.value}</span>&quot;]
                        </span>
                      ))}
                      {i < arr.length - 1 && <span className="text-muted-foreground"> &gt; </span>}
                    </span>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </TabsContent>

        {/* JSON Editor */}
        <TabsContent value="json" className="mt-3">
          <div>
            <Label className="mb-2 block">UI Descriptor (JSON)</Label>
            <Textarea
              value={jsonText}
              onChange={e => handleJsonChange(e.target.value)}
              className={cn("font-mono text-xs min-h-[350px]", !jsonValid && "border-destructive")}
              spellCheck={false}
            />
            {!jsonValid && <p className="text-xs text-destructive mt-1">Invalid JSON</p>}
          </div>
        </TabsContent>
      </Tabs>

      {/* Footer */}
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onClose}>Close</Button>
        <Button onClick={handleSave} disabled={editorMode === "json" && !jsonValid}>
          <Save className="mr-2 h-4 w-4" />Save Descriptor
        </Button>
      </div>
    </div>
  );
}
