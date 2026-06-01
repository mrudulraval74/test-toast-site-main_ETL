import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Gauge,
  TrendingUp,
  Zap,
  AlertTriangle,
  Timer,
  BarChart3,
  Activity,
  Server,
  Globe,
  Shield,
  RefreshCw,
  Layers,
  Target,
  Workflow,
  Clock,
  CheckCircle2,
  Lightbulb,
} from "lucide-react";
import { TestPlanConfig } from "./types";

interface LoadTestTemplate {
  id: string;
  name: string;
  category: "baseline" | "stress" | "endurance" | "advanced" | "distributed";
  icon: React.ReactNode;
  description: string;
  purpose: string;
  config: Partial<TestPlanConfig>;
  rampUpDescription: string;
  durationDescription: string;
  suggestedFor: string[];
}

const loadTestTemplates: LoadTestTemplate[] = [
  // Baseline & Normal Testing
  {
    id: "baseline",
    name: "Baseline Load",
    category: "baseline",
    icon: <Gauge className="h-5 w-5" />,
    description: "Small user count with slow ramp-up for script validation",
    purpose: "Validate script stability and response correctness",
    config: {
      virtualUsers: 10,
      rampUpTime: 60,
      loopCount: 5,
      duration: 300,
      thinkTime: 2000,
      enableThinkTime: true,
    },
    rampUpDescription: "Slow (60s)",
    durationDescription: "Short (5 min)",
    suggestedFor: ["all", "new-scripts", "validation"],
  },
  {
    id: "normal-load",
    name: "Normal / Expected Load",
    category: "baseline",
    icon: <TrendingUp className="h-5 w-5" />,
    description: "Average production user count with gradual ramp-up",
    purpose: "Verify system behavior under normal conditions",
    config: {
      virtualUsers: 50,
      rampUpTime: 120,
      loopCount: 10,
      duration: 1800,
      thinkTime: 3000,
      enableThinkTime: true,
    },
    rampUpDescription: "Gradual (2 min)",
    durationDescription: "Medium (30 min)",
    suggestedFor: ["web-apps", "e-commerce", "enterprise"],
  },
  {
    id: "peak-load",
    name: "Peak Load",
    category: "baseline",
    icon: <BarChart3 className="h-5 w-5" />,
    description: "Maximum expected concurrent users",
    purpose: "Validate performance during peak business hours",
    config: {
      virtualUsers: 200,
      rampUpTime: 180,
      loopCount: 15,
      duration: 1200,
      thinkTime: 2000,
      enableThinkTime: true,
    },
    rampUpDescription: "Moderate (3 min)",
    durationDescription: "Short-Medium (20 min)",
    suggestedFor: ["e-commerce", "media", "enterprise"],
  },
  // Stress & Limit Testing
  {
    id: "stress-test",
    name: "Stress Test",
    category: "stress",
    icon: <AlertTriangle className="h-5 w-5" />,
    description: "Beyond peak capacity with aggressive ramp-up",
    purpose: "Identify breaking point and failure behavior",
    config: {
      virtualUsers: 500,
      rampUpTime: 60,
      loopCount: 0,
      duration: 0,
      thinkTime: 500,
      enableThinkTime: true,
    },
    rampUpDescription: "Aggressive (1 min)",
    durationDescription: "Until failure",
    suggestedFor: ["critical-apps", "high-traffic", "capacity-planning"],
  },
  {
    id: "spike-test",
    name: "Spike Test",
    category: "stress",
    icon: <Zap className="h-5 w-5" />,
    description: "Sudden traffic jump (e.g., 50 → 500 instantly)",
    purpose: "Test sudden traffic bursts (sales, notifications)",
    config: {
      virtualUsers: 500,
      rampUpTime: 5,
      loopCount: 3,
      duration: 300,
      thinkTime: 1000,
      enableThinkTime: true,
    },
    rampUpDescription: "Very Fast (5s)",
    durationDescription: "Short (5 min)",
    suggestedFor: ["e-commerce", "media", "notification-systems", "flash-sales"],
  },
  {
    id: "capacity-test",
    name: "Capacity Test",
    category: "stress",
    icon: <Layers className="h-5 w-5" />,
    description: "Incremental user increase in steps",
    purpose: "Find max supported users with acceptable SLAs",
    config: {
      virtualUsers: 100,
      rampUpTime: 300,
      loopCount: 20,
      duration: 3600,
      thinkTime: 2000,
      enableThinkTime: true,
    },
    rampUpDescription: "Step-wise (5 min)",
    durationDescription: "Per step fixed (1 hr total)",
    suggestedFor: ["capacity-planning", "sla-validation", "enterprise"],
  },
  // Endurance Testing
  {
    id: "soak-test",
    name: "Soak / Endurance Test",
    category: "endurance",
    icon: <Timer className="h-5 w-5" />,
    description: "Normal or peak load over extended duration",
    purpose: "Detect memory leaks, GC issues, resource exhaustion",
    config: {
      virtualUsers: 100,
      rampUpTime: 300,
      loopCount: 0,
      duration: 21600,
      thinkTime: 3000,
      enableThinkTime: true,
    },
    rampUpDescription: "Slow (5 min)",
    durationDescription: "Long (6 hrs)",
    suggestedFor: ["enterprise", "critical-apps", "production-validation"],
  },
  {
    id: "longevity-test",
    name: "Longevity Test",
    category: "endurance",
    icon: <Activity className="h-5 w-5" />,
    description: "Slightly below peak for multiple days",
    purpose: "Validate long-term stability",
    config: {
      virtualUsers: 150,
      rampUpTime: 600,
      loopCount: 0,
      duration: 86400,
      thinkTime: 5000,
      enableThinkTime: true,
    },
    rampUpDescription: "Very Slow (10 min)",
    durationDescription: "Multiple days (24 hrs)",
    suggestedFor: ["enterprise", "financial", "healthcare"],
  },
  // Advanced Configurations
  {
    id: "concurrency-based",
    name: "Concurrency-Based Load",
    category: "advanced",
    icon: <Target className="h-5 w-5" />,
    description: "Fixed concurrent users with dynamic ramp-up/down",
    purpose: "Maintain constant concurrency irrespective of response time",
    config: {
      virtualUsers: 100,
      rampUpTime: 60,
      loopCount: 0,
      duration: 1800,
      thinkTime: 0,
      enableThinkTime: false,
    },
    rampUpDescription: "Dynamic",
    durationDescription: "Medium (30 min)",
    suggestedFor: ["apis", "microservices", "real-time-apps"],
  },
  {
    id: "custom-ramp",
    name: "Custom Ramp Pattern",
    category: "advanced",
    icon: <Workflow className="h-5 w-5" />,
    description: "Multiple user groups with different ramp patterns",
    purpose: "Mimic real business traffic patterns",
    config: {
      virtualUsers: 200,
      rampUpTime: 300,
      loopCount: 10,
      duration: 3600,
      thinkTime: 2500,
      enableThinkTime: true,
    },
    rampUpDescription: "Custom (multiple stages)",
    durationDescription: "Variable (1 hr)",
    suggestedFor: ["e-commerce", "web-apps", "realistic-load"],
  },
  {
    id: "stepping-load",
    name: "Stepping Load",
    category: "advanced",
    icon: <BarChart3 className="h-5 w-5" />,
    description: "Users added in intervals with pauses between steps",
    purpose: "Observe gradual performance degradation",
    config: {
      virtualUsers: 150,
      rampUpTime: 600,
      loopCount: 5,
      duration: 2400,
      thinkTime: 2000,
      enableThinkTime: true,
    },
    rampUpDescription: "Stepped (10 min total)",
    durationDescription: "Medium (40 min)",
    suggestedFor: ["capacity-planning", "sla-validation"],
  },
  {
    id: "constant-throughput",
    name: "Constant Throughput Load",
    category: "advanced",
    icon: <Gauge className="h-5 w-5" />,
    description: "TPS controlled, users adjusted to meet target",
    purpose: "SLA validation (e.g., 200 req/sec)",
    config: {
      virtualUsers: 100,
      rampUpTime: 120,
      loopCount: 0,
      duration: 1800,
      thinkTime: 0,
      enableThinkTime: false,
    },
    rampUpDescription: "Auto-adjusted",
    durationDescription: "Medium (30 min)",
    suggestedFor: ["apis", "sla-validation", "payment-systems"],
  },
  {
    id: "arrival-rate",
    name: "Arrival Rate Model",
    category: "advanced",
    icon: <Clock className="h-5 w-5" />,
    description: "Requests per second independent of users",
    purpose: "API / microservices performance testing",
    config: {
      virtualUsers: 50,
      rampUpTime: 30,
      loopCount: 0,
      duration: 1200,
      thinkTime: 0,
      enableThinkTime: false,
    },
    rampUpDescription: "Open model",
    durationDescription: "Medium (20 min)",
    suggestedFor: ["apis", "microservices", "serverless"],
  },
  // Distributed & Resilience Testing
  {
    id: "distributed-load",
    name: "Distributed Load Test",
    category: "distributed",
    icon: <Server className="h-5 w-5" />,
    description: "Multiple JMeter slave machines with central master",
    purpose: "Generate very high load (10k+ users)",
    config: {
      virtualUsers: 500,
      rampUpTime: 300,
      loopCount: 0,
      duration: 3600,
      thinkTime: 2000,
      enableThinkTime: true,
    },
    rampUpDescription: "Distributed (5 min)",
    durationDescription: "Long (1 hr)",
    suggestedFor: ["high-traffic", "enterprise", "production"],
  },
  {
    id: "geo-distributed",
    name: "Geo-Distributed Load",
    category: "distributed",
    icon: <Globe className="h-5 w-5" />,
    description: "Load generators from multiple regions",
    purpose: "Test CDN, latency, global access patterns",
    config: {
      virtualUsers: 200,
      rampUpTime: 180,
      loopCount: 10,
      duration: 1800,
      thinkTime: 3000,
      enableThinkTime: true,
    },
    rampUpDescription: "Regional (3 min)",
    durationDescription: "Medium (30 min)",
    suggestedFor: ["global-apps", "cdn", "multi-region"],
  },
  {
    id: "failover-test",
    name: "Failover Load Test",
    category: "distributed",
    icon: <Shield className="h-5 w-5" />,
    description: "Normal load + node shutdown simulation",
    purpose: "Validate HA and failover mechanisms",
    config: {
      virtualUsers: 100,
      rampUpTime: 120,
      loopCount: 0,
      duration: 2400,
      thinkTime: 2000,
      enableThinkTime: true,
    },
    rampUpDescription: "Gradual (2 min)",
    durationDescription: "Medium (40 min)",
    suggestedFor: ["enterprise", "critical-apps", "ha-systems"],
  },
  {
    id: "recovery-test",
    name: "Recovery Test",
    category: "distributed",
    icon: <RefreshCw className="h-5 w-5" />,
    description: "Load → crash → recovery → load pattern",
    purpose: "Validate system recovery time",
    config: {
      virtualUsers: 150,
      rampUpTime: 60,
      loopCount: 5,
      duration: 1800,
      thinkTime: 1500,
      enableThinkTime: true,
    },
    rampUpDescription: "Fast (1 min)",
    durationDescription: "Medium (30 min)",
    suggestedFor: ["enterprise", "disaster-recovery", "resilience"],
  },
];

