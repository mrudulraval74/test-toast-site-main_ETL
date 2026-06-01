import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Layers, Server, Workflow, Info } from "lucide-react";
import {
  WorkloadModelType,
  SystemType,
  LoadPatternType,
  BusinessInputs,
  TechnicalInputs,
  UserJourney,
  LoadLevel,
  TestPlanConfig,
  RecordedStep,
  DEFAULT_BUSINESS_INPUTS,
  DEFAULT_TECHNICAL_INPUTS,
} from "./types";
import {
  BusinessInputsCard,
  TechnicalInputsCard,
  UserJourneyManager,
  WorkloadCalculator,
  LoadPatternSelector,
  WorkloadDocumentGenerator,
  getRecommendedModelType,
  getRecommendedLoadPattern,
  getSystemTypeLabel,
} from "./workload";
import { toast } from "sonner";

interface WorkloadModelingTabProps {
  onApplyToConfig: (config: Partial<TestPlanConfig>) => void;
  recordedSteps: RecordedStep[];
}

export const WorkloadModelingTab = ({
  onApplyToConfig,
  recordedSteps,
}: WorkloadModelingTabProps) => {
  // System & Model Selection
  const [systemType, setSystemType] = useState<SystemType>("api");
  const [modelType, setModelType] = useState<WorkloadModelType>("open");
  const [loadPattern, setLoadPattern] = useState<LoadPatternType>("steady");

  // Inputs
  const [businessInputs, setBusinessInputs] = useState<BusinessInputs>(DEFAULT_BUSINESS_INPUTS);
  const [technicalInputs, setTechnicalInputs] = useState<TechnicalInputs>(DEFAULT_TECHNICAL_INPUTS);
  
  // User Journeys
  const [userJourneys, setUserJourneys] = useState<UserJourney[]>([]);
  
  // Calculation Settings
  const [loadLevel, setLoadLevel] = useState<LoadLevel>("peak");
  const [thinkTime, setThinkTime] = useState(2000);

  // Handle system type change with recommendations
  const handleSystemTypeChange = (type: SystemType) => {
    setSystemType(type);
    const recommendedModel = getRecommendedModelType(type);
    const recommendedPattern = getRecommendedLoadPattern(type);
    setModelType(recommendedModel);
    setLoadPattern(recommendedPattern);
    toast.info(
      `Recommended: ${recommendedModel === 'open' ? 'Open (Rate-based)' : 'Closed (User-based)'} model with ${recommendedPattern} pattern`
    );
  };

  // Apply to configuration
  const handleApply = useCallback((config: Partial<TestPlanConfig>) => {
    onApplyToConfig(config);
    toast.success("Workload model applied to configuration");
  }, [onApplyToConfig]);

  return (
    <div className="space-y-6">
      {/* System Type & Model Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            System Type & Model
          </CardTitle>
          <CardDescription>
            Select your application type to get recommended workload model settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* System Type */}
            <div className="space-y-2">
              <Label>Application Type</Label>
              <Select value={systemType} onValueChange={(v) => handleSystemTypeChange(v as SystemType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ui-web">UI / Web Application</SelectItem>
                  <SelectItem value="api">REST APIs</SelectItem>
                  <SelectItem value="auth">Authentication (OAuth/SSO)</SelectItem>
                  <SelectItem value="erp">ERP / Legacy System</SelectItem>
                  <SelectItem value="microservices">Microservices</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Helps determine optimal testing approach
              </p>
            </div>

            {/* Workload Model Type */}
            <div className="space-y-4">
              <Label>Workload Model</Label>
              <div className="flex gap-4">
                <button
                  onClick={() => setModelType("closed")}
                  className={`flex-1 p-4 rounded-lg border-2 text-left transition-all ${
                    modelType === "closed"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="font-medium mb-1">Closed Model</div>
                  <div className="text-xs text-muted-foreground">
                    User-based: Fixed concurrent users, TPS depends on response time
                  </div>
                </button>
                <button
                  onClick={() => setModelType("open")}
                  className={`flex-1 p-4 rounded-lg border-2 text-left transition-all ${
                    modelType === "open"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="font-medium mb-1">Open Model</div>
                  <div className="text-xs text-muted-foreground">
                    Rate-based: Fixed TPS using Little's Law
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Model Info Banner */}
          <div className="flex items-start gap-3 bg-muted/50 rounded-lg p-4">
            <Info className="h-5 w-5 text-primary mt-0.5" />
            <div className="text-sm">
              <p className="font-medium mb-1">
                {modelType === "open" ? "Open Model (Little's Law)" : "Closed Model"}
              </p>
              <p className="text-muted-foreground">
                {modelType === "open"
                  ? "Requests arrive at a fixed rate independent of response time. Best for API and microservices testing. Formula: Concurrency = TPS × Avg Response Time"
                  : "Users wait for response before next request. Best for UI/Web applications. TPS naturally adjusts based on system performance."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Load Pattern Selector */}
      <LoadPatternSelector selected={loadPattern} onChange={setLoadPattern} />

      {/* Business & Technical Inputs */}
      <div className="grid lg:grid-cols-2 gap-6">
        <BusinessInputsCard inputs={businessInputs} onChange={setBusinessInputs} />
        <TechnicalInputsCard inputs={technicalInputs} onChange={setTechnicalInputs} />
      </div>

      {/* User Journeys */}
      <UserJourneyManager
        journeys={userJourneys}
        onChange={setUserJourneys}
        recordedSteps={recordedSteps}
      />

      {/* Think Time */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Workflow className="h-5 w-5" />
            Think Time Configuration
          </CardTitle>
          <CardDescription>
            Simulate realistic user behavior with delays between requests
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Think Time: {thinkTime}ms ({(thinkTime / 1000).toFixed(1)}s)</Label>
              <Badge variant="outline">
                {thinkTime < 1000 ? "API-style" : thinkTime < 3000 ? "Fast user" : "Realistic user"}
              </Badge>
            </div>
            <Slider
              value={[thinkTime]}
              onValueChange={([value]) => setThinkTime(value)}
              min={0}
              max={10000}
              step={100}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0ms (No delay)</span>
              <span>5s (Moderate)</span>
              <span>10s (Heavy thinking)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calculator & Export */}
      <div className="grid lg:grid-cols-2 gap-6">
        <WorkloadCalculator
          modelType={modelType}
          businessInputs={businessInputs}
          technicalInputs={technicalInputs}
          loadLevel={loadLevel}
          onLoadLevelChange={setLoadLevel}
          thinkTime={thinkTime}
          onApply={handleApply}
        />
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Export & Documentation
            </CardTitle>
            <CardDescription>
              Generate shareable workload model documentation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Export your workload model configuration as a document for stakeholder review, 
              capacity planning, or test documentation.
            </p>
            <div className="flex flex-col gap-3">
              <WorkloadDocumentGenerator
                modelType={modelType}
                systemType={systemType}
                loadPattern={loadPattern}
                businessInputs={businessInputs}
                technicalInputs={technicalInputs}
                userJourneys={userJourneys}
                loadLevel={loadLevel}
                thinkTime={thinkTime}
              />
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
              <p className="font-medium mb-1">Document includes:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Load model summary & key metrics</li>
                <li>User journey traffic matrix</li>
                <li>TPS to concurrency calculations</li>
                <li>JMeter configuration snippet</li>
                <li>Capacity recommendations</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
