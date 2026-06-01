import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Calculator, Users, Gauge, Clock, AlertTriangle, ArrowRight, Zap } from "lucide-react";
import {
  WorkloadModelType,
  BusinessInputs,
  TechnicalInputs,
  LoadLevel,
  TestPlanConfig,
} from "../types";
import {
  calculateWorkload,
  formatDuration,
  getLoadLevelLabel,
} from "./utils";

interface WorkloadCalculatorProps {
  modelType: WorkloadModelType;
  businessInputs: BusinessInputs;
  technicalInputs: TechnicalInputs;
  loadLevel: LoadLevel;
  onLoadLevelChange: (level: LoadLevel) => void;
  thinkTime: number;
  onApply: (config: Partial<TestPlanConfig>) => void;
}

export const WorkloadCalculator = ({
  modelType,
  businessInputs,
  technicalInputs,
  loadLevel,
  onLoadLevelChange,
  thinkTime,
  onApply,
}: WorkloadCalculatorProps) => {
  const calculation = useMemo(
    () =>
      calculateWorkload(
        modelType,
        businessInputs,
        technicalInputs,
        loadLevel,
        thinkTime
      ),
    [modelType, businessInputs, technicalInputs, loadLevel, thinkTime]
  );

  const warnings = useMemo(() => {
    const warns: string[] = [];
    if (calculation.concurrentUsers > technicalInputs.maxCapacityUsers) {
      warns.push(
        `Calculated users (${calculation.concurrentUsers}) exceed max capacity (${technicalInputs.maxCapacityUsers})`
      );
    }
    if (calculation.targetTps > technicalInputs.targetTps * 1.5) {
      warns.push(`Calculated TPS significantly higher than target`);
    }
    if (thinkTime < 1000 && modelType === 'closed') {
      warns.push(`Think time below 1s may not represent realistic user behavior`);
    }
    return warns;
  }, [calculation, technicalInputs, thinkTime, modelType]);

  const handleApply = () => {
    onApply({
      virtualUsers: calculation.concurrentUsers,
      rampUpTime: calculation.rampUpTime,
      duration: calculation.duration,
      thinkTime: calculation.thinkTime,
      enableThinkTime: thinkTime > 0,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Workload Calculator
        </CardTitle>
        <CardDescription>
          Real-time calculation based on your inputs using{" "}
          {modelType === "open" ? "Little's Law (Open Model)" : "Closed Model"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Load Level Selector */}
        <div className="space-y-2">
          <Label>Load Level</Label>
          <Select value={loadLevel} onValueChange={(v) => onLoadLevelChange(v as LoadLevel)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="baseline">{getLoadLevelLabel('baseline')}</SelectItem>
              <SelectItem value="normal">{getLoadLevelLabel('normal')}</SelectItem>
              <SelectItem value="peak">{getLoadLevelLabel('peak')}</SelectItem>
              <SelectItem value="stress">{getLoadLevelLabel('stress')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Formula Display */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Formula Applied
          </Label>
          <code className="block text-sm font-mono">{calculation.formula}</code>
          <p className="text-xs text-muted-foreground">{calculation.explanation}</p>
        </div>

        {/* Calculated Results */}
        <div className="grid grid-cols-2 gap-4">
          <div className="border rounded-lg p-4 text-center">
            <Users className="h-6 w-6 mx-auto mb-2 text-primary" />
            <div className="text-2xl font-bold">{calculation.concurrentUsers}</div>
            <div className="text-sm text-muted-foreground">Concurrent Users</div>
          </div>
          <div className="border rounded-lg p-4 text-center">
            <Gauge className="h-6 w-6 mx-auto mb-2 text-primary" />
            <div className="text-2xl font-bold">{calculation.targetTps.toFixed(1)}</div>
            <div className="text-sm text-muted-foreground">Target TPS</div>
          </div>
          <div className="border rounded-lg p-4 text-center">
            <Zap className="h-6 w-6 mx-auto mb-2 text-primary" />
            <div className="text-2xl font-bold">{formatDuration(calculation.rampUpTime)}</div>
            <div className="text-sm text-muted-foreground">Ramp-Up Time</div>
          </div>
          <div className="border rounded-lg p-4 text-center">
            <Clock className="h-6 w-6 mx-auto mb-2 text-primary" />
            <div className="text-2xl font-bold">{formatDuration(calculation.duration)}</div>
            <div className="text-sm text-muted-foreground">Test Duration</div>
          </div>
        </div>

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="space-y-2">
            {warnings.map((warn, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/20 rounded-lg p-3"
              >
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{warn}</span>
              </div>
            ))}
          </div>
        )}

        {/* Apply Button */}
        <Button onClick={handleApply} className="w-full gap-2">
          Apply to Configuration
          <ArrowRight className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
};
