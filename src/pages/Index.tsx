import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Projects } from "@/components/Projects";
import { Dashboard } from "@/components/Dashboard";
import { UserStories } from "@/components/UserStories";
import { TestCases } from "@/components/TestCases";
import { TestPlan } from "@/components/TestPlan";
import { TestReport } from "@/components/TestReport";
import { Integrations } from "@/components/Integrations";
import { Repository } from "@/components/Repository";
import { AIAnalytics } from "@/components/AIAnalytics";
import { QAInsights } from "@/components/QAInsights";
import RoleManager from "@/components/RoleManager";
import { Automation } from "@/components/Automation";
import { KnowledgeBase } from "@/components/KnowledgeBase";
import { Defects } from "@/components/Defects";
import { APITestGenerator } from "@/components/APITestGenerator";
import { AdvancedAPITestGenerator } from "@/components/AdvancedAPITestGenerator";
import { SwaggerTestGenerator } from "@/components/SwaggerTestGenerator";
import { JMeterPerformanceTesting } from "@/components/performance-testing";
import { MenuConfigPanel } from "@/components/MenuConfigPanel";
import { ArchitectureVisualization } from "@/components/ArchitectureVisualization";
import { AgentManagement } from "@/components/AgentManagement";
import { NoCodeAutomation } from "@/components/NoCodeAutomation";
import { AIGovernance } from "@/components/AIGovernance";
import { LocalSDLCPage } from "@/components/LocalSDLCPage";
import AIComparison from "@/components/AIComparison";


const Index = () => {
  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState("projects");
  const [selectedProject, setSelectedProject] = useState<{ id: string; name: string } | null>(null);

  const handleProjectSelect = (projectId: string, projectName: string) => {
    setSelectedProject({ id: projectId, name: projectName });
    setCurrentView("dashboard");
    navigate(`/project/${projectId}/dashboard`);
  };

  const handleBackToProjects = () => {
    setSelectedProject(null);
    setCurrentView("projects");
  };

  const renderView = () => {
    if (currentView === "projects") {
      return <Projects onProjectSelect={handleProjectSelect} />;
    }

    if (currentView === "role-manager") {
      return <RoleManager />;
    }

    if (currentView === "qa-insights") {
      return <QAInsights />;
    }

    if (currentView === "ai-analytics") {
      return <AIAnalytics />;
    }

    if (currentView === "knowledge-base") {
      return <KnowledgeBase />;
    }

    if (currentView === "menu-config") {
      return <MenuConfigPanel />;
    }

    if (currentView === "architecture") {
      return <ArchitectureVisualization />;
    }

    if (!selectedProject) {
      return <Projects onProjectSelect={handleProjectSelect} />;
    }

    switch (currentView) {
      case "dashboard":
      case "requirement-dashboard":
        return <Dashboard onViewChange={setCurrentView} projectId={selectedProject.id} />;
      case "requirement-analysis":
      case "user-story":
      case "user-stories":
        return <UserStories onViewChange={setCurrentView} projectId={selectedProject.id} />;
      case "test-cases":
      case "unit-test-cases":
        return <TestCases projectId={selectedProject.id} />;
      case "test-plan":
        return <TestPlan projectId={selectedProject.id} />;
      case "test-report":
        return <TestReport projectId={selectedProject.id} />;
      case "integrations":
        return <Integrations projectId={selectedProject.id} />;
      case "automation":
        return <Automation projectId={selectedProject.id} />;
      case "repository":
      case "development-dashboard":
      case "feature-implementation":
      case "explain-code":
      case "peer-review":
        return <Repository projectId={selectedProject.id} />;
      case "maintenance-issues":
      case "defects":
        return <Defects onViewChange={setCurrentView} projectId={selectedProject.id} />;
      case "api-contracts":
      case "api":
        return <SwaggerTestGenerator projectId={selectedProject.id} />;
      case "performance":
      case "performance-testing":
        return <JMeterPerformanceTesting projectId={selectedProject.id} />;
      case "nocode-automation":
        return <NoCodeAutomation projectId={selectedProject.id} />;
      case "ai-governance":
        return <AIGovernance projectId={selectedProject.id} />;
      case "etl-workflow":
        return <AIComparison />;
      case "agents":
      case "deployment-dashboard":
        return <AgentManagement projectId={selectedProject.id} />;
      case "design-dashboard":
        return <ArchitectureVisualization />;
      case "ui-ux-wireframes":
        return <LocalSDLCPage title="UI/UX Wireframes" phase="Design" projectId={selectedProject.id} onViewChange={setCurrentView} />;
      case "data-model":
        return <LocalSDLCPage title="Data Model" phase="Design" projectId={selectedProject.id} onViewChange={setCurrentView} />;
      case "cicd-pipeline":
        return <Integrations projectId={selectedProject.id} />;
      case "iac":
        return <LocalSDLCPage title="Infrastructure as Code" phase="Deployment" projectId={selectedProject.id} onViewChange={setCurrentView} />;
      default:
        return <LocalSDLCPage title={currentView} phase="Project" projectId={selectedProject.id} onViewChange={setCurrentView} />;
    }
  };

  return (
    <Layout
      currentView={currentView}
      onViewChange={setCurrentView}
      selectedProject={selectedProject}
      onBackToProjects={handleBackToProjects}
    >
      {renderView()}
    </Layout>
  );
};

export default Index;