const applicationTypes = [
  { id: "all", label: "All Applications", description: "Show all templates" },
  { id: "web-apps", label: "Web Applications", description: "Standard web apps with UI" },
  { id: "e-commerce", label: "E-Commerce", description: "Online stores, carts, checkout" },
  { id: "apis", label: "APIs & Microservices", description: "REST/GraphQL APIs, microservices" },
  { id: "enterprise", label: "Enterprise Systems", description: "ERP, CRM, large-scale apps" },
  { id: "media", label: "Media & Streaming", description: "Video, audio, content delivery" },
  { id: "financial", label: "Financial Services", description: "Banking, payments, trading" },
  { id: "healthcare", label: "Healthcare", description: "Medical records, patient portals" },
];

const categoryInfo = {
  baseline: { label: "Baseline & Normal", color: "bg-emerald-500/10 text-emerald-600" },
  stress: { label: "Stress & Limit", color: "bg-red-500/10 text-red-600" },
  endurance: { label: "Endurance", color: "bg-amber-500/10 text-amber-600" },
  advanced: { label: "Advanced", color: "bg-blue-500/10 text-blue-600" },
  distributed: { label: "Distributed & Resilience", color: "bg-purple-500/10 text-purple-600" },
};

interface LoadTestTemplatesProps {
  onApplyTemplate: (config: Partial<TestPlanConfig>) => void;
  currentConfig: TestPlanConfig;
}

