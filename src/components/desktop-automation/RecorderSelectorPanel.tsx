import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  Plus, Image as ImageIcon, Wrench, FlaskConical, Check, MoreHorizontal,
  Monitor, ToggleRight, ChevronDown, ChevronUp, X, Info, Maximize2, Loader2
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ElementAttribute {
  name: string;
  operator: string;
  value: string;
  enabled: boolean;
}

export interface HierarchyElement {
  index: number;
  type: string;
  label: string;
  enabled: boolean;
  attributes: ElementAttribute[];
}

export interface SelectorData {
  hierarchy: HierarchyElement[];
  selectedElementIndex: number;
  previewSelector: string;
  // Legacy compat fields
  strict?: { enabled: boolean; selector: string; isValid: boolean | null };
  fuzzy?: { enabled: boolean; selector: string; isValid: boolean | null };
  computerVision?: { enabled: boolean; elementType: string; label: string };
  image?: { enabled: boolean; imageData: string | null; accuracy: number };
  windowSelector?: string;
  anchorSelector?: string;
  duplicateWarning?: boolean;
}

interface RecorderSelectorPanelProps {
  step: any;
  onUpdate: (selectorData: SelectorData) => void;
  onValidate?: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  isValidating?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Operator options                                                   */
/* ------------------------------------------------------------------ */

const OPERATORS = ["Equal to", "Contains", "Starts with", "Ends with", "Regex"];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function buildPreview(hierarchy: HierarchyElement[]): string {
  return hierarchy
    .filter((el) => el.enabled)
    .map((el) => {
      const attrs = el.attributes
        .filter((a) => a.enabled)
        .map((a) => `[${a.name}="${a.value}"]`)
        .join("");
      return `${el.type.toLowerCase()}${attrs}`;
    })
    .join(" > ");
}

function buildHierarchyFromStep(step: any): HierarchyElement[] {
  const target = step.target || {};
  const appName = step.applicationName || "app.exe";
  const parentWindow = target.parentWindow || "";
  const automationId = target.automationId || "";
  const label = target.label || "";
  const controlType = target.controlType || "Button";
  const className = target.classHint || "";

  const hierarchy: HierarchyElement[] = [];

  // 1) Window element
  const windowAttrs: ElementAttribute[] = [];
  if (className) windowAttrs.push({ name: "Class", operator: "Equal to", value: className, enabled: true });
  windowAttrs.push({ name: "Name", operator: "Equal to", value: parentWindow || appName, enabled: true });
  hierarchy.push({
    index: 1,
    type: "Window",
    label: `Window '${parentWindow || appName}'`,
    enabled: true,
    attributes: windowAttrs,
  });

  // 2) If we have an automationId, add an intermediate custom element
  if (automationId) {
    hierarchy.push({
      index: 2,
      type: "Custom",
      label: "UI Custom",
      enabled: true,
      attributes: [
        { name: "Id", operator: "Equal to", value: automationId, enabled: true },
      ],
    });
  }

  // 3) Target element
  const targetAttrs: ElementAttribute[] = [];
  targetAttrs.push({ name: "Class", operator: "Equal to", value: controlType, enabled: true });
  targetAttrs.push({ name: "Enabled", operator: "Equal to", value: "True", enabled: false });
  if (automationId) targetAttrs.push({ name: "Id", operator: "Equal to", value: automationId, enabled: true });
  targetAttrs.push({ name: "IsDefault", operator: "Equal to", value: "False", enabled: false });
  if (label) targetAttrs.push({ name: "Name", operator: "Equal to", value: label, enabled: false });
  targetAttrs.push({ name: "Ordinal", operator: "Equal to", value: "0", enabled: false });
  targetAttrs.push({ name: "Visible", operator: "Equal to", value: "True", enabled: false });

  hierarchy.push({
    index: hierarchy.length + 1,
    type: controlType,
    label: `${controlType} '${label || "element"}'`,
    enabled: true,
    attributes: targetAttrs,
  });

  return hierarchy;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function RecorderSelectorPanel({
  step,
  onUpdate,
  onValidate,
  onConfirm,
  onCancel,
  isValidating = false,
}: RecorderSelectorPanelProps) {
  const [hierarchy, setHierarchy] = useState<HierarchyElement[]>(() => buildHierarchyFromStep(step));
  const [selectedIdx, setSelectedIdx] = useState<number>(() => {
    const h = buildHierarchyFromStep(step);
    return h.length - 1; // select last (target) element
  });
  const [previewOpen, setPreviewOpen] = useState(true);
  const [textEditorMode, setTextEditorMode] = useState(false);

  const previewSelector = useMemo(() => buildPreview(hierarchy), [hierarchy]);

  const selectedElement = hierarchy[selectedIdx] || null;

  const emitUpdate = (newHierarchy: HierarchyElement[], newIdx?: number) => {
    setHierarchy(newHierarchy);
    const idx = newIdx ?? selectedIdx;
    const preview = buildPreview(newHierarchy);
    onUpdate({
      hierarchy: newHierarchy,
      selectedElementIndex: idx,
      previewSelector: preview,
      // Legacy compat
      strict: { enabled: true, selector: preview, isValid: null },
      fuzzy: { enabled: false, selector: "", isValid: null },
      computerVision: { enabled: false, elementType: step.target?.controlType || "Button", label: step.target?.label || "" },
      image: { enabled: false, imageData: null, accuracy: 0.5 },
      windowSelector: "",
    });
  };

  const toggleElementEnabled = (idx: number) => {
    const updated = [...hierarchy];
    updated[idx] = { ...updated[idx], enabled: !updated[idx].enabled };
    emitUpdate(updated);
  };

  const toggleAttribute = (attrIdx: number) => {
    if (!selectedElement) return;
    const updated = [...hierarchy];
    const attrs = [...updated[selectedIdx].attributes];
    attrs[attrIdx] = { ...attrs[attrIdx], enabled: !attrs[attrIdx].enabled };
    updated[selectedIdx] = { ...updated[selectedIdx], attributes: attrs };
    emitUpdate(updated);
  };

  const updateAttributeOperator = (attrIdx: number, operator: string) => {
    if (!selectedElement) return;
    const updated = [...hierarchy];
    const attrs = [...updated[selectedIdx].attributes];
    attrs[attrIdx] = { ...attrs[attrIdx], operator };
    updated[selectedIdx] = { ...updated[selectedIdx], attributes: attrs };
    emitUpdate(updated);
  };

  const updateAttributeValue = (attrIdx: number, value: string) => {
    if (!selectedElement) return;
    const updated = [...hierarchy];
    const attrs = [...updated[selectedIdx].attributes];
    attrs[attrIdx] = { ...attrs[attrIdx], value };
    updated[selectedIdx] = { ...updated[selectedIdx], attributes: attrs };
    emitUpdate(updated);
  };

  return (
    <div className="border rounded-lg bg-card shadow-lg overflow-hidden flex flex-col">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">
            Selectors of UI element "{step.target?.label || step.target?.controlType || "element"}"
          </span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">UIA</Badge>
          <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Expand">
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCancel} title="Close">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b bg-muted/20">
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
          <Plus className="h-3.5 w-3.5" /> New
        </Button>
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
          <ImageIcon className="h-3.5 w-3.5" /> Image as fallback
        </Button>
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
          <Wrench className="h-3.5 w-3.5" /> Repair
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={onValidate}
          disabled={isValidating}
        >
          {isValidating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />}
          Test
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <Check className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <MoreHorizontal className="h-3.5 w-3.5" />
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
            <Monitor className="h-3.5 w-3.5" /> Open screen selector
          </Button>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Text editor</span>
            <button
              onClick={() => setTextEditorMode(!textEditorMode)}
              className={cn(
                "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                textEditorMode ? "bg-primary" : "bg-muted-foreground/30"
              )}
            >
              <span
                className={cn(
                  "inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform",
                  textEditorMode ? "translate-x-[18px]" : "translate-x-[3px]"
                )}
              />
            </button>
          </div>
        </div>
      </div>

      {/* ── Selector name row ── */}
      <div className="flex items-center gap-2 px-4 py-2 border-b">
        <span className="text-sm text-muted-foreground">Default Selector</span>
        <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto">
          <MoreHorizontal className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* ── Main content: Elements tree + Attributes table ── */}
      <div className="flex flex-1 min-h-0" style={{ minHeight: 220 }}>
        {/* Left: Elements hierarchy */}
        <div className="w-[280px] border-r flex flex-col">
          <div className="px-3 py-2 border-b">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Elements</span>
          </div>
          <ScrollArea className="flex-1">
            <div className="py-1">
              {hierarchy.map((el, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedIdx(idx)}
                  className={cn(
                    "flex items-center gap-2 w-full px-3 py-2 text-left text-sm transition-colors",
                    selectedIdx === idx
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted/50"
                  )}
                >
                  <Checkbox
                    checked={el.enabled}
                    onCheckedChange={() => toggleElementEnabled(idx)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4"
                  />
                  <span className="text-muted-foreground text-xs w-4 text-right">{el.index}</span>
                  <span className="truncate">{el.label}</span>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Right: Attributes table */}
        <div className="flex-1 flex flex-col min-w-0">
          {selectedElement ? (
            <ScrollArea className="flex-1">
              {/* Table header */}
              <div className="grid grid-cols-[32px_1fr_1fr_1fr] gap-0 px-3 py-2 border-b bg-muted/20 text-xs font-semibold text-muted-foreground">
                <span />
                <span>Attribute</span>
                <span>Operator</span>
                <span>Value</span>
              </div>
              {/* Table rows */}
              {selectedElement.attributes.map((attr, attrIdx) => (
                <div
                  key={attrIdx}
                  className={cn(
                    "grid grid-cols-[32px_1fr_1fr_1fr] gap-0 items-center px-3 py-2 border-b text-sm",
                    attr.enabled && "bg-primary/5"
                  )}
                >
                  <Checkbox
                    checked={attr.enabled}
                    onCheckedChange={() => toggleAttribute(attrIdx)}
                    className="h-4 w-4"
                  />
                  <span className={cn("font-medium", attr.enabled ? "text-foreground" : "text-muted-foreground")}>
                    {attr.name}
                  </span>
                  <Select value={attr.operator} onValueChange={(v) => updateAttributeOperator(attrIdx, v)}>
                    <SelectTrigger className="h-7 text-xs w-[110px] border-0 shadow-none bg-transparent">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPERATORS.map((op) => (
                        <SelectItem key={op} value={op} className="text-xs">{op}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-1">
                    <Input
                      value={attr.value}
                      onChange={(e) => updateAttributeValue(attrIdx, e.target.value)}
                      className="h-7 text-xs border-0 shadow-none bg-transparent p-0 focus-visible:ring-0"
                    />
                    {/* Show dropdown arrow for boolean-like values */}
                    {(attr.value === "True" || attr.value === "False") && (
                      <Select value={attr.value} onValueChange={(v) => updateAttributeValue(attrIdx, v)}>
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

      {/* ── Preview Selector ── */}
      <Collapsible open={previewOpen} onOpenChange={setPreviewOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 w-full px-4 py-2 border-t hover:bg-muted/30 transition-colors">
          {previewOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          <span className="text-sm font-medium">Preview Selector</span>
        </CollapsibleTrigger>
        <CollapsibleContent className="px-4 pb-3">
          <div className="bg-muted/30 rounded border p-3 font-mono text-xs leading-relaxed break-all">
            <span className="text-muted-foreground">&gt; </span>
            {hierarchy
              .filter((el) => el.enabled)
              .map((el, i, arr) => {
                const attrs = el.attributes
                  .filter((a) => a.enabled)
                  .map((a) => (
                    <span key={a.name}>
                      [<span className="text-primary">{a.name}</span>
                      ="<span className="text-orange-500 dark:text-orange-400">{a.value}</span>"]
                    </span>
                  ));
                return (
                  <span key={i}>
                    {el.type.toLowerCase()}
                    {attrs}
                    {i < arr.length - 1 && <span className="text-muted-foreground"> &gt; </span>}
                  </span>
                );
              })}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* ── Footer buttons ── */}
      <div className="flex items-center justify-end gap-2 px-4 py-3 border-t">
        <Button size="sm" onClick={onConfirm}>
          Save
        </Button>
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export default RecorderSelectorPanel;
