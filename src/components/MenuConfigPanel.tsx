import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRoles } from "@/hooks/useRoles";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Save, AlertCircle, GripVertical, Trash2, Upload, CheckCircle } from "lucide-react";
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
}

interface AdminMenuVisibility {
  knowledgeBase: boolean;
  qaInsights: boolean;
  aiAnalytics: boolean;
  roleManagement: boolean;
  architecture: boolean;
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

export const MenuConfigPanel = () => {
  const { toast } = useToast();
  const { isAdmin, loading: roleLoading } = useRoles();
  const [menuItems, setMenuItems] = useState<MenuConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingOnlyMode, setTestingOnlyMode] = useState(false);
  const [screenshotOnFailureOnly, setScreenshotOnFailureOnly] = useState(false);
  const [scheduledTriggersCronEnabled, setScheduledTriggersCronEnabled] = useState(true);
  const [agentPollInterval, setAgentPollInterval] = useState(10);
  const [agentHeartbeatInterval, setAgentHeartbeatInterval] = useState(60);
  const [dataRetentionDays, setDataRetentionDays] = useState(30);
  const [cleaningUp, setCleaningUp] = useState(false);
  const [migratingBaselines, setMigratingBaselines] = useState(false);
  const [baselineMigrationStats, setBaselineMigrationStats] = useState<{ migrated: number; failed: number } | null>(null);
  const [adminMenuVisibility, setAdminMenuVisibility] = useState<AdminMenuVisibility>({
    knowledgeBase: true,
    qaInsights: true,
    aiAnalytics: true,
    roleManagement: true,
    architecture: true,
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchMenuConfig();
    fetchTestingOnlyMode();
    fetchScreenshotSettings();
    fetchAdminMenuVisibility();
    fetchScheduledTriggersCronSetting();
    fetchAgentSettings();
  }, []);

