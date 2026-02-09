import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ComplianceRule {
  rule: string;
  isMet: boolean;
  suggestion?: string;
}

export interface ComplianceResult {
  standardName: string;
  standardType: string;
  isCompliant: boolean;
  complianceScore: number; // 0-100
  rules: ComplianceRule[];
  overallSuggestions: string[];
}

export interface ArtifactForCompliance {
  type: "test_case" | "user_story" | "defect" | "automation";
  title?: string;
  description?: string;
  steps?: string;
  expectedResult?: string;
  acceptanceCriteria?: string;
  priority?: string;
  testData?: string;
  traceability?: string;
  [key: string]: any;
}

// ISO 9001/90003 compliance rules
const ISO_COMPLIANCE_CHECKS: { rule: string; check: (artifact: ArtifactForCompliance) => boolean; suggestion: string }[] = [
  {
    rule: "All test cases must be traceable to documented requirements",
    check: (a) => !!(a.traceability || a.description?.toLowerCase().includes("req-") || a.description?.toLowerCase().includes("requirement")),
    suggestion: "Add requirement traceability (e.g., REQ-XXX) in description or link to requirements"
  },
  {
    rule: "Test procedures must be documented and version controlled",
    check: (a) => !!(a.steps && a.steps.length > 20),
    suggestion: "Document detailed test steps with clear procedures"
  },
  {
    rule: "Non-conformities must be recorded and tracked to resolution",
    check: (a) => a.type !== "defect" || !!(a.status || a.resolution),
    suggestion: "Ensure defects have status tracking and resolution notes"
  },
  {
    rule: "Test evidence must be preserved and accessible",
    check: (a) => !!(a.expectedResult || a.testData),
    suggestion: "Include expected results and test data for evidence preservation"
  },
  {
    rule: "Customer requirements must drive test prioritization",
    check: (a) => !!(a.priority && ["high", "critical", "medium"].includes(a.priority.toLowerCase())),
    suggestion: "Set priority based on customer requirements importance"
  },
  {
    rule: "Risk-based approach to test coverage",
    check: (a) => !!(a.priority || a.description?.toLowerCase().includes("risk")),
    suggestion: "Document risk level or risk-based prioritization"
  },
];

// CMMI compliance rules
const CMMI_COMPLIANCE_CHECKS: { rule: string; check: (artifact: ArtifactForCompliance) => boolean; suggestion: string }[] = [
  {
    rule: "Define and document test process with clear entry/exit criteria",
    check: (a) => !!(a.steps && (a.steps.includes("precondition") || a.steps.includes("given") || a.description?.toLowerCase().includes("entry"))),
    suggestion: "Add entry criteria/preconditions and exit criteria to test cases"
  },
  {
    rule: "Establish measurable quality objectives for testing",
    check: (a) => !!(a.expectedResult && a.expectedResult.length > 10),
    suggestion: "Define specific, measurable expected outcomes"
  },
  {
    rule: "Implement peer reviews for test cases before execution",
    check: (a) => !!(a.status === "approved" || a.status === "reviewed"),
    suggestion: "Include review status tracking for peer review process"
  },
  {
    rule: "Track and analyze defect metrics (density, removal efficiency)",
    check: (a) => a.type !== "defect" || !!(a.severity || a.category),
    suggestion: "Categorize defects with severity for metric tracking"
  },
  {
    rule: "Maintain test case repository with version control",
    check: (a) => !!(a.id || a.readable_id),
    suggestion: "Ensure unique identifiers for version control"
  },
  {
    rule: "Conduct root cause analysis for escaped defects",
    check: (a) => a.type !== "defect" || !!(a.rootCause || a.description?.toLowerCase().includes("root cause")),
    suggestion: "Include root cause analysis in defect reports"
  },
  {
    rule: "Define test coverage metrics and track achievement",
    check: (a) => !!(a.coverage || a.description?.toLowerCase().includes("coverage")),
    suggestion: "Document test coverage scope and metrics"
  },
  {
    rule: "Establish quantitative process management for testing",
    check: (a) => !!(a.testData || a.metrics),
    suggestion: "Include quantitative data in test documentation"
  },
];

interface ActiveStandard {
  id: string;
  name: string;
  standard_type: string;
  rules: any;
  is_active: boolean | null;
}

