import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  CheckCircle, XCircle, AlertTriangle, Shield, ChevronDown, ChevronRight, 
  Lightbulb, RefreshCw, FileText, TrendingUp, Award
} from "lucide-react";
import { useComplianceChecker, ComplianceResult, ArtifactForCompliance } from "@/hooks/useComplianceChecker";
import { cn } from "@/lib/utils";

interface ComplianceSummaryCardProps {
  projectId: string;
  artifacts: ArtifactForCompliance[];
  title?: string;
  className?: string;
}

interface AggregatedResult {
  standardName: string;
  averageScore: number;
  totalArtifacts: number;
  compliantArtifacts: number;
  commonMissingRules: { rule: string; count: number; suggestion: string }[];
}

export const ComplianceSummaryCard = ({
  projectId,
  artifacts,
  title = "Compliance Overview",
  className,
}: ComplianceSummaryCardProps) => {
  const { isChecking, checkBatchCompliance, activeStandards, loadActiveStandards } = useComplianceChecker(projectId);
  const [aggregatedResults, setAggregatedResults] = useState<AggregatedResult[]>([]);
  const [expandedStandard, setExpandedStandard] = useState<string | null>(null);
  const [hasActiveStandards, setHasActiveStandards] = useState<boolean | null>(null);
  const [overallScore, setOverallScore] = useState(0);

  const runCheck = async () => {
    const standards = await loadActiveStandards();
    setHasActiveStandards(standards.length > 0);
    
    if (standards.length === 0 || artifacts.length === 0) return;

    const batchResults = await checkBatchCompliance(artifacts);
    
    // Aggregate results by standard
    const standardMap = new Map<string, { 
      scores: number[]; 
      missingRules: Map<string, { count: number; suggestion: string }>;
    }>();

    batchResults.forEach((results) => {
      results.forEach((result) => {
        if (!standardMap.has(result.standardName)) {
          standardMap.set(result.standardName, { scores: [], missingRules: new Map() });
        }
        const entry = standardMap.get(result.standardName)!;
        entry.scores.push(result.complianceScore);
        
        result.rules.filter(r => !r.isMet).forEach(rule => {
          const existing = entry.missingRules.get(rule.rule);
          if (existing) {
            existing.count++;
          } else {
            entry.missingRules.set(rule.rule, { count: 1, suggestion: rule.suggestion || "" });
          }
        });
      });
    });

    const aggregated: AggregatedResult[] = [];
    standardMap.forEach((value, key) => {
      const avgScore = Math.round(value.scores.reduce((a, b) => a + b, 0) / value.scores.length);
      const compliantCount = value.scores.filter(s => s >= 80).length;
      
      const missingRulesList = Array.from(value.missingRules.entries())
        .map(([rule, data]) => ({ rule, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      aggregated.push({
        standardName: key,
        averageScore: avgScore,
        totalArtifacts: value.scores.length,
        compliantArtifacts: compliantCount,
        commonMissingRules: missingRulesList,
      });
    });

    setAggregatedResults(aggregated);
    
    if (aggregated.length > 0) {
      const overall = Math.round(aggregated.reduce((sum, r) => sum + r.averageScore, 0) / aggregated.length);
      setOverallScore(overall);
    }
  };

  useEffect(() => {
    runCheck();
  }, [artifacts, projectId]);

  if (hasActiveStandards === false) {
    return (
      <Card className={cn("", className)}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">{title}</CardTitle>
          </div>
          <CardDescription>
            No active ISO or CMMI standards configured. Enable standards in AI Governance → Standards tab.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (artifacts.length === 0) {
    return (
      <Card className={cn("", className)}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">{title}</CardTitle>
          </div>
          <CardDescription>
            No artifacts to check for compliance.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600 dark:text-green-400";
    if (score >= 50) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getScoreIcon = (score: number) => {
    if (score >= 80) return <Award className="h-5 w-5 text-green-500" />;
    if (score >= 50) return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    return <XCircle className="h-5 w-5 text-red-500" />;
  };

  return (
    <Card className={cn("", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">{title}</CardTitle>
          </div>
          <Button variant="outline" size="sm" onClick={runCheck} disabled={isChecking}>
            <RefreshCw className={cn("h-4 w-4 mr-1", isChecking && "animate-spin")} />
            Refresh
          </Button>
        </div>
        <CardDescription>
          Checking {artifacts.length} artifact{artifacts.length !== 1 ? "s" : ""} against active standards
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isChecking ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : aggregatedResults.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Shield className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No compliance data available</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Overall Score */}
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {getScoreIcon(overallScore)}
                  <span className="font-semibold">Overall Compliance</span>
                </div>
                <span className={cn("text-2xl font-bold", getScoreColor(overallScore))}>
                  {overallScore}%
                </span>
              </div>
              <Progress value={overallScore} className="h-2" />
              <p className="text-xs text-muted-foreground mt-2">
                {aggregatedResults.filter(r => r.averageScore >= 80).length} of {aggregatedResults.length} standards met
              </p>
            </div>

            {/* Per-Standard Results */}
            <ScrollArea className="max-h-96">
              <div className="space-y-3">
                {aggregatedResults.map((result) => (
                  <Collapsible
                    key={result.standardName}
                    open={expandedStandard === result.standardName}
                    onOpenChange={(open) => setExpandedStandard(open ? result.standardName : null)}
                  >
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted cursor-pointer">
                        <div className="flex items-center gap-3">
                          {result.averageScore >= 80 ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          ) : result.averageScore >= 50 ? (
                            <AlertTriangle className="h-5 w-5 text-yellow-500" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-500" />
                          )}
                          <div>
                            <p className="font-medium">{result.standardName}</p>
                            <p className="text-xs text-muted-foreground">
                              {result.compliantArtifacts}/{result.totalArtifacts} artifacts compliant
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={result.averageScore >= 80 ? "default" : result.averageScore >= 50 ? "secondary" : "destructive"}
                          >
                            {result.averageScore}%
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
                      <div className="px-4 py-3 border-x border-b rounded-b-lg bg-muted/30">
                        {result.commonMissingRules.length > 0 ? (
                          <div className="space-y-2">
                            <p className="text-sm font-medium flex items-center gap-1 text-yellow-700 dark:text-yellow-300">
                              <Lightbulb className="h-4 w-4" />
                              Common issues to address:
                            </p>
                            {result.commonMissingRules.map((rule, idx) => (
                              <div key={idx} className="text-sm p-2 bg-background rounded border">
                                <div className="flex items-start justify-between">
                                  <p className="text-muted-foreground flex-1">
                                    <XCircle className="h-3 w-3 inline mr-1 text-red-500" />
                                    {rule.rule}
                                  </p>
                                  <Badge variant="outline" className="ml-2 text-xs">
                                    {rule.count} artifact{rule.count !== 1 ? "s" : ""}
                                  </Badge>
                                </div>
                                {rule.suggestion && (
                                  <p className="text-xs text-primary mt-1 pl-4">
                                    → {rule.suggestion}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                            <CheckCircle className="h-4 w-4" />
                            All requirements met for this standard
                          </p>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
