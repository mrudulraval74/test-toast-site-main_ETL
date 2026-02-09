import React from 'react';
import { ArrowRight, ArrowDown, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';

interface FlowStepProps {
  number: number;
  title: string;
  description: string;
  color: string;
  items: string[];
  isActive?: boolean;
}

const FlowStep: React.FC<FlowStepProps> = ({ number, title, description, color, items, isActive }) => (
  <div className={`relative p-4 rounded-xl border-2 ${color} transition-all ${isActive ? 'shadow-lg scale-105' : ''}`}>
    <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
      {number}
    </div>
    <h4 className="font-bold text-lg mb-1 mt-2">{title}</h4>
    <p className="text-sm text-muted-foreground mb-3">{description}</p>
    <div className="space-y-1">
      {items.map((item, idx) => (
        <div key={idx} className="flex items-center gap-2 text-sm">
          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
          {item}
        </div>
      ))}
    </div>
  </div>
);

const AnimatedArrow: React.FC<{ direction: 'right' | 'down' }> = ({ direction }) => (
  <div className={`flex ${direction === 'down' ? 'flex-col' : ''} items-center justify-center ${direction === 'down' ? 'py-2' : 'px-2'}`}>
    {direction === 'right' ? (
      <div className="relative">
        <ArrowRight className="h-6 w-6 text-primary animate-pulse" />
        <div className="absolute inset-0 flex items-center">
          <div className="h-0.5 w-6 bg-gradient-to-r from-primary/0 via-primary to-primary/0 animate-flow-right" />
        </div>
      </div>
    ) : (
      <div className="relative">
        <ArrowDown className="h-6 w-6 text-primary animate-pulse" />
        <div className="absolute inset-0 flex justify-center">
          <div className="w-0.5 h-6 bg-gradient-to-b from-primary/0 via-primary to-primary/0 animate-flow-down" />
        </div>
      </div>
    )}
  </div>
);

export const DataFlowDiagram: React.FC = () => {
  return (
    <div className="p-6">
      {/* Title */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-foreground">WISPR Data Flow</h2>
        <p className="text-muted-foreground">End-to-End Testing Workflow with AI Integration</p>
      </div>

      {/* Flow Diagram */}
      <div className="space-y-4">
        {/* Row 1: Requirements to AI Generation */}
        <div className="flex flex-col lg:flex-row items-stretch gap-4">
          <div className="flex-1">
            <FlowStep
              number={1}
              title="Requirements Input"
              description="Import from external sources"
              color="border-blue-500/30 bg-blue-500/5"
              items={['User Stories from Jira/Azure', 'Acceptance Criteria', 'Swagger/OpenAPI specs', 'Manual entry']}
            />
          </div>
          <AnimatedArrow direction="right" />
          <div className="flex-1">
            <FlowStep
              number={2}
              title="AI Processing"
              description="Azure OpenAI GPT-4 analysis"
              color="border-purple-500/30 bg-purple-500/5"
              items={['Semantic understanding', 'Test case generation', 'Coverage optimization', 'Pattern matching']}
            />
          </div>
          <AnimatedArrow direction="right" />
          <div className="flex-1">
            <FlowStep
              number={3}
              title="Human Review"
              description="Quality gate with approval workflow"
              color="border-amber-500/30 bg-amber-500/5"
              items={['Confidence scoring', 'Edit suggestions', 'Approve/Reject actions', 'Feedback loop']}
            />
          </div>
        </div>

        {/* Connector */}
        <div className="flex justify-end pr-[16.67%]">
          <AnimatedArrow direction="down" />
        </div>

        {/* Row 2: Execution Path */}
        <div className="flex flex-col lg:flex-row items-stretch gap-4">
          <div className="flex-1">
            <FlowStep
              number={6}
              title="Reporting & Learning"
              description="Insights and continuous improvement"
              color="border-rose-500/30 bg-rose-500/5"
              items={['AI-generated summaries', 'Defect auto-creation', 'Pattern extraction', 'Knowledge base update']}
            />
          </div>
          <AnimatedArrow direction="right" />
          <div className="flex-1">
            <FlowStep
              number={5}
              title="Results Processing"
              description="Outcome analysis and storage"
              color="border-emerald-500/30 bg-emerald-500/5"
              items={['Screenshot capture', 'Visual diff analysis', 'Pass/Fail determination', 'Auto-healing attempts']}
            />
          </div>
          <AnimatedArrow direction="right" />
          <div className="flex-1">
            <FlowStep
              number={4}
              title="Test Execution"
              description="Automated test running"
              color="border-indigo-500/30 bg-indigo-500/5"
              items={['Self-hosted agents', 'Playwright/Selenium', 'API test runners', 'Scheduled triggers']}
            />
          </div>
        </div>

        {/* Feedback Loop */}
        <div className="flex items-center justify-center gap-4 pt-4 border-t border-dashed">
          <RefreshCw className="h-5 w-5 text-primary animate-spin-slow" />
          <span className="text-sm text-muted-foreground">
            Continuous Learning: Approved patterns feed back into AI training
          </span>
        </div>
      </div>

      {/* Outcome Indicators */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/30">
          <CheckCircle2 className="h-8 w-8 text-green-500" />
          <div>
            <div className="font-bold">Pass</div>
            <div className="text-sm text-muted-foreground">Test completed successfully</div>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/30">
          <XCircle className="h-8 w-8 text-red-500" />
          <div>
            <div className="font-bold">Fail</div>
            <div className="text-sm text-muted-foreground">Defect auto-logged to tracker</div>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
          <RefreshCw className="h-8 w-8 text-amber-500" />
          <div>
            <div className="font-bold">Auto-Healed</div>
            <div className="text-sm text-muted-foreground">AI recovered broken selector</div>
          </div>
        </div>
      </div>

      {/* CSS for animations */}
      <style>{`
        @keyframes flow-right {
          0% { transform: translateX(-100%); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: translateX(100%); opacity: 0; }
        }
        @keyframes flow-down {
          0% { transform: translateY(-100%); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: translateY(100%); opacity: 0; }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-flow-right { animation: flow-right 2s ease-in-out infinite; }
        .animate-flow-down { animation: flow-down 2s ease-in-out infinite; }
        .animate-spin-slow { animation: spin-slow 4s linear infinite; }
      `}</style>
    </div>
  );
};