export const useComplianceChecker = (projectId: string) => {
  const [isChecking, setIsChecking] = useState(false);
  const [complianceResults, setComplianceResults] = useState<ComplianceResult[]>([]);
  const [activeStandards, setActiveStandards] = useState<ActiveStandard[]>([]);

  // Load active standards (ISO and CMMI only)
  const loadActiveStandards = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("qa_standards")
        .select("id, name, standard_type, rules, is_active")
        .eq("project_id", projectId)
        .eq("is_active", true);

      if (error) throw error;

      // Filter for ISO and CMMI standards
      const relevantStandards = (data || []).filter(s => 
        s.name.toLowerCase().includes("iso") || 
        s.name.toLowerCase().includes("cmmi")
      );

      setActiveStandards(relevantStandards);
      return relevantStandards;
    } catch (error) {
      console.error("Error loading active standards:", error);
      return [];
    }
  }, [projectId]);

  // Check compliance for a single artifact
  const checkCompliance = useCallback(async (artifact: ArtifactForCompliance): Promise<ComplianceResult[]> => {
    setIsChecking(true);
    const results: ComplianceResult[] = [];

    try {
      const standards = await loadActiveStandards();

      for (const standard of standards) {
        const isISO = standard.name.toLowerCase().includes("iso");
        const isCMMI = standard.name.toLowerCase().includes("cmmi");

        let checks: typeof ISO_COMPLIANCE_CHECKS = [];
        if (isISO) checks = ISO_COMPLIANCE_CHECKS;
        else if (isCMMI) checks = CMMI_COMPLIANCE_CHECKS;

        if (checks.length === 0) continue;

        const rules: ComplianceRule[] = checks.map(check => ({
          rule: check.rule,
          isMet: check.check(artifact),
          suggestion: check.check(artifact) ? undefined : check.suggestion,
        }));

        const metCount = rules.filter(r => r.isMet).length;
        const complianceScore = Math.round((metCount / rules.length) * 100);

        const overallSuggestions: string[] = [];
        if (complianceScore < 50) {
          overallSuggestions.push(`Critical: Only ${complianceScore}% compliance with ${standard.name}. Address the missing requirements urgently.`);
        } else if (complianceScore < 80) {
          overallSuggestions.push(`Improvement needed: ${complianceScore}% compliance. Review and address the suggestions below.`);
        }

        results.push({
          standardName: standard.name,
          standardType: standard.standard_type,
          isCompliant: complianceScore >= 80,
          complianceScore,
          rules,
          overallSuggestions,
        });
      }

      setComplianceResults(results);
      return results;
    } catch (error) {
      console.error("Error checking compliance:", error);
      return [];
    } finally {
      setIsChecking(false);
    }
  }, [loadActiveStandards]);

  // Check compliance for multiple artifacts (batch)
  const checkBatchCompliance = useCallback(async (artifacts: ArtifactForCompliance[]): Promise<Map<number, ComplianceResult[]>> => {
    setIsChecking(true);
    const allResults = new Map<number, ComplianceResult[]>();

    try {
      const standards = await loadActiveStandards();

      artifacts.forEach((artifact, index) => {
        const results: ComplianceResult[] = [];

        for (const standard of standards) {
          const isISO = standard.name.toLowerCase().includes("iso");
          const isCMMI = standard.name.toLowerCase().includes("cmmi");

          let checks: typeof ISO_COMPLIANCE_CHECKS = [];
          if (isISO) checks = ISO_COMPLIANCE_CHECKS;
          else if (isCMMI) checks = CMMI_COMPLIANCE_CHECKS;

          if (checks.length === 0) continue;

          const rules: ComplianceRule[] = checks.map(check => ({
            rule: check.rule,
            isMet: check.check(artifact),
            suggestion: check.check(artifact) ? undefined : check.suggestion,
          }));

          const metCount = rules.filter(r => r.isMet).length;
          const complianceScore = Math.round((metCount / rules.length) * 100);

          const overallSuggestions: string[] = [];
          if (complianceScore < 50) {
            overallSuggestions.push(`Critical: Only ${complianceScore}% compliance with ${standard.name}.`);
          } else if (complianceScore < 80) {
            overallSuggestions.push(`Improvement needed: ${complianceScore}% compliance.`);
          }

          results.push({
            standardName: standard.name,
            standardType: standard.standard_type,
            isCompliant: complianceScore >= 80,
            complianceScore,
            rules,
            overallSuggestions,
          });
        }

        allResults.set(index, results);
      });

      return allResults;
    } catch (error) {
      console.error("Error checking batch compliance:", error);
      return allResults;
    } finally {
      setIsChecking(false);
    }
  }, [loadActiveStandards]);

  // Get quick compliance summary
  const getComplianceSummary = useCallback((results: ComplianceResult[]) => {
    if (results.length === 0) return null;

    const avgScore = Math.round(results.reduce((sum, r) => sum + r.complianceScore, 0) / results.length);
    const allCompliant = results.every(r => r.isCompliant);
    const failingStandards = results.filter(r => !r.isCompliant).map(r => r.standardName);

    return {
      averageScore: avgScore,
      isFullyCompliant: allCompliant,
      failingStandards,
      totalStandards: results.length,
      compliantStandards: results.filter(r => r.isCompliant).length,
    };
  }, []);

  return {
    isChecking,
    complianceResults,
    activeStandards,
    loadActiveStandards,
    checkCompliance,
    checkBatchCompliance,
    getComplianceSummary,
  };
};
