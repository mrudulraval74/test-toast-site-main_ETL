import React from 'react';
import { 
  Brain, Zap, Shield, TrendingUp, Clock, Users, 
  CheckCircle, Target, Layers, Globe 
} from 'lucide-react';

interface ValueCardProps {
  icon: React.ReactNode;
  title: string;
  value: string;
  description: string;
  color: string;
}

const ValueCard: React.FC<ValueCardProps> = ({ icon, title, value, description, color }) => (
  <div className={`p-6 rounded-xl border-2 ${color} transition-all hover:shadow-lg`}>
    <div className="flex items-start justify-between mb-4">
      <div className={`p-3 rounded-xl bg-white/80 dark:bg-black/20`}>
        {icon}
      </div>
      <span className="text-3xl font-bold">{value}</span>
    </div>
    <h4 className="font-bold text-lg mb-1">{title}</h4>
    <p className="text-sm text-muted-foreground">{description}</p>
  </div>
);

interface CapabilityProps {
  icon: React.ReactNode;
  title: string;
  points: string[];
}

const Capability: React.FC<CapabilityProps> = ({ icon, title, points }) => (
  <div className="p-4 rounded-lg border bg-card hover:shadow-md transition-all">
    <div className="flex items-center gap-3 mb-3">
      <div className="p-2 rounded-lg bg-primary/10">
        {icon}
      </div>
      <h4 className="font-bold">{title}</h4>
    </div>
    <ul className="space-y-2">
      {points.map((point, idx) => (
        <li key={idx} className="flex items-start gap-2 text-sm">
          <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
          <span>{point}</span>
        </li>
      ))}
    </ul>
  </div>
);

export const ExecutiveSummaryView: React.FC = () => {
  return (
    <div className="p-6">
      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-foreground mb-2">WISPR</h1>
        <p className="text-xl text-muted-foreground">AI-Powered Test Automation Platform</p>
        <p className="mt-4 max-w-2xl mx-auto text-muted-foreground">
          Accelerate software quality with intelligent test generation, self-healing automation, 
          and enterprise-grade governance for AI-driven testing.
        </p>
      </div>

      {/* Value Proposition */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <ValueCard
          icon={<Clock className="h-6 w-6 text-blue-500" />}
          title="Time Savings"
          value="70%"
          description="Reduction in test creation time through AI-powered generation"
          color="border-blue-500/30 bg-blue-500/5"
        />
        <ValueCard
          icon={<Target className="h-6 w-6 text-green-500" />}
          title="Test Coverage"
          value="3x"
          description="Increase in test coverage with comprehensive AI analysis"
          color="border-green-500/30 bg-green-500/5"
        />
        <ValueCard
          icon={<Zap className="h-6 w-6 text-amber-500" />}
          title="Maintenance"
          value="60%"
          description="Reduction in test maintenance with auto-healing selectors"
          color="border-amber-500/30 bg-amber-500/5"
        />
        <ValueCard
          icon={<TrendingUp className="h-6 w-6 text-purple-500" />}
          title="ROI"
          value="5x"
          description="Return on investment within first year of deployment"
          color="border-purple-500/30 bg-purple-500/5"
        />
      </div>

      {/* Core Capabilities */}
      <h3 className="text-xl font-bold mb-4">Core Capabilities</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        <Capability
          icon={<Brain className="h-5 w-5 text-primary" />}
          title="AI Test Generation"
          points={[
            'Generate test cases from user stories',
            'API tests from Swagger/OpenAPI specs',
            'Intelligent coverage optimization',
            'Multi-language automation code'
          ]}
        />
        <Capability
          icon={<Zap className="h-5 w-5 text-primary" />}
          title="No-Code Automation"
          points={[
            'Visual test builder interface',
            'Drag-and-drop step creation',
            'Built-in assertions library',
            'Visual regression testing'
          ]}
        />
        <Capability
          icon={<Shield className="h-5 w-5 text-primary" />}
          title="Enterprise Governance"
          points={[
            'Human-in-the-loop approval',
            'Audit trails for all AI content',
            'Role-based access control',
            'Confidence threshold controls'
          ]}
        />
        <Capability
          icon={<Layers className="h-5 w-5 text-primary" />}
          title="Self-Hosted Execution"
          points={[
            'Docker-based test agents',
            'Run on your infrastructure',
            'Scheduled & triggered runs',
            'Parallel execution support'
          ]}
        />
        <Capability
          icon={<Globe className="h-5 w-5 text-primary" />}
          title="Seamless Integrations"
          points={[
            'Jira & Azure DevOps sync',
            'GitHub repository connection',
            'CI/CD pipeline triggers',
            'Webhook-based automation'
          ]}
        />
        <Capability
          icon={<Users className="h-5 w-5 text-primary" />}
          title="Collaborative Testing"
          points={[
            'Project-based organization',
            'Team member invitations',
            'Shared test libraries',
            'Knowledge base learning'
          ]}
        />
      </div>

      {/* Footer CTA */}
      <div className="text-center p-8 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 border">
        <h3 className="text-xl font-bold mb-2">Ready to Transform Your Testing?</h3>
        <p className="text-muted-foreground mb-4">
          Join enterprises using WISPR to accelerate quality and reduce testing costs.
        </p>
        <div className="flex justify-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/80 dark:bg-black/20 border">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-sm">Enterprise Ready</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/80 dark:bg-black/20 border">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-sm">SOC 2 Compliant</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/80 dark:bg-black/20 border">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-sm">24/7 Support</span>
          </div>
        </div>
      </div>
    </div>
  );
};
