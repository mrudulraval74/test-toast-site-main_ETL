import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  Monitor,
  Plus,
  Trash2,
  Edit,
  ChevronRight,
  ChevronDown,
  Layers,
  Folder,
  FolderPlus,
  Database,
  Copy,
  Eye,
  AppWindow,
  LayoutGrid,
  MousePointer,
  History,
  Package,
  GitBranch,
  AlertCircle,
  CheckCircle,
  Search,
  Loader2,
  Save,
} from "lucide-react";

interface ObjectRepositoryProps {
  projectId: string;
}

interface ORApplication {
  id: string;
  name: string;
  app_type: string;
  technology_type: string;
  metadata: any;
  created_at: string;
}

interface ORVersion {
  id: string;
  application_id: string;
  version_label: string;
  is_active: boolean;
  upgrade_compat_flag: boolean;
  notes: string | null;
  created_at: string;
}

interface ORScreen {
  id: string;
  version_id: string;
  name: string;
  window_selector: any;
  window_title_pattern: string | null;
  technology_type: string;
  sort_order: number;
  created_at: string;
}

interface ORElement {
  id: string;
  screen_id: string;
  parent_element_id: string | null;
  element_uid: string;
  name: string;
  element_type: string;
  descriptor: any;
  anchor_selector: any;
  image_region: any;
  healing_metadata: any;
  retry_count: number;
  timeout_ms: number;
  failure_count: number;
  confidence_score: number;
  sort_order: number;
  is_active: boolean;
  current_version: number;
  created_at: string;
}

interface ORElementVersion {
  id: string;
  element_id: string;
  version_number: number;
  descriptor: any;
  change_reason: string | null;
  confidence_score: number;
  status: string;
  created_at: string;
}

const APP_TYPES = ["desktop", "web", "mobile"];
const TECH_TYPES = ["UIA", "JAB", "Web", "Vision", "Mobile"];
const ELEMENT_TYPES = [
  "Button",
  "Edit",
  "ComboBox",
  "CheckBox",
  "RadioButton",
  "List",
  "ListItem",
  "Tree",
  "TreeItem",
  "Tab",
  "TabItem",
  "Menu",
  "MenuItem",
  "DataGrid",
  "DataItem",
  "Text",
  "Image",
  "Hyperlink",
  "Window",
  "Pane",
  "Group",
  "Custom",
];

