import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, TrendingUp, Zap, Clock, Settings } from "lucide-react";
import { LoadPatternType } from "../types";
import { cn } from "@/lib/utils";

interface LoadPatternSelectorProps {
  selected: LoadPatternType;
  onChange: (pattern: LoadPatternType) => void;
}

interface PatternConfig {
  id: LoadPatternType;
  name: string;
  description: string;
  useCase: string;
  icon: React.ReactNode;
  graph: string; // SVG path for mini graph
}

const patterns: PatternConfig[] = [
  {
    id: 'steady',
    name: 'Steady Load',
    description: 'Flat concurrency for SLA validation',
    useCase: 'API performance, SLA checks',
    icon: <Activity className="h-4 w-4" />,
    graph: 'M0,40 L20,40 L20,10 L80,10 L80,40 L100,40',
  },
  {
    id: 'ramp-up',
    name: 'Ramp-Up Load',
    description: 'Gradual increase to find capacity',
    useCase: 'Capacity testing, scaling',
    icon: <TrendingUp className="h-4 w-4" />,
    graph: 'M0,40 L30,40 L70,10 L100,10',
  },
  {
    id: 'spike',
    name: 'Spike Load',
    description: 'Sudden traffic burst simulation',
    useCase: 'Auto-scaling, flash sales',
    icon: <Zap className="h-4 w-4" />,
    graph: 'M0,40 L30,40 L35,10 L50,10 L55,40 L100,40',
  },
  {
    id: 'diurnal',
    name: 'Diurnal Pattern',
    description: 'Real-world daily traffic simulation',
    useCase: 'Production-like testing',
    icon: <Clock className="h-4 w-4" />,
    graph: 'M0,35 Q25,40 40,15 Q55,5 70,20 Q85,35 100,40',
  },
  {
    id: 'custom',
    name: 'Custom Pattern',
    description: 'Multiple stages with custom ramp',
    useCase: 'Complex scenarios',
    icon: <Settings className="h-4 w-4" />,
    graph: 'M0,40 L15,40 L25,25 L40,25 L50,15 L65,15 L75,30 L100,30',
  },
];

export const LoadPatternSelector = ({ selected, onChange }: LoadPatternSelectorProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Load Pattern
        </CardTitle>
        <CardDescription>
          Select the traffic pattern that matches your testing objectives
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {patterns.map((pattern) => (
            <button
              key={pattern.id}
              onClick={() => onChange(pattern.id)}
              className={cn(
                "relative flex flex-col items-start p-4 rounded-lg border-2 text-left transition-all hover:border-primary/50",
                selected === pattern.id
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card"
              )}
            >
              {selected === pattern.id && (
                <Badge className="absolute top-2 right-2 text-[10px] px-1.5 py-0">
                  Selected
                </Badge>
              )}

              {/* Mini Graph */}
              <div className="w-full h-10 mb-3">
                <svg
                  viewBox="0 0 100 50"
                  className="w-full h-full"
                  preserveAspectRatio="none"
                >
                  <path
                    d={pattern.graph}
                    fill="none"
                    stroke={selected === pattern.id ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              <div className="flex items-center gap-2 mb-1">
                <span className={cn(
                  "p-1 rounded",
                  selected === pattern.id ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                )}>
                  {pattern.icon}
                </span>
                <span className="font-medium text-sm">{pattern.name}</span>
              </div>
              
              <p className="text-xs text-muted-foreground line-clamp-2">
                {pattern.description}
              </p>
              
              <p className="text-[10px] text-muted-foreground mt-2 opacity-70">
                {pattern.useCase}
              </p>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
