import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Clock, RotateCcw, Timer, FileSpreadsheet, Link2, Plus, Trash2, Info } from "lucide-react";
import { TestPlanConfig, ParameterizationConfig, CorrelationConfig, RecordedStep } from "./types";
import { useToast } from "@/hooks/use-toast";

interface ConfigurationTabProps {
  config: TestPlanConfig;
  onConfigChange: (config: TestPlanConfig) => void;
  parameterization: ParameterizationConfig;
  onParameterizationChange: (config: ParameterizationConfig) => void;
  correlation: CorrelationConfig;
  onCorrelationChange: (config: CorrelationConfig) => void;
  steps: RecordedStep[];
}

export const ConfigurationTab = ({
  config,
  onConfigChange,
  parameterization,
  onParameterizationChange,
  correlation,
  onCorrelationChange,
  steps
}: ConfigurationTabProps) => {
  const { toast } = useToast();

  const handleAddVariable = () => {
    const newVariable = {
      name: `VAR_${parameterization.variables.length + 1}`,
      column: ''
    };
    onParameterizationChange({
      ...parameterization,
      variables: [...parameterization.variables, newVariable]
    });
  };

  const handleRemoveVariable = (index: number) => {
    const updated = parameterization.variables.filter((_, i) => i !== index);
    onParameterizationChange({
      ...parameterization,
      variables: updated
    });
  };

  const handleAddCorrelationRule = () => {
    const newRule = {
      id: crypto.randomUUID(),
      name: `Rule_${correlation.rules.length + 1}`,
      extractFrom: 'response_body' as const,
      regex: '',
      variableName: ''
    };
    onCorrelationChange({
      ...correlation,
      rules: [...correlation.rules, newRule]
    });
  };

  const handleRemoveCorrelationRule = (id: string) => {
    const updated = correlation.rules.filter(r => r.id !== id);
    onCorrelationChange({
      ...correlation,
      rules: updated
    });
  };

  const handleUpdateCorrelationRule = (id: string, field: string, value: string) => {
    const updated = correlation.rules.map(r => 
      r.id === id ? { ...r, [field]: value } : r
    );
    onCorrelationChange({
      ...correlation,
      rules: updated
    });
  };

  const estimatedRequests = config.loopCount * config.virtualUsers * steps.length;
  const estimatedDuration = config.rampUpTime + (config.duration > 0 ? config.duration : 0);

  return (
    <div className="space-y-6">
      {/* Test Plan Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Test Plan Configuration</CardTitle>
          <CardDescription>
            Configure load test parameters for your performance test
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Test Name */}
          <div>
            <Label>Test Plan Name</Label>
            <Input
              value={config.name}
              onChange={(e) => onConfigChange({ ...config, name: e.target.value })}
              placeholder="My Performance Test"
            />
          </div>

          {/* Main Configuration Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Virtual Users */}
            <Card className="bg-muted/30">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Virtual Users</p>
                    <p className="text-xs text-muted-foreground">Concurrent threads</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <Slider
                    value={[config.virtualUsers]}
                    onValueChange={([v]) => onConfigChange({ ...config, virtualUsers: v })}
                    min={1}
                    max={500}
                    step={1}
                  />
                  <div className="flex justify-between">
                    <Input
                      type="number"
                      min={1}
                      max={500}
                      value={config.virtualUsers}
                      onChange={(e) => onConfigChange({ ...config, virtualUsers: parseInt(e.target.value) || 1 })}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground self-center">users</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Ramp-Up Time */}
            <Card className="bg-muted/30">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-amber-500/10 rounded-lg">
                    <Clock className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="font-medium">Ramp-Up Time</p>
                    <p className="text-xs text-muted-foreground">Time to start all users</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <Slider
                    value={[config.rampUpTime]}
                    onValueChange={([v]) => onConfigChange({ ...config, rampUpTime: v })}
                    min={0}
                    max={600}
                    step={10}
                  />
                  <div className="flex justify-between">
                    <Input
                      type="number"
                      min={0}
                      max={3600}
                      value={config.rampUpTime}
                      onChange={(e) => onConfigChange({ ...config, rampUpTime: parseInt(e.target.value) || 0 })}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground self-center">seconds</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Loop Count */}
            <Card className="bg-muted/30">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-emerald-500/10 rounded-lg">
                    <RotateCcw className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="font-medium">Loop Count</p>
                    <p className="text-xs text-muted-foreground">Iterations per user</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <Slider
                    value={[config.loopCount]}
                    onValueChange={([v]) => onConfigChange({ ...config, loopCount: v })}
                    min={1}
                    max={100}
                    step={1}
                  />
                  <div className="flex justify-between">
                    <Input
                      type="number"
                      min={1}
                      max={10000}
                      value={config.loopCount}
                      onChange={(e) => onConfigChange({ ...config, loopCount: parseInt(e.target.value) || 1 })}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground self-center">times</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Duration and Think Time */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Timer className="h-5 w-5 text-muted-foreground" />
                <Label className="text-base">Test Duration (seconds)</Label>
              </div>
              <Input
                type="number"
                min={0}
                value={config.duration}
                onChange={(e) => onConfigChange({ ...config, duration: parseInt(e.target.value) || 0 })}
                placeholder="0 for loop-based execution"
              />
              <p className="text-xs text-muted-foreground">
                Set to 0 to use loop count instead of duration
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <Label className="text-base">Think Time (ms)</Label>
                </div>
                <Switch
                  checked={config.enableThinkTime}
                  onCheckedChange={(checked) => onConfigChange({ ...config, enableThinkTime: checked })}
                />
              </div>
              <Input
                type="number"
                min={0}
                value={config.thinkTime}
                onChange={(e) => onConfigChange({ ...config, thinkTime: parseInt(e.target.value) || 0 })}
                disabled={!config.enableThinkTime}
              />
              <p className="text-xs text-muted-foreground">
                Global delay between requests (overrides per-step settings)
              </p>
            </div>
          </div>

          {/* Estimation Summary */}
          <div className="flex items-center gap-4 p-4 bg-primary/5 rounded-lg border border-primary/10">
            <Info className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium">Estimated Load</p>
              <p className="text-xs text-muted-foreground">
                ~{estimatedRequests.toLocaleString()} total requests over ~{estimatedDuration}s
                ({steps.length} steps × {config.loopCount} loops × {config.virtualUsers} users)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Parameterization & Correlation */}
      <Accordion type="single" collapsible className="space-y-4">
        {/* Parameterization */}
        <AccordionItem value="parameterization" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="h-5 w-5" />
              <div className="text-left">
                <p className="font-medium">Parameterization (CSV / Variables)</p>
                <p className="text-xs text-muted-foreground font-normal">
                  Use external data for dynamic test values
                </p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <Label>Enable Parameterization</Label>
              <Switch
                checked={parameterization.enabled}
                onCheckedChange={(checked) => onParameterizationChange({ ...parameterization, enabled: checked })}
              />
            </div>

            {parameterization.enabled && (
              <>
                <div>
                  <Label>CSV Data</Label>
                  <Textarea
                    placeholder="username,password,email&#10;user1,pass1,user1@test.com&#10;user2,pass2,user2@test.com"
                    value={parameterization.csvData}
                    onChange={(e) => onParameterizationChange({ ...parameterization, csvData: e.target.value })}
                    rows={5}
                    className="font-mono text-sm mt-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    First row should contain column headers
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Variable Mappings</Label>
                    <Button variant="outline" size="sm" onClick={handleAddVariable}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add Variable
                    </Button>
                  </div>
                  
                  {parameterization.variables.length > 0 && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Variable Name</TableHead>
                          <TableHead>CSV Column</TableHead>
                          <TableHead className="w-12" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parameterization.variables.map((v, idx) => (
                          <TableRow key={idx}>
                            <TableCell>
                              <Input
                                value={v.name}
                                onChange={(e) => {
                                  const updated = [...parameterization.variables];
                                  updated[idx] = { ...updated[idx], name: e.target.value };
                                  onParameterizationChange({ ...parameterization, variables: updated });
                                }}
                                placeholder="${VARIABLE}"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={v.column}
                                onChange={(e) => {
                                  const updated = [...parameterization.variables];
                                  updated[idx] = { ...updated[idx], column: e.target.value };
                                  onParameterizationChange({ ...parameterization, variables: updated });
                                }}
                                placeholder="column_name"
                              />
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveVariable(idx)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* Correlation */}
        <AccordionItem value="correlation" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <Link2 className="h-5 w-5" />
              <div className="text-left">
                <p className="font-medium">Correlation Rules</p>
                <p className="text-xs text-muted-foreground font-normal">
                  Extract and reuse dynamic values (tokens, IDs)
                </p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <Label>Enable Correlation</Label>
              <Switch
                checked={correlation.enabled}
                onCheckedChange={(checked) => onCorrelationChange({ ...correlation, enabled: checked })}
              />
            </div>

            {correlation.enabled && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Extraction Rules</Label>
                  <Button variant="outline" size="sm" onClick={handleAddCorrelationRule}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Rule
                  </Button>
                </div>

                {correlation.rules.length > 0 && (
                  <div className="space-y-3">
                    {correlation.rules.map((rule) => (
                      <Card key={rule.id} className="bg-muted/30">
                        <CardContent className="pt-4">
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            <Input
                              placeholder="Rule Name"
                              value={rule.name}
                              onChange={(e) => handleUpdateCorrelationRule(rule.id, 'name', e.target.value)}
                            />
                            <Input
                              placeholder="Variable Name"
                              value={rule.variableName}
                              onChange={(e) => handleUpdateCorrelationRule(rule.id, 'variableName', e.target.value)}
                            />
                            <Input
                              placeholder="Regex Pattern"
                              value={rule.regex}
                              onChange={(e) => handleUpdateCorrelationRule(rule.id, 'regex', e.target.value)}
                              className="font-mono"
                            />
                            <div className="flex items-center gap-2">
                              <select
                                className="flex-1 h-10 px-3 rounded-md border bg-background text-sm"
                                value={rule.extractFrom}
                                onChange={(e) => handleUpdateCorrelationRule(rule.id, 'extractFrom', e.target.value)}
                              >
                                <option value="response_body">Response Body</option>
                                <option value="response_header">Response Header</option>
                                <option value="response_code">Response Code</option>
                              </select>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveCorrelationRule(rule.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                <p className="text-xs text-muted-foreground mt-2">
                  Use regex groups to extract values. Example: "token":"([^"]+)" extracts the token value.
                </p>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};
