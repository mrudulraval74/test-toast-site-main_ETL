import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CheckCircle, XCircle, AlertTriangle, Shield, ChevronDown, ChevronRight, Lightbulb, RefreshCw } from "lucide-react";
import { useComplianceChecker, ComplianceResult, ArtifactForCompliance } from "@/hooks/useComplianceChecker";
import { cn } from "@/lib/utils";

interface ComplianceIndicatorProps {
  projectId: string;
  artifact: ArtifactForCompliance;
  showBadgeOnly?: boolean;
  className?: string;
  autoCheck?: boolean;
}

export const ComplianceIndicator = ({
  projectId,
  artifact,
  showBadgeOnly = false,
  className,
  autoCheck = true,
}: ComplianceIndicatorProps) => {
  const { isChecking, checkCompliance, getComplianceSummary, activeStandards, loadActiveStandards } = useComplianceChecker(projectId);
  const [results, setResults] = useState<ComplianceResult[]>([]);
  const [expandedStandard, setExpandedStandard] = useState<string | null>(null);
  const [hasActiveStandards, setHasActiveStandards] = useState<boolean | null>(null);

  useEffect(() => {
    const init = async () => {
      const standards = await loadActiveStandards();
      setHasActiveStandards(standards.length > 0);
      
      if (autoCheck && standards.length > 0) {
        const complianceResults = await checkCompliance(artifact);
        setResults(complianceResults);
      }
    };
    init();
  }, [artifact, autoCheck, checkCompliance, loadActiveStandards]);

  const handleRefresh = async () => {
    const complianceResults = await checkCompliance(artifact);
    setResults(complianceResults);
  };

  // Don't show anything if no active ISO/CMMI standards
  if (hasActiveStandards === false) {
    return null;
  }

  const summary = getComplianceSummary(results);

  if (!summary || results.length === 0) {
    if (isChecking) {
      return (
        <Badge variant="outline" className={cn("animate-pulse", className)}>
          <Shield className="h-3 w-3 mr-1" />
          Checking...
        </Badge>
      );
    }
    return null;
  }

  const getBadgeVariant = () => {
    if (summary.isFullyCompliant) return "default";
    if (summary.averageScore >= 50) return "secondary";
    return "destructive";
  };

  const getBadgeIcon = () => {
    if (summary.isFullyCompliant) {
      return <CheckCircle className="h-3 w-3 mr-1 text-green-500" />;
    }
    if (summary.averageScore >= 50) {
      return <AlertTriangle className="h-3 w-3 mr-1 text-yellow-500" />;
    }
    return <XCircle className="h-3 w-3 mr-1 text-red-500" />;
  };

  const badge = (
    <Badge 
      variant={getBadgeVariant()} 
      className={cn(
        "cursor-pointer hover:opacity-80 transition-opacity",
        summary.isFullyCompliant && "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
        !summary.isFullyCompliant && summary.averageScore >= 50 && "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
        !summary.isFullyCompliant && summary.averageScore < 50 && "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
        className
      )}
    >
      {getBadgeIcon()}
      {summary.averageScore}% Compliant
    </Badge>
  );

  if (showBadgeOnly) {
    return badge;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        {badge}
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="start">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <h4 className="font-semibold">Compliance Status</h4>
            </div>
            <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isChecking}>
              <RefreshCw className={cn("h-4 w-4", isChecking && "animate-spin")} />
            </Button>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Progress value={summary.averageScore} className="flex-1" />
            <span className="text-sm font-medium">{summary.averageScore}%</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {summary.compliantStandards}/{summary.totalStandards} standards met
          </p>
        </div>

        <ScrollArea className="max-h-80">
          <div className="p-4 space-y-3">
            {results.map((result) => (
              <Collapsible
                key={result.standardName}
                open={expandedStandard === result.standardName}
                onOpenChange={(open) => setExpandedStandard(open ? result.standardName : null)}
              >
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between p-2 rounded-lg hover:bg-muted cursor-pointer">
                    <div className="flex items-center gap-2">
                      {result.isCompliant ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span className="font-medium text-sm">{result.standardName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={result.isCompliant ? "default" : "destructive"} className="text-xs">
                        {result.complianceScore}%
                      </Badge>
                      {expandedStandard === result.standardName ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="pl-6 pr-2 py-2 space-y-2">
                    {result.overallSuggestions.length > 0 && (
                      <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-xs text-yellow-800 dark:text-yellow-200">
                        {result.overallSuggestions.map((s, i) => (
                          <p key={i}>{s}</p>
                        ))}
                      </div>
                    )}
                    {result.rules.filter(r => !r.isMet).length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                          <Lightbulb className="h-3 w-3" />
                          Suggestions to improve compliance:
                        </p>
                        {result.rules.filter(r => !r.isMet).map((rule, idx) => (
                          <div key={idx} className="text-xs p-2 bg-muted rounded">
                            <p className="text-muted-foreground mb-1">
                              <XCircle className="h-3 w-3 inline mr-1 text-red-500" />
                              {rule.rule}
                            </p>
                            {rule.suggestion && (
                              <p className="text-primary pl-4">→ {rule.suggestion}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {result.rules.filter(r => r.isMet).length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-green-600 dark:text-green-400">
                          ✓ Met requirements:
                        </p>
                        {result.rules.filter(r => r.isMet).map((rule, idx) => (
                          <p key={idx} className="text-xs text-muted-foreground pl-2">
                            • {rule.rule}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
