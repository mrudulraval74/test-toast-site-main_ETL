import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, FileText, Trash2, Settings2, Circle, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RecordedStep, TestPlanConfig, ParameterizationConfig, CorrelationConfig } from "./types";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface PerformanceTemplate {
  id: string;
  name: string;
  description: string | null;
  steps: RecordedStep[];
  config: TestPlanConfig;
  parameterization: ParameterizationConfig;
  correlation: CorrelationConfig;
  created_at: string;
  updated_at: string;
}

interface LoadTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onLoadRecording: (steps: RecordedStep[]) => void;
  onLoadConfiguration: (config: TestPlanConfig, parameterization: ParameterizationConfig, correlation: CorrelationConfig) => void;
  onLoadAll: (steps: RecordedStep[], config: TestPlanConfig, parameterization: ParameterizationConfig, correlation: CorrelationConfig) => void;
}

export const LoadTemplateDialog = ({
  open,
  onOpenChange,
  projectId,
  onLoadRecording,
  onLoadConfiguration,
  onLoadAll,
}: LoadTemplateDialogProps) => {
  const [templates, setTemplates] = useState<PerformanceTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<PerformanceTemplate | null>(null);

  useEffect(() => {
    if (open) {
      fetchTemplates();
    }
  }, [open, projectId]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("performance_test_templates")
        .select("*")
        .eq("project_id", projectId)
        .order("updated_at", { ascending: false });

      if (error) throw error;

      // Parse JSONB fields with proper defaults
      const defaultConfig: TestPlanConfig = {
        name: "Performance Test Plan",
        virtualUsers: 10,
        rampUpTime: 60,
        loopCount: 1,
        duration: 0,
        thinkTime: 1000,
        enableThinkTime: false,
      };

      const defaultParameterization: ParameterizationConfig = {
        enabled: false,
        csvData: "",
        variables: [],
      };

      const defaultCorrelation: CorrelationConfig = {
        enabled: false,
        rules: [],
      };

      const parsed: PerformanceTemplate[] = (data || []).map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        created_at: t.created_at,
        updated_at: t.updated_at,
        steps: (t.steps as unknown as RecordedStep[]) || [],
        config: { ...defaultConfig, ...(t.config as unknown as Partial<TestPlanConfig>) },
        parameterization: { ...defaultParameterization, ...(t.parameterization as unknown as Partial<ParameterizationConfig>) },
        correlation: { ...defaultCorrelation, ...(t.correlation as unknown as Partial<CorrelationConfig>) },
      }));

      setTemplates(parsed);
    } catch (error) {
      console.error("Error fetching templates:", error);
      toast.error("Failed to load templates");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!templateToDelete) return;

    try {
      const { error } = await supabase
        .from("performance_test_templates")
        .delete()
        .eq("id", templateToDelete.id);

      if (error) throw error;

      toast.success("Template deleted");
      setTemplates((prev) => prev.filter((t) => t.id !== templateToDelete.id));
    } catch (error) {
      console.error("Error deleting template:", error);
      toast.error("Failed to delete template");
    } finally {
      setDeleteDialogOpen(false);
      setTemplateToDelete(null);
    }
  };

  const handleLoadRecording = (template: PerformanceTemplate) => {
    onLoadRecording(template.steps);
    toast.success(`Loaded ${template.steps.length} steps from "${template.name}"`);
    onOpenChange(false);
  };

  const handleLoadConfiguration = (template: PerformanceTemplate) => {
    onLoadConfiguration(template.config, template.parameterization, template.correlation);
    toast.success(`Loaded configuration from "${template.name}"`);
    onOpenChange(false);
  };

  const handleLoadAll = (template: PerformanceTemplate) => {
    onLoadAll(template.steps, template.config, template.parameterization, template.correlation);
    toast.success(`Loaded template "${template.name}"`);
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Load Template</DialogTitle>
            <DialogDescription>
              Select a saved template to load recordings or configuration.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="h-[400px] pr-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No saved templates yet.</p>
                <p className="text-sm">Save a recording or configuration to see it here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate">{template.name}</h4>
                        {template.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {template.description}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive shrink-0"
                        onClick={() => {
                          setTemplateToDelete(template);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-3">
                      <Badge variant="secondary" className="gap-1">
                        <Circle className="h-3 w-3" />
                        {template.steps.length} steps
                      </Badge>
                      <Badge variant="outline" className="gap-1">
                        <Settings2 className="h-3 w-3" />
                        {template.config?.virtualUsers || 0} users
                      </Badge>
                      <Badge variant="outline" className="gap-1 text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(template.updated_at), "MMM d, yyyy")}
                      </Badge>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleLoadRecording(template)}
                        disabled={template.steps.length === 0}
                      >
                        Load Recording
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleLoadConfiguration(template)}
                      >
                        Load Config
                      </Button>
                      <Button size="sm" onClick={() => handleLoadAll(template)}>
                        Load All
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{templateToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
