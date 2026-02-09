import React from 'react';
import { 
  FileText, TestTube, Play, BarChart3, Shield, Settings,
  Brain, Wand2, Search, Bug, Bot, Calendar, Eye, Zap,
  GitBranch, FileCode, Globe, Database, Users, Lock
} from 'lucide-react';

interface FeatureGroup {
  phase: string;
  color: string;
  bgColor: string;
  icon: React.ReactNode;
  features: { name: string; icon: React.ReactNode; description: string }[];
}

const featureGroups: FeatureGroup[] = [
  {
    phase: 'Requirements',
    color: 'text-blue-600',
    bgColor: 'bg-blue-500/10 border-blue-500/30',
    icon: <FileText className="h-5 w-5" />,
    features: [
      { name: 'User Stories', icon: <FileText className="h-4 w-4" />, description: 'Import and manage user stories from Jira/Azure DevOps' },
      { name: 'AI Test Generation', icon: <Brain className="h-4 w-4" />, description: 'Generate test cases from requirements using GPT-4' },
      { name: 'Acceptance Criteria', icon: <FileCode className="h-4 w-4" />, description: 'Parse and validate acceptance criteria automatically' },
    ]
  },
  {
    phase: 'Test Design',
    color: 'text-purple-600',
    bgColor: 'bg-purple-500/10 border-purple-500/30',
    icon: <TestTube className="h-5 w-5" />,
    features: [
      { name: 'Test Cases', icon: <TestTube className="h-4 w-4" />, description: 'Structured test cases with steps, data, and expected results' },
      { name: 'Test Plans', icon: <FileText className="h-4 w-4" />, description: 'AI-generated comprehensive test plans' },
      { name: 'API Tests', icon: <Globe className="h-4 w-4" />, description: 'Swagger/OpenAPI to test case generation' },
      { name: 'Integration Tests', icon: <GitBranch className="h-4 w-4" />, description: 'Multi-endpoint flow testing' },
    ]
  },
  {
    phase: 'Automation',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-500/10 border-emerald-500/30',
    icon: <Wand2 className="h-5 w-5" />,
    features: [
      { name: 'No-Code Builder', icon: <Wand2 className="h-4 w-4" />, description: 'Visual test builder with drag-and-drop steps' },
      { name: 'Selenium/Playwright', icon: <FileCode className="h-4 w-4" />, description: 'Generate Java, Python, TypeScript automation code' },
      { name: 'API Automation', icon: <Database className="h-4 w-4" />, description: 'REST API test execution with assertions' },
      { name: 'JMeter Performance', icon: <Zap className="h-4 w-4" />, description: 'Load testing script generation' },
    ]
  },
  {
    phase: 'Execution',
    color: 'text-orange-600',
    bgColor: 'bg-orange-500/10 border-orange-500/30',
    icon: <Play className="h-5 w-5" />,
    features: [
      { name: 'Self-Hosted Agents', icon: <Bot className="h-4 w-4" />, description: 'Run tests on your own infrastructure' },
      { name: 'Scheduled Triggers', icon: <Calendar className="h-4 w-4" />, description: 'Cron-based and deployment-triggered execution' },
      { name: 'Visual Regression', icon: <Eye className="h-4 w-4" />, description: 'Screenshot comparison with masking support' },
      { name: 'Auto-Healing', icon: <Zap className="h-4 w-4" />, description: 'AI-powered selector recovery' },
    ]
  },
  {
    phase: 'Reporting',
    color: 'text-rose-600',
    bgColor: 'bg-rose-500/10 border-rose-500/30',
    icon: <BarChart3 className="h-5 w-5" />,
    features: [
      { name: 'Test Reports', icon: <BarChart3 className="h-4 w-4" />, description: 'AI-generated executive summaries' },
      { name: 'Defect Integration', icon: <Bug className="h-4 w-4" />, description: 'Auto-create bugs in Jira/Azure DevOps' },
      { name: 'Run Comparison', icon: <GitBranch className="h-4 w-4" />, description: 'Compare test runs over time' },
      { name: 'AI Analytics', icon: <Brain className="h-4 w-4" />, description: 'Usage tracking and cost optimization' },
    ]
  },
  {
    phase: 'Governance',
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-500/10 border-indigo-500/30',
    icon: <Shield className="h-5 w-5" />,
    features: [
      { name: 'Safety Controls', icon: <Lock className="h-4 w-4" />, description: 'Rate limiting, confidence thresholds' },
      { name: 'Audit Dashboard', icon: <Shield className="h-4 w-4" />, description: 'Track all AI-generated content' },
      { name: 'Proven Patterns', icon: <Search className="h-4 w-4" />, description: 'Reusable test patterns library' },
      { name: 'Role Management', icon: <Users className="h-4 w-4" />, description: 'RBAC with project-level permissions' },
    ]
  },
];

export const FeatureModuleDiagram: React.FC = () => {
  return (
    <div className="p-6">
      {/* Title */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-foreground">WISPR Feature Modules</h2>
        <p className="text-muted-foreground">Organized by Software Testing Lifecycle Phase</p>
      </div>

      {/* Feature Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {featureGroups.map((group) => (
          <div 
            key={group.phase}
            className={`rounded-xl border-2 p-4 ${group.bgColor} transition-all hover:shadow-lg`}
          >
            {/* Phase Header */}
            <div className="flex items-center gap-2 mb-4">
              <div className={`p-2 rounded-lg bg-white/80 dark:bg-black/20 ${group.color}`}>
                {group.icon}
              </div>
              <h3 className={`font-bold ${group.color}`}>{group.phase}</h3>
            </div>

            {/* Features */}
            <div className="space-y-2">
              {group.features.map((feature) => (
                <div 
                  key={feature.name}
                  className="group relative flex items-center gap-2 p-2 rounded-lg bg-white/50 dark:bg-black/20 hover:bg-white/80 dark:hover:bg-black/40 transition-colors cursor-pointer"
                >
                  <span className={group.color}>{feature.icon}</span>
                  <span className="text-sm font-medium">{feature.name}</span>
                  
                  {/* Tooltip */}
                  <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-3 py-2 bg-popover border rounded-lg shadow-lg text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20 max-w-[200px]">
                    {feature.description}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center p-4 rounded-lg bg-muted">
          <div className="text-3xl font-bold text-primary">6</div>
          <div className="text-sm text-muted-foreground">Lifecycle Phases</div>
        </div>
        <div className="text-center p-4 rounded-lg bg-muted">
          <div className="text-3xl font-bold text-primary">24+</div>
          <div className="text-sm text-muted-foreground">Features</div>
        </div>
        <div className="text-center p-4 rounded-lg bg-muted">
          <div className="text-3xl font-bold text-primary">5</div>
          <div className="text-sm text-muted-foreground">Integrations</div>
        </div>
        <div className="text-center p-4 rounded-lg bg-muted">
          <div className="text-3xl font-bold text-primary">100%</div>
          <div className="text-sm text-muted-foreground">AI-Powered</div>
        </div>
      </div>
    </div>
  );
};
