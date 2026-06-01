import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Gauge, Timer, AlertTriangle, Server } from "lucide-react";
import { TechnicalInputs } from "../types";

interface TechnicalInputsCardProps {
  inputs: TechnicalInputs;
  onChange: (inputs: TechnicalInputs) => void;
}

export const TechnicalInputsCard = ({ inputs, onChange }: TechnicalInputsCardProps) => {
  const updateField = <K extends keyof TechnicalInputs>(field: K, value: TechnicalInputs[K]) => {
    onChange({ ...inputs, [field]: value });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gauge className="h-5 w-5" />
          Technical Inputs
        </CardTitle>
        <CardDescription>
          Define performance targets and SLA requirements
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Target TPS */}
        <div className="space-y-2">
          <Label htmlFor="targetTps" className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-muted-foreground" />
            Target TPS (Transactions Per Second)
          </Label>
          <Input
            id="targetTps"
            type="number"
            value={inputs.targetTps}
            onChange={(e) => updateField('targetTps', parseInt(e.target.value) || 1)}
            min={1}
          />
          <p className="text-xs text-muted-foreground">
            Required throughput for open model testing
          </p>
        </div>

        {/* Response Times */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="avgRt" className="flex items-center gap-2">
              <Timer className="h-4 w-4 text-muted-foreground" />
              Avg Response Time (ms)
            </Label>
            <Input
              id="avgRt"
              type="number"
              value={inputs.avgResponseTimeMs}
              onChange={(e) => updateField('avgResponseTimeMs', parseInt(e.target.value) || 100)}
              min={1}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p95Rt">P95 Response Time (ms)</Label>
            <Input
              id="p95Rt"
              type="number"
              value={inputs.p95ResponseTimeMs}
              onChange={(e) => updateField('p95ResponseTimeMs', parseInt(e.target.value) || 100)}
              min={1}
            />
          </div>
        </div>

        {/* Capacity */}
        <div className="space-y-2">
          <Label htmlFor="maxCapacity" className="flex items-center gap-2">
            <Server className="h-4 w-4 text-muted-foreground" />
            Max Capacity (Users)
          </Label>
          <Input
            id="maxCapacity"
            type="number"
            value={inputs.maxCapacityUsers}
            onChange={(e) => updateField('maxCapacityUsers', parseInt(e.target.value) || 100)}
            min={1}
          />
          <p className="text-xs text-muted-foreground">
            Maximum supported concurrent users (system limit)
          </p>
        </div>

        {/* SLA Response Time */}
        <div className="space-y-2">
          <Label htmlFor="slaRt" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            SLA Response Time (ms)
          </Label>
          <Input
            id="slaRt"
            type="number"
            value={inputs.slaResponseTimeMs}
            onChange={(e) => updateField('slaResponseTimeMs', parseInt(e.target.value) || 1000)}
            min={100}
          />
          <p className="text-xs text-muted-foreground">
            Maximum acceptable response time per SLA
          </p>
        </div>

        {/* Error Rate Threshold */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            Error Rate Threshold: {inputs.errorRateThreshold}%
          </Label>
          <Slider
            value={[inputs.errorRateThreshold]}
            onValueChange={([value]) => updateField('errorRateThreshold', value)}
            min={0.1}
            max={10}
            step={0.1}
          />
          <p className="text-xs text-muted-foreground">
            Maximum acceptable error rate before test fails
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