  const fetchTestingOnlyMode = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('setting_value')
        .eq('setting_key', 'testing_only_mode')
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      const settingValue = data?.setting_value as { enabled?: boolean } | null;
      setTestingOnlyMode(settingValue?.enabled || false);
    } catch (error: any) {
      console.error('Error fetching testing only mode:', error);
    }
  };

  const handleTestingOnlyModeToggle = async (enabled: boolean) => {
    setTestingOnlyMode(enabled);
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert({
          setting_key: 'testing_only_mode',
          setting_value: { enabled },
          updated_at: new Date().toISOString()
        }, { onConflict: 'setting_key' });

      if (error) throw error;
      
      toast({
        title: "Success",
        description: `Testing Only Mode ${enabled ? 'enabled' : 'disabled'}`,
      });
    } catch (error: any) {
      console.error('Error updating testing only mode:', error);
      setTestingOnlyMode(!enabled); // Revert on error
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update Testing Only Mode",
      });
    }
  };

  const fetchScreenshotSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('setting_value')
        .eq('setting_key', 'screenshot_on_failure_only')
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      const settingValue = data?.setting_value as { enabled?: boolean } | null;
      setScreenshotOnFailureOnly(settingValue?.enabled || false);
    } catch (error: any) {
      console.error('Error fetching screenshot settings:', error);
    }
  };

  const handleScreenshotSettingToggle = async (enabled: boolean) => {
    setScreenshotOnFailureOnly(enabled);
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert({
          setting_key: 'screenshot_on_failure_only',
          setting_value: { enabled },
          updated_at: new Date().toISOString()
        }, { onConflict: 'setting_key' });

      if (error) throw error;
      
      toast({
        title: "Success",
        description: `Screenshot on failure only ${enabled ? 'enabled' : 'disabled'}`,
      });
    } catch (error: any) {
      console.error('Error updating screenshot settings:', error);
      setScreenshotOnFailureOnly(!enabled); // Revert on error
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update screenshot settings",
      });
    }
  };

  const fetchScheduledTriggersCronSetting = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('setting_value')
        .eq('setting_key', 'scheduled_triggers_cron_enabled')
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      const settingValue = data?.setting_value as { enabled?: boolean } | null;
      setScheduledTriggersCronEnabled(settingValue?.enabled ?? true);
    } catch (error: any) {
      console.error('Error fetching scheduled triggers cron setting:', error);
    }
  };

  const handleScheduledTriggersCronToggle = async (enabled: boolean) => {
    setScheduledTriggersCronEnabled(enabled);
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert({
          setting_key: 'scheduled_triggers_cron_enabled',
          setting_value: { enabled },
          updated_at: new Date().toISOString()
        }, { onConflict: 'setting_key' });

      if (error) throw error;
      
      toast({
        title: "Success",
        description: `Scheduled triggers cron job ${enabled ? 'enabled' : 'disabled'}`,
      });
    } catch (error: any) {
      console.error('Error updating scheduled triggers cron setting:', error);
      setScheduledTriggersCronEnabled(!enabled); // Revert on error
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update scheduled triggers cron setting",
      });
    }
  };

  const fetchAgentSettings = async () => {
    try {
      // Fetch all agent-related settings in parallel
      const [pollResult, heartbeatResult, retentionResult] = await Promise.all([
        supabase
          .from('app_settings')
          .select('setting_value')
          .eq('setting_key', 'agent_poll_interval_seconds')
          .single(),
        supabase
          .from('app_settings')
          .select('setting_value')
          .eq('setting_key', 'agent_heartbeat_interval_seconds')
          .single(),
        supabase
          .from('app_settings')
          .select('setting_value')
          .eq('setting_key', 'execution_data_retention_days')
          .single(),
      ]);

      if (pollResult.data?.setting_value) {
        const value = (pollResult.data.setting_value as { value?: number })?.value;
        if (value) setAgentPollInterval(value);
      }
      if (heartbeatResult.data?.setting_value) {
        const value = (heartbeatResult.data.setting_value as { value?: number })?.value;
        if (value) setAgentHeartbeatInterval(value);
      }
      if (retentionResult.data?.setting_value) {
        const value = (retentionResult.data.setting_value as { value?: number })?.value;
        if (value) setDataRetentionDays(value);
      }
    } catch (error: any) {
      console.error('Error fetching agent settings:', error);
    }
  };

  const handleAgentPollIntervalChange = async (value: number) => {
    const clampedValue = Math.max(5, Math.min(60, value));
    setAgentPollInterval(clampedValue);
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert({
          setting_key: 'agent_poll_interval_seconds',
          setting_value: { value: clampedValue },
          updated_at: new Date().toISOString()
        }, { onConflict: 'setting_key' });

      if (error) throw error;
      
      toast({
        title: "Success",
        description: `Agent poll interval updated to ${clampedValue} seconds`,
      });
    } catch (error: any) {
      console.error('Error updating agent poll interval:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update agent poll interval",
      });
    }
  };

  const handleAgentHeartbeatIntervalChange = async (value: number) => {
    const clampedValue = Math.max(30, Math.min(120, value));
    setAgentHeartbeatInterval(clampedValue);
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert({
          setting_key: 'agent_heartbeat_interval_seconds',
          setting_value: { value: clampedValue },
          updated_at: new Date().toISOString()
        }, { onConflict: 'setting_key' });

      if (error) throw error;
      
      toast({
        title: "Success",
        description: `Agent heartbeat interval updated to ${clampedValue} seconds`,
      });
    } catch (error: any) {
      console.error('Error updating agent heartbeat interval:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update agent heartbeat interval",
      });
    }
  };

  const handleDataRetentionDaysChange = async (value: number) => {
    const clampedValue = Math.max(7, Math.min(365, value));
    setDataRetentionDays(clampedValue);
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert({
          setting_key: 'execution_data_retention_days',
          setting_value: { value: clampedValue },
          updated_at: new Date().toISOString()
        }, { onConflict: 'setting_key' });

      if (error) throw error;
      
      toast({
        title: "Success",
        description: `Data retention period updated to ${clampedValue} days`,
      });
    } catch (error: any) {
      console.error('Error updating data retention days:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update data retention period",
      });
    }
  };

  const handleCleanupNow = async () => {
    setCleaningUp(true);
    try {
      const { data, error } = await supabase.rpc('cleanup_old_execution_data');
      
      if (error) throw error;
      
      toast({
        title: "Cleanup Complete",
        description: `Deleted ${data || 0} old records`,
      });
    } catch (error: any) {
      console.error('Error running cleanup:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to run cleanup: " + (error.message || "Unknown error"),
      });
    } finally {
      setCleaningUp(false);
    }
  };

  const handleMigrateBaselines = async () => {
    setMigratingBaselines(true);
    setBaselineMigrationStats(null);
    try {
      const { migrateAllBaselinesToStorage } = await import('@/lib/visualBaselineStorage');
      const result = await migrateAllBaselinesToStorage();
      
      setBaselineMigrationStats({ migrated: result.migrated, failed: result.failed });
      
      if (result.migrated > 0 || result.failed > 0) {
        toast({
          title: "Migration Complete",
          description: `Migrated ${result.migrated} baselines to storage${result.failed > 0 ? `, ${result.failed} failed` : ''}`,
          variant: result.failed > 0 ? "destructive" : "default",
        });
      } else {
        toast({
          title: "No Migration Needed",
          description: "All baselines are already using storage",
        });
      }
      
      if (result.errors.length > 0) {
        console.error('Migration errors:', result.errors);
      }
    } catch (error: any) {
      console.error('Error migrating baselines:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to migrate baselines: " + (error.message || "Unknown error"),
      });
    } finally {
      setMigratingBaselines(false);
    }
  };

  const fetchAdminMenuVisibility = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('setting_value')
        .eq('setting_key', 'admin_menu_visibility')
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      const settingValue = data?.setting_value as unknown as AdminMenuVisibility | null;
      if (settingValue) {
        setAdminMenuVisibility({
          knowledgeBase: settingValue.knowledgeBase ?? true,
          qaInsights: settingValue.qaInsights ?? true,
          aiAnalytics: settingValue.aiAnalytics ?? true,
          roleManagement: settingValue.roleManagement ?? true,
          architecture: settingValue.architecture ?? true,
        });
      }
    } catch (error: any) {
      console.error('Error fetching admin menu visibility:', error);
    }
  };

  const handleAdminMenuToggle = async (key: keyof AdminMenuVisibility, enabled: boolean) => {
    const newVisibility = { ...adminMenuVisibility, [key]: enabled };
    setAdminMenuVisibility(newVisibility);
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert({
          setting_key: 'admin_menu_visibility',
          setting_value: newVisibility,
          updated_at: new Date().toISOString()
        }, { onConflict: 'setting_key' });

      if (error) throw error;
      
      toast({
        title: "Success",
        description: `Menu visibility updated`,
      });
    } catch (error: any) {
      console.error('Error updating admin menu visibility:', error);
      setAdminMenuVisibility({ ...adminMenuVisibility, [key]: !enabled }); // Revert on error
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update menu visibility",
      });
    }
  };

  // Menu IDs that are controlled via Admin Menu Visibility section
  const adminMenuIds = ['projects', 'knowledge-base', 'ai-analytics', 'role-manager', 'architecture'];

  const fetchMenuConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('menu_config')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;
      // Filter out admin menu items that are controlled separately
      const filteredData = (data || []).filter(item => !adminMenuIds.includes(item.menu_id));
      setMenuItems(filteredData);
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
        // Update display_order for each item
        return reordered.map((item, index) => ({
          ...item,
          display_order: index + 1,
        }));
      });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = menuItems.map(item => ({
        id: item.id,
        is_visible: item.is_visible,
        display_order: item.display_order,
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('menu_config')
          .update({ is_visible: update.is_visible, display_order: update.display_order })
          .eq('id', update.id);

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

  if (roleLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-center">
            You need admin privileges to access this panel.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Testing Only Mode Card */}
      <Card>
        <CardHeader>
          <CardTitle>Display Mode</CardTitle>
          <CardDescription>
            Control how the sidebar navigation is displayed
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between py-3">
            <div className="space-y-1">
              <Label htmlFor="testing-only-mode" className="text-base font-medium cursor-pointer">
                Testing Only Mode
              </Label>
              <p className="text-sm text-muted-foreground">
                Show only the Testing section and hide all other SDLC phases
              </p>
            </div>
            <Switch
              id="testing-only-mode"
              checked={testingOnlyMode}
              onCheckedChange={handleTestingOnlyModeToggle}
            />
          </div>
          {testingOnlyMode && (
            <Alert className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Only the Testing section will be visible in the sidebar for all users.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Screenshot Storage Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle>Storage Settings</CardTitle>
          <CardDescription>
            Configure screenshot storage to optimize disk usage
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between py-3">
            <div className="space-y-1">
              <Label htmlFor="screenshot-failure-only" className="text-base font-medium cursor-pointer">
                Screenshot on Failure Only
              </Label>
              <p className="text-sm text-muted-foreground">
                Only capture screenshots for failed test steps to reduce storage usage
              </p>
            </div>
            <Switch
              id="screenshot-failure-only"
              checked={screenshotOnFailureOnly}
              onCheckedChange={handleScreenshotSettingToggle}
            />
          </div>
          {screenshotOnFailureOnly && (
            <Alert className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Screenshots will only be captured when a test step fails. This significantly reduces storage usage.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Scheduled Triggers Cron Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle>Scheduled Triggers</CardTitle>
          <CardDescription>
            Control the automatic execution of scheduled test triggers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between py-3">
            <div className="space-y-1">
              <Label htmlFor="scheduled-triggers-cron" className="text-base font-medium cursor-pointer">
                Enable Cron Job
              </Label>
              <p className="text-sm text-muted-foreground">
                Run scheduled triggers automatically every minute
              </p>
            </div>
            <Switch
              id="scheduled-triggers-cron"
              checked={scheduledTriggersCronEnabled}
              onCheckedChange={handleScheduledTriggersCronToggle}
            />
          </div>
          {!scheduledTriggersCronEnabled && (
            <Alert className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Scheduled triggers will not run automatically. You can still trigger them manually.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Agent Performance Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle>Agent Performance</CardTitle>
          <CardDescription>
            Optimize agent polling to reduce network egress and improve performance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="poll-interval" className="text-base font-medium">
                  Poll Interval (seconds)
                </Label>
                <p className="text-sm text-muted-foreground">
                  How often agents check for new jobs (5-60 seconds)
                </p>
              </div>
              <Input
                id="poll-interval"
                type="number"
                min={5}
                max={60}
                value={agentPollInterval}
                onChange={(e) => setAgentPollInterval(parseInt(e.target.value) || 10)}
                onBlur={(e) => handleAgentPollIntervalChange(parseInt(e.target.value) || 10)}
                className="w-20 text-center"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="heartbeat-interval" className="text-base font-medium">
                  Heartbeat Interval (seconds)
                </Label>
                <p className="text-sm text-muted-foreground">
                  How often agents send status updates (30-120 seconds)
                </p>
              </div>
              <Input
                id="heartbeat-interval"
                type="number"
                min={30}
                max={120}
                value={agentHeartbeatInterval}
                onChange={(e) => setAgentHeartbeatInterval(parseInt(e.target.value) || 60)}
                onBlur={(e) => handleAgentHeartbeatIntervalChange(parseInt(e.target.value) || 60)}
                className="w-20 text-center"
              />
            </div>
          </div>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Higher intervals reduce network usage but may delay job pickup. Agents must be restarted to apply changes.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Data Retention Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle>Data Retention</CardTitle>
          <CardDescription>
            Configure automatic cleanup of old execution data to reduce storage usage
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="retention-days" className="text-base font-medium">
                Retention Period (days)
              </Label>
              <p className="text-sm text-muted-foreground">
                Keep execution data for this many days (7-365)
              </p>
            </div>
            <Input
              id="retention-days"
              type="number"
              min={7}
              max={365}
              value={dataRetentionDays}
              onChange={(e) => setDataRetentionDays(parseInt(e.target.value) || 30)}
              onBlur={(e) => handleDataRetentionDaysChange(parseInt(e.target.value) || 30)}
              className="w-20 text-center"
            />
          </div>
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="space-y-1">
              <Label className="text-base font-medium">Manual Cleanup</Label>
              <p className="text-sm text-muted-foreground">
                Delete execution data older than {dataRetentionDays} days now
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleCleanupNow}
              disabled={cleaningUp}
            >
              {cleaningUp ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cleaning...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Run Cleanup Now
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Visual Baseline Migration Card */}
      <Card>
        <CardHeader>
          <CardTitle>Visual Baseline Storage</CardTitle>
          <CardDescription>
            Migrate visual baselines from database to storage to reduce egress
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-base font-medium">Migrate Baselines to Storage</Label>
              <p className="text-sm text-muted-foreground">
                Move existing base64 baselines to Supabase Storage for reduced egress
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleMigrateBaselines}
              disabled={migratingBaselines}
            >
              {migratingBaselines ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Migrating...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Migrate Now
                </>
              )}
            </Button>
          </div>
          {baselineMigrationStats && (
            <Alert variant={baselineMigrationStats.failed > 0 ? "destructive" : "default"}>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Last migration: {baselineMigrationStats.migrated} migrated
                {baselineMigrationStats.failed > 0 && `, ${baselineMigrationStats.failed} failed`}
              </AlertDescription>
            </Alert>
          )}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              New baselines are automatically stored in Supabase Storage. This migration is for existing base64 data.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Admin Menu Visibility Card */}
      <Card>
        <CardHeader>
          <CardTitle>Admin Menu Visibility</CardTitle>
          <CardDescription>
            Control which admin menu items are visible in the sidebar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-0">
          <div className="flex items-center justify-between py-3 border-b">
            <div className="space-y-1">
              <Label htmlFor="knowledge-base-visibility" className="text-base font-medium cursor-pointer">
                Knowledge Base
              </Label>
              <p className="text-sm text-muted-foreground">
                Show the Knowledge Base menu item
              </p>
            </div>
            <Switch
              id="knowledge-base-visibility"
              checked={adminMenuVisibility.knowledgeBase}
              onCheckedChange={(checked) => handleAdminMenuToggle('knowledgeBase', checked)}
            />
          </div>
          <div className="flex items-center justify-between py-3 border-b">
            <div className="space-y-1">
              <Label htmlFor="qa-insights-visibility" className="text-base font-medium cursor-pointer">
                QA Insights
              </Label>
              <p className="text-sm text-muted-foreground">
                Show the QA Insights menu item
              </p>
            </div>
            <Switch
              id="qa-insights-visibility"
              checked={adminMenuVisibility.qaInsights}
              onCheckedChange={(checked) => handleAdminMenuToggle('qaInsights', checked)}
            />
          </div>
          <div className="flex items-center justify-between py-3 border-b">
            <div className="space-y-1">
              <Label htmlFor="ai-analytics-visibility" className="text-base font-medium cursor-pointer">
                AI Analytics
              </Label>
              <p className="text-sm text-muted-foreground">
                Show the AI Analytics menu item
              </p>
            </div>
            <Switch
              id="ai-analytics-visibility"
              checked={adminMenuVisibility.aiAnalytics}
              onCheckedChange={(checked) => handleAdminMenuToggle('aiAnalytics', checked)}
            />
          </div>
          <div className="flex items-center justify-between py-3 border-b">
            <div className="space-y-1">
              <Label htmlFor="role-management-visibility" className="text-base font-medium cursor-pointer">
                Role Management
              </Label>
              <p className="text-sm text-muted-foreground">
                Show the Role Management menu item (admin only)
              </p>
            </div>
            <Switch
              id="role-management-visibility"
              checked={adminMenuVisibility.roleManagement}
              onCheckedChange={(checked) => handleAdminMenuToggle('roleManagement', checked)}
            />
          </div>
          <div className="flex items-center justify-between py-3">
            <div className="space-y-1">
              <Label htmlFor="architecture-visibility" className="text-base font-medium cursor-pointer">
                Architecture
              </Label>
              <p className="text-sm text-muted-foreground">
                Show the Architecture menu item
              </p>
            </div>
            <Switch
              id="architecture-visibility"
              checked={adminMenuVisibility.architecture}
              onCheckedChange={(checked) => handleAdminMenuToggle('architecture', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Menu Items Card */}
      <Card>
        <CardHeader>
          <CardTitle>Menu Configuration</CardTitle>
          <CardDescription>
            Configure which menu items are visible in the sidebar. Drag to reorder.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    </div>
  );
};
