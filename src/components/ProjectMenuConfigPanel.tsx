import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Save, GripVertical, Copy } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface MenuConfigItem {
  id: string;
  menu_id: string;
  label: string;
  is_visible: boolean;
  display_order: number;
  project_id: string | null;
}

interface SortableMenuItemProps {
  item: MenuConfigItem;
  onToggle: (menuId: string, isVisible: boolean) => void;
}

const SortableMenuItem = ({ item, onToggle }: SortableMenuItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between py-3 border-b last:border-0 bg-background"
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <Label htmlFor={item.menu_id} className="text-base font-medium cursor-pointer">
          {item.label}
        </Label>
      </div>
      <Switch
        id={item.menu_id}
        checked={item.is_visible}
        onCheckedChange={(checked) => onToggle(item.menu_id, checked)}
      />
    </div>
  );
};

interface ProjectMenuConfigPanelProps {
  projectId: string;
}

export const ProjectMenuConfigPanel = ({ projectId }: ProjectMenuConfigPanelProps) => {
  const { toast } = useToast();
  const [menuItems, setMenuItems] = useState<MenuConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copying, setCopying] = useState(false);
  const [hasProjectConfig, setHasProjectConfig] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Default menu items for testing phase
  const defaultMenuItems = [
    { menu_id: "dashboard", label: "Testing Dashboard", display_order: 1 },
    { menu_id: "user-stories", label: "User Stories", display_order: 2 },
    { menu_id: "test-plan", label: "Test Plans", display_order: 3 },
    { menu_id: "test-cases", label: "Test Cases", display_order: 4 },
    { menu_id: "repository", label: "Automation Testing (Selenium)", display_order: 5 },
    { menu_id: "api", label: "API Testing", display_order: 6 },
    { menu_id: "performance-testing", label: "Performance Testing", display_order: 7 },
    { menu_id: "security-testing", label: "Security Testing", display_order: 8 },
    { menu_id: "nocode-automation", label: "Automation Testing (No-code)", display_order: 9 },
    { menu_id: "agents", label: "Self-Hosted Agents", display_order: 10 },
    { menu_id: "defects", label: "Defects", display_order: 11 },
    { menu_id: "test-report", label: "Test Report", display_order: 12 },
    { menu_id: "integrations", label: "Integrations", display_order: 13 },
    { menu_id: "ai-governance", label: "AI Governance", display_order: 14 },
  ];

  useEffect(() => {
    fetchMenuConfig();
  }, [projectId]);

  const fetchMenuConfig = async () => {
    try {
      // First check if project has its own config
      const { data: projectConfig, error: projectError } = await supabase
        .from('menu_config')
        .select('*')
        .eq('project_id', projectId)
        .order('display_order', { ascending: true });

      if (projectError) throw projectError;

      if (projectConfig && projectConfig.length > 0) {
        setMenuItems(projectConfig);
        setHasProjectConfig(true);
      } else {
        // Fall back to global config
        const { data: globalConfig, error: globalError } = await supabase
          .from('menu_config')
          .select('*')
          .is('project_id', null)
          .order('display_order', { ascending: true });

        if (globalError) throw globalError;

        if (globalConfig && globalConfig.length > 0) {
          // Transform global config to show as preview (not editable until copied)
          setMenuItems(globalConfig.map(item => ({ ...item, project_id: null })));
        } else {
          // Use default menu items if no config exists
          setMenuItems(defaultMenuItems.map((item, index) => ({
            id: `default-${index}`,
            ...item,
            is_visible: true,
            project_id: null,
          })));
        }
        setHasProjectConfig(false);
      }
    } catch (error: any) {
      console.error('Error fetching menu config:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load menu configuration",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyFromGlobal = async () => {
    setCopying(true);
    try {
      // First check if project already has config and delete it to avoid duplicates
      const { error: deleteError } = await supabase
        .from('menu_config')
        .delete()
        .eq('project_id', projectId);

      if (deleteError) throw deleteError;

      // Fetch global config
      const { data: globalConfig, error: globalError } = await supabase
        .from('menu_config')
        .select('*')
        .is('project_id', null)
        .order('display_order', { ascending: true });

      if (globalError) throw globalError;

      const configToCopy = globalConfig && globalConfig.length > 0 
        ? globalConfig 
        : defaultMenuItems.map((item, index) => ({
            id: `temp-${index}`,
            ...item,
            is_visible: true,
          }));

      // Create project-specific config
      const newItems = configToCopy.map((item, index) => ({
        menu_id: item.menu_id,
        label: item.label,
        is_visible: item.is_visible,
        display_order: item.display_order || index + 1,
        project_id: projectId,
      }));

      const { data: insertedItems, error: insertError } = await supabase
        .from('menu_config')
        .insert(newItems)
        .select();

      if (insertError) throw insertError;

      if (insertedItems) {
        setMenuItems(insertedItems);
        setHasProjectConfig(true);
        toast({
          title: "Success",
          description: "Menu configuration copied to project. You can now customize it.",
        });
      }
    } catch (error: any) {
      console.error('Error copying menu config:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to copy menu configuration",
      });
    } finally {
      setCopying(false);
    }
  };

  const handleToggle = (menuId: string, isVisible: boolean) => {
    setMenuItems(items =>
      items.map(item =>
        item.menu_id === menuId ? { ...item, is_visible: isVisible } : item
      )
    );
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setMenuItems((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        const reordered = arrayMove(items, oldIndex, newIndex);
        return reordered.map((item, index) => ({
          ...item,
          display_order: index + 1,
        }));
      });
    }
  };

  const handleSave = async () => {
    if (!hasProjectConfig) {
      toast({
        variant: "destructive",
        title: "Cannot save",
        description: "Please copy the global configuration first before making changes.",
      });
      return;
    }

    setSaving(true);
    try {
      for (const item of menuItems) {
        const { error } = await supabase
          .from('menu_config')
          .update({ is_visible: item.is_visible, display_order: item.display_order })
          .eq('id', item.id);

        if (error) throw error;
      }

      toast({
        title: "Success",
        description: "Menu configuration saved successfully",
      });
    } catch (error: any) {
      console.error('Error saving menu config:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save menu configuration",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Project Menu Configuration</CardTitle>
        <CardDescription>
          Configure which menu items are visible in the sidebar for this project. Drag to reorder.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!hasProjectConfig && (
          <Alert className="mb-4">
            <AlertDescription className="flex items-center justify-between">
              <span>
                This project is using the global menu configuration. Copy it to customize for this project.
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyFromGlobal}
                disabled={copying}
              >
                {copying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Copying...
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy & Customize
                  </>
                )}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={menuItems.map((item) => item.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-0">
              {menuItems.map((item) => (
                <SortableMenuItem
                  key={item.id}
                  item={item}
                  onToggle={handleToggle}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {hasProjectConfig && (
          <div className="mt-6 flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