export const LoadTestTemplates = ({ onApplyTemplate, currentConfig }: LoadTestTemplatesProps) => {
  const [selectedAppType, setSelectedAppType] = useState("all");
  const [open, setOpen] = useState(false);

  const filteredTemplates = loadTestTemplates.filter(
    (t) => selectedAppType === "all" || t.suggestedFor.includes(selectedAppType) || t.suggestedFor.includes("all")
  );

  const groupedTemplates = filteredTemplates.reduce((acc, template) => {
    if (!acc[template.category]) acc[template.category] = [];
    acc[template.category].push(template);
    return acc;
  }, {} as Record<string, LoadTestTemplate[]>);

  const handleApply = (template: LoadTestTemplate) => {
    onApplyTemplate({
      ...currentConfig,
      ...template.config,
      name: `${template.name} - ${currentConfig.name || "Test Plan"}`,
    });
    setOpen(false);
  };

  const getRecommendedTemplates = () => {
    if (selectedAppType === "all") return [];
    return loadTestTemplates
      .filter((t) => t.suggestedFor.includes(selectedAppType))
      .slice(0, 3);
  };

  const recommendedTemplates = getRecommendedTemplates();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Layers className="h-4 w-4" />
          Load Test Templates
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Load Test Configuration Templates</DialogTitle>
          <DialogDescription>
            Select a pre-configured template based on your testing needs
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Application Type Selector */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <Lightbulb className="h-5 w-5 text-primary mt-0.5" />
                <div className="flex-1 space-y-3">
                  <div>
                    <p className="font-medium text-sm">What type of application are you testing?</p>
                    <p className="text-xs text-muted-foreground">
                      We'll suggest the most relevant templates for your use case
                    </p>
                  </div>
                  <Select value={selectedAppType} onValueChange={setSelectedAppType}>
                    <SelectTrigger className="w-full md:w-80">
                      <SelectValue placeholder="Select application type" />
                    </SelectTrigger>
                    <SelectContent>
                      {applicationTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          <div className="flex flex-col">
                            <span>{type.label}</span>
                            <span className="text-xs text-muted-foreground">{type.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recommended Templates */}
          {recommendedTemplates.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Recommended for {applicationTypes.find(t => t.id === selectedAppType)?.label}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {recommendedTemplates.map((template) => (
                  <Card
                    key={template.id}
                    className="cursor-pointer border-primary/30 hover:border-primary transition-colors"
                    onClick={() => handleApply(template)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 bg-primary/10 rounded-md text-primary">
                          {template.icon}
                        </div>
                        <span className="font-medium text-sm">{template.name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{template.purpose}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* All Templates by Category */}
          <ScrollArea className="h-[400px] pr-4">
            <Tabs defaultValue="baseline" className="w-full">
              <TabsList className="w-full justify-start flex-wrap h-auto gap-1 bg-transparent p-0 mb-4">
                {Object.entries(categoryInfo).map(([key, info]) => (
                  <TabsTrigger
                    key={key}
                    value={key}
                    className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    {info.label}
                    {groupedTemplates[key] && (
                      <Badge variant="secondary" className="ml-1.5 h-5">
                        {groupedTemplates[key].length}
                      </Badge>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>

              {Object.entries(categoryInfo).map(([category, info]) => (
                <TabsContent key={category} value={category} className="mt-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(groupedTemplates[category] || []).map((template) => (
                      <Card
                        key={template.id}
                        className="hover:border-primary/50 transition-colors cursor-pointer group"
                        onClick={() => handleApply(template)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg ${info.color}`}>
                                {template.icon}
                              </div>
                              <div>
                                <h4 className="font-medium text-sm">{template.name}</h4>
                                <p className="text-xs text-muted-foreground">{template.description}</p>
                              </div>
                            </div>
                          </div>
                          
                          <div className="mt-3 pt-3 border-t space-y-2">
                            <p className="text-xs font-medium text-foreground/80">
                              Purpose: <span className="font-normal text-muted-foreground">{template.purpose}</span>
                            </p>
                            <div className="flex flex-wrap gap-2 text-xs">
                              <Badge variant="outline" className="font-normal">
                                {template.config.virtualUsers} users
                              </Badge>
                              <Badge variant="outline" className="font-normal">
                                Ramp: {template.rampUpDescription}
                              </Badge>
                              <Badge variant="outline" className="font-normal">
                                {template.durationDescription}
                              </Badge>
                            </div>
                          </div>
                          
                          <Button
                            size="sm"
                            className="w-full mt-3 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleApply(template);
                            }}
                          >
                            Apply Template
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  {(!groupedTemplates[category] || groupedTemplates[category].length === 0) && (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No templates match your selected application type.</p>
                      <p className="text-sm">Try selecting "All Applications" to see all options.</p>
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};
