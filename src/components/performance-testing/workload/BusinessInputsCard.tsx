import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Users, Clock, TrendingUp, Calendar } from "lucide-react";
import { BusinessInputs } from "../types";

interface BusinessInputsCardProps {
  inputs: BusinessInputs;
  onChange: (inputs: BusinessInputs) => void;
}

export const BusinessInputsCard = ({ inputs, onChange }: BusinessInputsCardProps) => {
  const updateField = <K extends keyof BusinessInputs>(field: K, value: BusinessInputs[K]) => {
    onChange({ ...inputs, [field]: value });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Business Inputs
        </CardTitle>
        <CardDescription>
          Define your application's usage patterns and business metrics
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Daily Active Users */}
        <div className="space-y-2">
          <Label htmlFor="dau" className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            Daily Active Users (DAU)
          </Label>
          <Input
            id="dau"
            type="number"
            value={inputs.dailyActiveUsers}
            onChange={(e) => updateField('dailyActiveUsers', parseInt(e.target.value) || 0)}
            min={1}
          />
          <p className="text-xs text-muted-foreground">
            Total unique users expected per day
          </p>
        </div>

        {/* Peak Hour Multiplier */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            Peak Hour Multiplier: {inputs.peakHourMultiplier}x
          </Label>
          <Slider
            value={[inputs.peakHourMultiplier]}
            onValueChange={([value]) => updateField('peakHourMultiplier', value)}
            min={1}
            max={10}
            step={0.5}
          />
          <p className="text-xs text-muted-foreground">
            How much traffic increases during peak hours vs average
          </p>
        </div>

        {/* Session Duration */}
        <div className="space-y-2">
          <Label htmlFor="sessionDuration" className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Avg Session Duration (minutes)
          </Label>
          <Input
            id="sessionDuration"
            type="number"
            value={inputs.sessionDurationMinutes}
            onChange={(e) => updateField('sessionDurationMinutes', parseInt(e.target.value) || 1)}
            min={1}
            max={120}
          />
        </div>

        {/* Actions Per Session */}
        <div className="space-y-2">
          <Label htmlFor="actionsPerSession">Avg Actions Per Session</Label>
          <Input
            id="actionsPerSession"
            type="number"
            value={inputs.averageActionsPerSession}
            onChange={(e) => updateField('averageActionsPerSession', parseInt(e.target.value) || 1)}
            min={1}
          />
          <p className="text-xs text-muted-foreground">
            Number of requests/actions per user session
          </p>
        </div>

        {/* Peak Hour Settings */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="peakHourStart" className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              Peak Hour Start (UTC)
            </Label>
            <Input
              id="peakHourStart"
              type="time"
              value={inputs.peakHourStartUtc}
              onChange={(e) => updateField('peakHourStartUtc', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="peakHourDuration">Peak Duration (min)</Label>
            <Input
              id="peakHourDuration"
              type="number"
              value={inputs.peakHourDurationMinutes}
              onChange={(e) => updateField('peakHourDurationMinutes', parseInt(e.target.value) || 60)}
              min={30}
              max={480}
            />
          </div>
        </div>

        {/* Seasonal Spike */}
        <div className="border-t pt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="seasonalSpike">Seasonal/Event Spike</Label>
              <p className="text-xs text-muted-foreground">
                Account for sales, promotions, or events
              </p>
            </div>
            <Switch
              id="seasonalSpike"
              checked={inputs.seasonalSpike}
              onCheckedChange={(checked) => updateField('seasonalSpike', checked)}
            />
          </div>
          
          {inputs.seasonalSpike && (
            <div className="space-y-3">
              <Label>Spike Multiplier: {inputs.spikeMultiplier}x</Label>
              <Slider
                value={[inputs.spikeMultiplier]}
                onValueChange={([value]) => updateField('spikeMultiplier', value)}
                min={1.5}
                max={10}
                step={0.5}
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