export default function ObjectRepository({ projectId }: ObjectRepositoryProps) {
  const { toast } = useToast();
  const { user } = useAuth();

  // Data
  const [applications, setApplications] = useState<ORApplication[]>([]);
  const [versions, setVersions] = useState<ORVersion[]>([]);
  const [screens, setScreens] = useState<ORScreen[]>([]);
  const [elements, setElements] = useState<ORElement[]>([]);
  const [elementVersions, setElementVersions] = useState<ORElementVersion[]>([]);
  const [loading, setLoading] = useState(true);

  // Selection
  const [selectedApp, setSelectedApp] = useState<ORApplication | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<ORVersion | null>(null);
  const [selectedScreen, setSelectedScreen] = useState<ORScreen | null>(null);
  const [selectedElement, setSelectedElement] = useState<ORElement | null>(null);

  // Expanded tree nodes
  const [expandedApps, setExpandedApps] = useState<Set<string>>(new Set());
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set());
  const [expandedScreens, setExpandedScreens] = useState<Set<string>>(new Set());

  // Dialogs
  const [showCreateApp, setShowCreateApp] = useState(false);
  const [showCreateVersion, setShowCreateVersion] = useState(false);
  const [showCreateScreen, setShowCreateScreen] = useState(false);
  const [showCreateElement, setShowCreateElement] = useState(false);
  const [showElementHistory, setShowElementHistory] = useState(false);
  const [showDescriptorEditor, setShowDescriptorEditor] = useState(false);

  // Forms
  const [newAppName, setNewAppName] = useState("");
  const [newAppType, setNewAppType] = useState("desktop");
  const [newAppTech, setNewAppTech] = useState("UIA");
  const [newVersionLabel, setNewVersionLabel] = useState("1.0.0");
  const [newVersionNotes, setNewVersionNotes] = useState("");
  const [newScreenName, setNewScreenName] = useState("");
  const [newScreenTitlePattern, setNewScreenTitlePattern] = useState("");
  const [newScreenTech, setNewScreenTech] = useState("UIA");
  const [newElementName, setNewElementName] = useState("");
  const [newElementType, setNewElementType] = useState("Button");

  // Search
  const [searchQuery, setSearchQuery] = useState("");

  // Sub-tab
  const [activeSubTab, setActiveSubTab] = useState("tree");

  // Load all data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [appsRes, versRes, scrRes, elRes] = await Promise.all([
        supabase.from("or_applications").select("*").eq("project_id", projectId).order("name"),
        supabase
          .from("or_app_versions")
          .select("*")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false }),
        supabase.from("or_screens").select("*").eq("project_id", projectId).order("sort_order"),
        supabase.from("or_elements").select("*").eq("project_id", projectId).order("sort_order"),
      ]);
      setApplications((appsRes.data as any[]) || []);
      setVersions((versRes.data as any[]) || []);
      setScreens((scrRes.data as any[]) || []);
      setElements((elRes.data as any[]) || []);
    } catch (err) {
      console.error("Failed to load object repository:", err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // CRUD: Application
  const createApplication = async () => {
    if (!newAppName.trim() || !user) return;
    const { error } = await supabase.from("or_applications").insert({
      project_id: projectId,
      name: newAppName.trim(),
      app_type: newAppType,
      technology_type: newAppTech,
      created_by: user.id,
    } as any);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Application created" });
      setShowCreateApp(false);
      setNewAppName("");
      loadData();
    }
  };

  // CRUD: Version
  const createVersion = async () => {
    if (!selectedApp || !newVersionLabel.trim() || !user) return;
    const { error } = await supabase.from("or_app_versions").insert({
      application_id: selectedApp.id,
      project_id: projectId,
      version_label: newVersionLabel.trim(),
      notes: newVersionNotes || null,
      created_by: user.id,
    } as any);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Version created" });
      setShowCreateVersion(false);
      setNewVersionLabel("1.0.0");
      setNewVersionNotes("");
      loadData();
    }
  };

  // CRUD: Screen
  const createScreen = async () => {
    if (!selectedVersion || !newScreenName.trim() || !user) return;
    const { error } = await supabase.from("or_screens").insert({
      version_id: selectedVersion.id,
      project_id: projectId,
      name: newScreenName.trim(),
      window_title_pattern: newScreenTitlePattern || null,
      technology_type: newScreenTech,
      sort_order: screens.filter((s) => s.version_id === selectedVersion.id).length,
      created_by: user.id,
    } as any);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Screen created" });
      setShowCreateScreen(false);
      setNewScreenName("");
      setNewScreenTitlePattern("");
      loadData();
    }
  };

  // CRUD: Element
  const createElement = async () => {
    if (!selectedScreen || !newElementName.trim() || !user) return;
    const { data, error } = await supabase
      .from("or_elements")
      .insert({
        screen_id: selectedScreen.id,
        project_id: projectId,
        element_uid: "", // trigger will auto-generate
        name: newElementName.trim(),
        element_type: newElementType,
        descriptor: { primary: {}, technologyType: selectedScreen.technology_type },
        created_by: user.id,
        sort_order: elements.filter((e) => e.screen_id === selectedScreen.id).length,
      } as any)
      .select()
      .single();
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      // Create initial version
      if (data) {
        await supabase.from("or_element_versions").insert({
          element_id: (data as any).id,
          project_id: projectId,
          version_number: 1,
          descriptor: { primary: {}, technologyType: selectedScreen.technology_type },
          change_reason: "Initial creation",
          changed_by: user.id,
        } as any);
      }
      toast({ title: "Element created" });
      setShowCreateElement(false);
      setNewElementName("");
      loadData();
    }
  };

  // Delete - with linked step protection for elements
  const deleteEntity = async (table: string, id: string, label: string) => {
    // If deleting an OR element, check if it's linked to any desktop test steps
    if (table === "or_elements") {
      const element = elements.find((e) => e.id === id);
      if (element) {
        // Search all desktop tests for steps referencing this element
        const { data: tests } = await supabase
          .from("desktop_tests")
          .select("id, name, steps")
          .eq("project_id", projectId);

        const linkedTests: string[] = [];
        (tests || []).forEach((test: any) => {
          const steps = Array.isArray(test.steps) ? test.steps : [];
          const isLinked = steps.some((s: any) => s.or_element_id === id || s.or_element_uid === element.element_uid);
          if (isLinked) linkedTests.push(test.name);
        });

        if (linkedTests.length > 0) {
          toast({
            title: "Cannot delete element",
            description: `This descriptor is linked to ${linkedTests.length} test(s): ${linkedTests.slice(0, 3).join(", ")}${linkedTests.length > 3 ? "..." : ""}. Unlink it from test steps first.`,
            variant: "destructive",
          });
          return;
        }
      }
    }

    const { error } = await (supabase.from(table as any) as any).delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `${label} deleted` });
      loadData();
      if (table === "or_applications") setSelectedApp(null);
      if (table === "or_app_versions") setSelectedVersion(null);
      if (table === "or_screens") setSelectedScreen(null);
      if (table === "or_elements") setSelectedElement(null);
    }
  };

  // Load element version history
  const loadElementHistory = async (elementId: string) => {
    const { data } = await supabase
      .from("or_element_versions")
      .select("*")
      .eq("element_id", elementId)
      .order("version_number", { ascending: false });
    setElementVersions((data as any[]) || []);
    setShowElementHistory(true);
  };

  // Save descriptor
  const saveDescriptor = async (element: ORElement, descriptor: any) => {
    if (!user) return;
    const newVersion = element.current_version + 1;
    const [updateRes, versionRes] = await Promise.all([
      supabase
        .from("or_elements")
        .update({
          descriptor,
          current_version: newVersion,
        })
        .eq("id", element.id),
      supabase.from("or_element_versions").insert({
        element_id: element.id,
        project_id: projectId,
        version_number: newVersion,
        descriptor,
        change_reason: "Manual edit",
        changed_by: user.id,
      } as any),
    ]);
    if (updateRes.error || versionRes.error) {
      toast({ title: "Error saving descriptor", variant: "destructive" });
    } else {
      toast({ title: "Descriptor updated" });
      loadData();
    }
  };

  // Toggle tree expansion
  const toggleApp = (id: string) => {
    const next = new Set(expandedApps);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpandedApps(next);
  };
  const toggleVersion = (id: string) => {
    const next = new Set(expandedVersions);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpandedVersions(next);
  };
  const toggleScreen = (id: string) => {
    const next = new Set(expandedScreens);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpandedScreens(next);
  };

  // Helpers
  const getVersionsForApp = (appId: string) => versions.filter((v) => v.application_id === appId);
  const getScreensForVersion = (versionId: string) => screens.filter((s) => s.version_id === versionId);
  const getElementsForScreen = (screenId: string) =>
    elements.filter((e) => e.screen_id === screenId && !e.parent_element_id);
  const getChildElements = (parentId: string) => elements.filter((e) => e.parent_element_id === parentId);

  // Filter by search
  const filteredApps = searchQuery
    ? applications.filter((a) => a.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : applications;

  // Migrate legacy selectors
  const migrateSelectors = async () => {
    if (!user) return;
    const { data: selectors } = await supabase
      .from("desktop_selector_repository")
      .select("*")
      .eq("project_id", projectId);

    if (!selectors || selectors.length === 0) {
      toast({ title: "No selectors to migrate" });
      return;
    }

    // Group by application_name
    const grouped = new Map<string, typeof selectors>();
    for (const s of selectors) {
      const key = s.application_name || "Unknown";
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(s);
    }

    let migratedCount = 0;
    for (const [appName, sels] of grouped) {
      // Create or get application
      let { data: app } = await supabase
        .from("or_applications")
        .select("id")
        .eq("project_id", projectId)
        .eq("name", appName)
        .maybeSingle();

      if (!app) {
        const { data: newApp } = await supabase
          .from("or_applications")
          .insert({
            project_id: projectId,
            name: appName,
            app_type: "desktop",
            technology_type: "UIA",
            created_by: user.id,
          } as any)
          .select("id")
          .single();
        app = newApp;
      }
      if (!app) continue;

      // Create default version
      let { data: version } = await supabase
        .from("or_app_versions")
        .select("id")
        .eq("application_id", (app as any).id)
        .eq("version_label", "1.0.0")
        .maybeSingle();

      if (!version) {
        const { data: newVer } = await supabase
          .from("or_app_versions")
          .insert({
            application_id: (app as any).id,
            project_id: projectId,
            version_label: "1.0.0",
            created_by: user.id,
          } as any)
          .select("id")
          .single();
        version = newVer;
      }
      if (!version) continue;

      // Create default screen
      let { data: screen } = await supabase
        .from("or_screens")
        .select("id")
        .eq("version_id", (version as any).id)
        .eq("name", "Main Window")
        .maybeSingle();

      if (!screen) {
        const { data: newScreen } = await supabase
          .from("or_screens")
          .insert({
            version_id: (version as any).id,
            project_id: projectId,
            name: "Main Window",
            technology_type: "UIA",
            created_by: user.id,
          } as any)
          .select("id")
          .single();
        screen = newScreen;
      }
      if (!screen) continue;

      // Migrate each selector
      for (const sel of sels) {
        const descriptor = {
          primary: sel.selector || {},
          technologyType: "UIA",
          fallbacks: sel.fallback_selectors || [],
        };

        const { data: elem } = await supabase
          .from("or_elements")
          .insert({
            screen_id: (screen as any).id,
            project_id: projectId,
            element_uid: "",
            name: sel.element_name,
            element_type: (sel.selector as any)?.controlType || "Custom",
            descriptor,
            confidence_score: 1.0,
            current_version: sel.version || 1,
            is_active: sel.is_active,
            created_by: user.id,
          } as any)
          .select("id")
          .single();

        if (elem) {
          await supabase.from("or_element_versions").insert({
            element_id: (elem as any).id,
            project_id: projectId,
            version_number: 1,
            descriptor,
            change_reason: "Migrated from legacy selector repository",
            changed_by: user.id,
          } as any);
          migratedCount++;
        }
      }
    }

    toast({ title: `Migrated ${migratedCount} selectors` });
    loadData();
  };

  // Render tree node for an element (recursive for children)
  const renderElementNode = (element: ORElement, depth: number = 0) => {
    const children = getChildElements(element.id);
    const isSelected = selectedElement?.id === element.id;

    return (
      <div key={element.id}>
        <div
          className={cn(
            "flex items-center gap-1 py-1 px-2 rounded cursor-pointer text-sm hover:bg-accent/50 transition-colors",
            isSelected && "bg-accent text-accent-foreground",
          )}
          style={{ paddingLeft: `${(depth + 4) * 16}px` }}
          onClick={() => {
            setSelectedElement(element);
            setShowDescriptorEditor(true);
          }}
        >
          <MousePointer className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="truncate flex-1">{element.name}</span>
          <Badge variant="outline" className="text-[10px] h-4 px-1">
            {element.element_type}
          </Badge>
          <span className="text-[10px] text-muted-foreground font-mono">{element.element_uid}</span>
        </div>
        {children.map((child) => renderElementNode(child, depth + 1))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Object Repository
          </h3>
          <p className="text-sm text-muted-foreground">
            Structured UI Descriptor system — Application → Version → Screen → Element
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={migrateSelectors}>
            <Copy className="mr-2 h-4 w-4" />
            Migrate Selectors
          </Button>
          <Button size="sm" onClick={() => setShowCreateApp(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Application
          </Button>
        </div>
      </div>

      {/* Sub-tabs */}
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList>
          <TabsTrigger value="tree">
            <Layers className="mr-2 h-4 w-4" />
            Tree View
          </TabsTrigger>
          <TabsTrigger value="elements">
            <LayoutGrid className="mr-2 h-4 w-4" />
            All Elements
          </TabsTrigger>
          <TabsTrigger value="audit">
            <History className="mr-2 h-4 w-4" />
            Audit Log
          </TabsTrigger>
        </TabsList>

        {/* Tree View */}
        <TabsContent value="tree" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Tree Panel */}
            <Card className="lg:col-span-1">
              <CardHeader className="py-3 px-4">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-9"
                  />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[600px]">
                  {filteredApps.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      <AppWindow className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No applications yet</p>
                      <p className="text-xs mt-1">Add an application to get started</p>
                    </div>
                  ) : (
                    <div className="pb-4">
                      {filteredApps.map((app) => {
                        const appVersions = getVersionsForApp(app.id);
                        const isExpanded = expandedApps.has(app.id);

                        return (
                          <div key={app.id}>
                            {/* Application Node */}
                            <div
                              className={cn(
                                "flex items-center gap-1 py-1.5 px-3 cursor-pointer hover:bg-accent/50 transition-colors text-sm",
                                selectedApp?.id === app.id && "bg-accent/30",
                              )}
                              onClick={() => {
                                setSelectedApp(app);
                                toggleApp(app.id);
                              }}
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                              )}
                              <AppWindow className="h-4 w-4 text-primary shrink-0" />
                              <span className="truncate flex-1 font-medium">{app.name}</span>
                              <Badge variant="outline" className="text-[10px] h-4 px-1">
                                {app.app_type}
                              </Badge>
                            </div>

                            {/* Versions */}
                            {isExpanded && (
                              <div>
                                {appVersions.map((ver) => {
                                  const verScreens = getScreensForVersion(ver.id);
                                  const isVerExpanded = expandedVersions.has(ver.id);

                                  return (
                                    <div key={ver.id}>
                                      <div
                                        className={cn(
                                          "flex items-center gap-1 py-1 px-3 cursor-pointer hover:bg-accent/50 transition-colors text-sm",
                                          selectedVersion?.id === ver.id && "bg-accent/30",
                                        )}
                                        style={{ paddingLeft: "32px" }}
                                        onClick={() => {
                                          setSelectedVersion(ver);
                                          toggleVersion(ver.id);
                                        }}
                                      >
                                        {isVerExpanded ? (
                                          <ChevronDown className="h-3 w-3 shrink-0" />
                                        ) : (
                                          <ChevronRight className="h-3 w-3 shrink-0" />
                                        )}
                                        <GitBranch className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                        <span className="truncate flex-1">v{ver.version_label}</span>
                                        {ver.is_active && (
                                          <Badge className="text-[10px] h-4 px-1 bg-green-500/20 text-green-700 dark:text-green-400 border-0">
                                            active
                                          </Badge>
                                        )}
                                      </div>

                                      {/* Screens */}
                                      {isVerExpanded && (
                                        <div>
                                          {verScreens.map((screen) => {
                                            const screenElements = getElementsForScreen(screen.id);
                                            const isScreenExpanded = expandedScreens.has(screen.id);

                                            return (
                                              <div key={screen.id}>
                                                <div
                                                  className={cn(
                                                    "flex items-center gap-1 py-1 px-3 cursor-pointer hover:bg-accent/50 transition-colors text-sm",
                                                    selectedScreen?.id === screen.id && "bg-accent/30",
                                                  )}
                                                  style={{ paddingLeft: "48px" }}
                                                  onClick={() => {
                                                    setSelectedScreen(screen);
                                                    toggleScreen(screen.id);
                                                  }}
                                                >
                                                  {isScreenExpanded ? (
                                                    <ChevronDown className="h-3 w-3 shrink-0" />
                                                  ) : (
                                                    <ChevronRight className="h-3 w-3 shrink-0" />
                                                  )}
                                                  <Monitor className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                                  <span className="truncate flex-1">{screen.name}</span>
                                                  <span className="text-[10px] text-muted-foreground">
                                                    {screenElements.length}
                                                  </span>
                                                </div>

                                                {/* Elements */}
                                                {isScreenExpanded && screenElements.map((el) => renderElementNode(el))}
                                              </div>
                                            );
                                          })}
                                          {/* Add Screen button */}
                                          <div
                                            className="flex items-center gap-1 py-1 px-3 cursor-pointer hover:bg-accent/30 transition-colors text-xs text-muted-foreground"
                                            style={{ paddingLeft: "48px" }}
                                            onClick={() => {
                                              setSelectedVersion(ver);
                                              setShowCreateScreen(true);
                                            }}
                                          >
                                            <Plus className="h-3 w-3" />
                                            <span>Add Screen</span>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                                {/* Add Version button */}
                                <div
                                  className="flex items-center gap-1 py-1 px-3 cursor-pointer hover:bg-accent/30 transition-colors text-xs text-muted-foreground"
                                  style={{ paddingLeft: "32px" }}
                                  onClick={() => {
                                    setSelectedApp(app);
                                    setShowCreateVersion(true);
                                  }}
                                >
                                  <Plus className="h-3 w-3" />
                                  <span>Add Version</span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Detail Panel */}
            <Card className="lg:col-span-2">
              <CardContent className="pt-6">
                {selectedElement && showDescriptorEditor ? (
                  <DescriptorEditor
                    element={selectedElement}
                    onSave={(desc) => saveDescriptor(selectedElement, desc)}
                    onViewHistory={() => loadElementHistory(selectedElement.id)}
                    onClose={() => setShowDescriptorEditor(false)}
                    onDelete={() => deleteEntity("or_elements", selectedElement.id, "Element")}
                  />
                ) : selectedScreen ? (
                  <ScreenDetail
                    screen={selectedScreen}
                    elements={elements.filter((e) => e.screen_id === selectedScreen.id)}
                    onAddElement={() => setShowCreateElement(true)}
                    onSelectElement={(el) => {
                      setSelectedElement(el);
                      setShowDescriptorEditor(true);
                    }}
                    onDelete={() => deleteEntity("or_screens", selectedScreen.id, "Screen")}
                  />
                ) : selectedVersion ? (
                  <VersionDetail
                    version={selectedVersion}
                    screens={screens.filter((s) => s.version_id === selectedVersion.id)}
                    onAddScreen={() => setShowCreateScreen(true)}
                    onDelete={() => deleteEntity("or_app_versions", selectedVersion.id, "Version")}
                  />
                ) : selectedApp ? (
                  <AppDetail
                    app={selectedApp}
                    versions={getVersionsForApp(selectedApp.id)}
                    onAddVersion={() => setShowCreateVersion(true)}
                    onDelete={() => deleteEntity("or_applications", selectedApp.id, "Application")}
                  />
                ) : (
                  <div className="text-center py-20 text-muted-foreground">
                    <Database className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p className="font-medium">Select an item from the tree</p>
                    <p className="text-sm mt-1">Click on an application, version, screen, or element to view details</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* All Elements (flat view) */}
        <TabsContent value="elements" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {elements.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <MousePointer className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p>No elements in repository</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>UID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>AutomationId</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead>Failures</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {elements.map((el) => (
                      <TableRow
                        key={el.id}
                        className="cursor-pointer hover:bg-accent/50"
                        onClick={() => {
                          setSelectedElement(el);
                          setShowDescriptorEditor(true);
                        }}
                      >
                        <TableCell className="font-mono text-xs">{el.element_uid}</TableCell>
                        <TableCell className="font-medium">{el.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{el.element_type}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {el.descriptor?.primary?.automationId || "—"}
                        </TableCell>
                        <TableCell>v{el.current_version}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              el.confidence_score >= 0.9
                                ? "bg-green-500/10 text-green-600"
                                : el.confidence_score >= 0.7
                                  ? "bg-yellow-500/10 text-yellow-600"
                                  : "bg-destructive/10 text-destructive",
                            )}
                          >
                            {(Number(el.confidence_score) * 100).toFixed(0)}%
                          </Badge>
                        </TableCell>
                        <TableCell>{el.failure_count}</TableCell>
                        <TableCell>
                          {el.is_active ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Log */}
        <TabsContent value="audit" className="mt-4">
          <AuditLogView projectId={projectId} />
        </TabsContent>
      </Tabs>

      {/* === DIALOGS === */}

      {/* Create Application */}
      <Dialog open={showCreateApp} onOpenChange={setShowCreateApp}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Application</DialogTitle>
            <DialogDescription>Register a new application in the object repository</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={newAppName} onChange={(e) => setNewAppName(e.target.value)} placeholder="" />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={newAppType} onValueChange={setNewAppType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {APP_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Technology</Label>
              <Select value={newAppTech} onValueChange={setNewAppTech}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TECH_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateApp(false)}>
              Cancel
            </Button>
            <Button onClick={createApplication} disabled={!newAppName.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Version */}
      <Dialog open={showCreateVersion} onOpenChange={setShowCreateVersion}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Version</DialogTitle>
            <DialogDescription>Add a new version to {selectedApp?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Version Label</Label>
              <Input
                value={newVersionLabel}
                onChange={(e) => setNewVersionLabel(e.target.value)}
                placeholder="e.g., 2.0.0"
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={newVersionNotes}
                onChange={(e) => setNewVersionNotes(e.target.value)}
                placeholder="What changed in this version?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateVersion(false)}>
              Cancel
            </Button>
            <Button onClick={createVersion} disabled={!newVersionLabel.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Screen */}
      <Dialog open={showCreateScreen} onOpenChange={setShowCreateScreen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Screen</DialogTitle>
            <DialogDescription>Add a new screen/window to version {selectedVersion?.version_label}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Screen Name</Label>
              <Input value={newScreenName} onChange={(e) => setNewScreenName(e.target.value)} placeholder="" />
            </div>
            <div>
              <Label>Window Title Pattern</Label>
              <Input
                value={newScreenTitlePattern}
                onChange={(e) => setNewScreenTitlePattern(e.target.value)}
                placeholder=""
              />
            </div>
            <div>
              <Label>Technology</Label>
              <Select value={newScreenTech} onValueChange={setNewScreenTech}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TECH_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateScreen(false)}>
              Cancel
            </Button>
            <Button onClick={createScreen} disabled={!newScreenName.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Element */}
      <Dialog open={showCreateElement} onOpenChange={setShowCreateElement}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add UI Element</DialogTitle>
            <DialogDescription>Add a new element to screen {selectedScreen?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Element Name</Label>
              <Input
                value={newElementName}
                onChange={(e) => setNewElementName(e.target.value)}
                placeholder="e.g., Submit Button"
              />
            </div>
            <div>
              <Label>Element Type</Label>
              <Select value={newElementType} onValueChange={setNewElementType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ELEMENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateElement(false)}>
              Cancel
            </Button>
            <Button onClick={createElement} disabled={!newElementName.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Element Version History Dialog */}
      <Dialog open={showElementHistory} onOpenChange={setShowElementHistory}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Descriptor Version History — {selectedElement?.name}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[500px]">
            <div className="space-y-3">
              {elementVersions.map((v) => (
                <Card key={v.id}>
                  <CardContent className="py-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">v{v.version_number}</Badge>
                        <Badge
                          variant="outline"
                          className={cn(
                            v.status === "applied"
                              ? "bg-green-500/10 text-green-600"
                              : v.status === "pending"
                                ? "bg-yellow-500/10 text-yellow-600"
                                : "bg-destructive/10 text-destructive",
                          )}
                        >
                          {v.status}
                        </Badge>
                        {v.confidence_score && (
                          <span className="text-xs text-muted-foreground">
                            {(Number(v.confidence_score) * 100).toFixed(0)}% confidence
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">{new Date(v.created_at).toLocaleString()}</span>
                    </div>
                    {v.change_reason && <p className="text-sm text-muted-foreground">{v.change_reason}</p>}
                    <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
                      {JSON.stringify(v.descriptor, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// === Sub-Components ===

function AppDetail({
  app,
  versions,
  onAddVersion,
  onDelete,
}: {
  app: ORApplication;
  versions: ORVersion[];
  onAddVersion: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AppWindow className="h-6 w-6 text-primary" />
          <div>
            <h3 className="font-semibold text-lg">{app.name}</h3>
            <div className="flex gap-2 mt-1">
              <Badge variant="outline">{app.app_type}</Badge>
              <Badge variant="outline">{app.technology_type}</Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={onAddVersion}>
            <Plus className="mr-2 h-4 w-4" />
            Add Version
          </Button>
          <Button size="sm" variant="destructive" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="text-sm text-muted-foreground">
        {versions.length} version(s) • Created {new Date(app.created_at).toLocaleDateString()}
      </div>
    </div>
  );
}

function VersionDetail({
  version,
  screens,
  onAddScreen,
  onDelete,
}: {
  version: ORVersion;
  screens: ORScreen[];
  onAddScreen: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <GitBranch className="h-6 w-6 text-primary" />
          <div>
            <h3 className="font-semibold text-lg">Version {version.version_label}</h3>
            <div className="flex gap-2 mt-1">
              {version.is_active && (
                <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 border-0">Active</Badge>
              )}
              {version.upgrade_compat_flag && <Badge variant="outline">Compatible</Badge>}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={onAddScreen}>
            <Plus className="mr-2 h-4 w-4" />
            Add Screen
          </Button>
          <Button size="sm" variant="destructive" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {version.notes && <p className="text-sm text-muted-foreground">{version.notes}</p>}
      <div className="text-sm text-muted-foreground">{screens.length} screen(s)</div>
    </div>
  );
}

function ScreenDetail({
  screen,
  elements,
  onAddElement,
  onSelectElement,
  onDelete,
}: {
  screen: ORScreen;
  elements: ORElement[];
  onAddElement: () => void;
  onSelectElement: (el: ORElement) => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Monitor className="h-6 w-6 text-primary" />
          <div>
            <h3 className="font-semibold text-lg">{screen.name}</h3>
            <div className="flex gap-2 mt-1">
              <Badge variant="outline">{screen.technology_type}</Badge>
              {screen.window_title_pattern && (
                <span className="text-xs text-muted-foreground font-mono">{screen.window_title_pattern}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={onAddElement}>
            <Plus className="mr-2 h-4 w-4" />
            Add Element
          </Button>
          <Button size="sm" variant="destructive" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {elements.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>UID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Confidence</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {elements.map((el) => (
              <TableRow key={el.id} className="cursor-pointer hover:bg-accent/50" onClick={() => onSelectElement(el)}>
                <TableCell className="font-mono text-xs">{el.element_uid}</TableCell>
                <TableCell className="font-medium">{el.name}</TableCell>
                <TableCell>
                  <Badge variant="outline">{el.element_type}</Badge>
                </TableCell>
                <TableCell>v{el.current_version}</TableCell>
                <TableCell>{(Number(el.confidence_score) * 100).toFixed(0)}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

// DescriptorEditor is now imported from the dedicated visual editor component
import DescriptorVisualEditor from "@/components/desktop-automation/DescriptorVisualEditor";

function DescriptorEditor({
  element,
  onSave,
  onViewHistory,
  onClose,
  onDelete,
}: {
  element: ORElement;
  onSave: (descriptor: any) => void;
  onViewHistory: () => void;
  onClose: () => void;
  onDelete: () => void;
}) {
  return (
    <DescriptorVisualEditor
      element={element}
      onSave={onSave}
      onViewHistory={onViewHistory}
      onClose={onClose}
      onDelete={onDelete}
    />
  );
}

function AuditLogView({ projectId }: { projectId: string }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("or_audit_log")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(100);
      setLogs((data as any[]) || []);
      setLoading(false);
    };
    load();
  }, [projectId]);

  if (loading)
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );

  if (logs.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <History className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p>No audit events yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity Type</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="text-xs">{new Date(log.created_at).toLocaleString()}</TableCell>
                <TableCell>
                  <Badge variant="outline">{log.action}</Badge>
                </TableCell>
                <TableCell>{log.entity_type}</TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate">
                  {log.new_value ? JSON.stringify(log.new_value).substring(0, 80) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
