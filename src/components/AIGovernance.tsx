import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, History, Sparkles, Search, BookOpen, Award } from "lucide-react";
import { SafetyControlsConfig } from "./SafetyControlsConfig";
import { AIAuditDashboard } from "./AIAuditDashboard";
import { QAPatternsManager } from "./QAPatternsManager";
import { QASemanticSearch } from "./QASemanticSearch";
import { QAStandardsManager } from "./QAStandardsManager";
import { ComplianceSummaryCard } from "./ComplianceSummaryCard";
import { supabase } from "@/integrations/supabase/client";
import { ArtifactForCompliance } from "@/hooks/useComplianceChecker";

interface AIGovernanceProps {
  projectId: string;
}

export const AIGovernance = ({ projectId }: AIGovernanceProps) => {
  const [artifacts, setArtifacts] = useState<ArtifactForCompliance[]>([]);
  const [isLoadingArtifacts, setIsLoadingArtifacts] = useState(false);

  // Load recent artifacts for compliance checking
  const loadRecentArtifacts = async () => {
    setIsLoadingArtifacts(true);
    try {
      // Load recent test cases
      const { data: testCases } = await supabase
        .from("test_cases")
        .select("id, readable_id, title, description, steps, expected_result, priority, status, test_data")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(50);

      // Load recent user stories
      const { data: userStories } = await supabase
        .from("user_stories")
        .select("id, readable_id, title, description, acceptance_criteria, priority, status")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(20);

      const tcArtifacts: ArtifactForCompliance[] = (testCases || []).map(tc => ({
        type: "test_case",
        title: tc.title,
        description: tc.description || undefined,
        steps: tc.steps || undefined,
        expectedResult: tc.expected_result || undefined,
        priority: tc.priority || undefined,
        status: tc.status || undefined,
        testData: tc.test_data || undefined,
        id: tc.id,
        readable_id: tc.readable_id || undefined,
      }));

      const usArtifacts: ArtifactForCompliance[] = (userStories || []).map(us => ({
        type: "user_story",
        title: us.title,
        description: us.description || undefined,
        acceptanceCriteria: us.acceptance_criteria || undefined,
        priority: us.priority || undefined,
        status: us.status || undefined,
        id: us.id,
        readable_id: us.readable_id || undefined,
      }));

      setArtifacts([...tcArtifacts, ...usArtifacts]);
    } catch (error) {
      console.error("Error loading artifacts for compliance:", error);
    } finally {
      setIsLoadingArtifacts(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      loadRecentArtifacts();
    }
  }, [projectId]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <CardTitle>AI Governance</CardTitle>
        </div>
        <CardDescription>
          Configure AI safety controls, review audit history, and manage proven QA patterns
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="safety" className="w-full">
          <TabsList className="grid w-full grid-cols-6 mb-4">
            <TabsTrigger value="safety" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Safety
            </TabsTrigger>
            <TabsTrigger value="standards" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Standards
            </TabsTrigger>
            <TabsTrigger value="compliance" className="flex items-center gap-2">
              <Award className="h-4 w-4" />
              Compliance
            </TabsTrigger>
            <TabsTrigger value="patterns" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Patterns
            </TabsTrigger>
            <TabsTrigger value="search" className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              Search
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Audit
            </TabsTrigger>
          </TabsList>
          <TabsContent value="safety" className="mt-0">
            <SafetyControlsConfig projectId={projectId} isEmbedded />
          </TabsContent>
          <TabsContent value="standards" className="mt-0">
            <QAStandardsManager projectId={projectId} isEmbedded />
          </TabsContent>
          <TabsContent value="compliance" className="mt-0">
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Check if your generated artifacts meet ISO 9001/90003 and CMMI standards. 
                Enable these standards in the Standards tab to see compliance status.
              </div>
              <ComplianceSummaryCard 
                projectId={projectId} 
                artifacts={artifacts}
                title="Recent Artifacts Compliance"
              />
            </div>
          </TabsContent>
          <TabsContent value="patterns" className="mt-0">
            <QAPatternsManager projectId={projectId} isEmbedded />
          </TabsContent>
          <TabsContent value="search" className="mt-0">
            <QASemanticSearch projectId={projectId} isEmbedded />
          </TabsContent>
          <TabsContent value="audit" className="mt-0">
            <AIAuditDashboard projectId={projectId} isEmbedded />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
