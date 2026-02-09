import React from 'react';
import { Monitor, Server, Database, Cloud, Bot, Globe, Shield, Cpu } from 'lucide-react';

interface LayerBoxProps {
  title: string;
  color: string;
  children: React.ReactNode;
}

const LayerBox: React.FC<LayerBoxProps> = ({ title, color, children }) => (
  <div className={`rounded-xl border-2 ${color} p-4 mb-4`}>
    <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">{title}</h3>
    <div className="flex flex-wrap gap-3 justify-center">
      {children}
    </div>
  </div>
);

interface ComponentCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  highlight?: boolean;
}

const ComponentCard: React.FC<ComponentCardProps> = ({ icon, title, description, highlight }) => (
  <div 
    className={`group relative p-4 rounded-lg border transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-pointer min-w-[140px] ${
      highlight 
        ? 'bg-primary/10 border-primary/30 hover:border-primary' 
        : 'bg-card border-border hover:border-primary/50'
    }`}
  >
    <div className="flex flex-col items-center text-center gap-2">
      <div className={`p-2 rounded-lg ${highlight ? 'bg-primary/20' : 'bg-muted'}`}>
        {icon}
      </div>
      <span className="font-medium text-sm">{title}</span>
    </div>
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-popover border rounded-lg shadow-lg text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
      {description}
    </div>
  </div>
);

const ConnectionArrow: React.FC<{ label?: string }> = ({ label }) => (
  <div className="flex flex-col items-center py-2">
    <svg width="40" height="40" viewBox="0 0 40 40" className="text-muted-foreground">
      <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="currentColor" />
        </marker>
      </defs>
      <line x1="20" y1="5" x2="20" y2="35" stroke="currentColor" strokeWidth="2" markerEnd="url(#arrowhead)" />
    </svg>
    {label && <span className="text-xs text-muted-foreground mt-1">{label}</span>}
  </div>
);

export const SystemArchitectureDiagram: React.FC = () => {
  return (
    <div className="p-6 space-y-2">
      {/* Title */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-foreground">WISPR System Architecture</h2>
        <p className="text-muted-foreground">Three-Tier Architecture with Self-Hosted Agent Support</p>
      </div>

      {/* Client Layer */}
      <LayerBox title="Client Layer" color="border-blue-500/30 bg-blue-500/5">
        <ComponentCard 
          icon={<Monitor className="h-5 w-5 text-blue-500" />}
          title="React Dashboard"
          description="Single-page application for test management and reporting"
          highlight
        />
        <ComponentCard 
          icon={<Bot className="h-5 w-5 text-green-500" />}
          title="Self-Hosted Agent"
          description="Node.js agent running Playwright in Docker containers"
        />
        <ComponentCard 
          icon={<Globe className="h-5 w-5 text-purple-500" />}
          title="Browser Extension"
          description="Optional Chrome extension for test recording"
        />
      </LayerBox>

      <ConnectionArrow label="HTTPS / WebSocket" />

      {/* Backend Services Layer */}
      <LayerBox title="Backend Services" color="border-emerald-500/30 bg-emerald-500/5">
        <div className="w-full">
          <div className="flex flex-wrap gap-3 justify-center mb-4">
            <ComponentCard 
              icon={<Server className="h-5 w-5 text-emerald-500" />}
              title="Supabase"
              description="Auth, Realtime, and PostgreSQL database"
              highlight
            />
            <ComponentCard 
              icon={<Cpu className="h-5 w-5 text-emerald-600" />}
              title="Edge Functions"
              description="Deno-based serverless functions for AI and automation"
            />
          </div>
          <div className="border border-dashed border-emerald-300 rounded-lg p-3 bg-emerald-500/5">
            <p className="text-xs text-muted-foreground text-center mb-2">Edge Function Services</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {['AI Generation', 'Test Execution', 'Auto-Healing', 'Analytics', 'Integrations'].map(svc => (
                <span key={svc} className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded text-xs">
                  {svc}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="w-full flex flex-wrap gap-3 justify-center mt-4">
          <ComponentCard 
            icon={<Cloud className="h-5 w-5 text-indigo-500" />}
            title="Azure OpenAI"
            description="GPT-4 for test generation and semantic analysis"
          />
          <ComponentCard 
            icon={<Shield className="h-5 w-5 text-orange-500" />}
            title="External APIs"
            description="Jira, Azure DevOps, GitHub integrations"
          />
        </div>
      </LayerBox>

      <ConnectionArrow label="SQL / Storage API" />

      {/* Data Layer */}
      <LayerBox title="Data Layer" color="border-amber-500/30 bg-amber-500/5">
        <ComponentCard 
          icon={<Database className="h-5 w-5 text-amber-500" />}
          title="PostgreSQL"
          description="Projects, test cases, executions, embeddings with RLS"
          highlight
        />
        <ComponentCard 
          icon={<Database className="h-5 w-5 text-amber-600" />}
          title="Supabase Storage"
          description="Screenshots, visual baselines, attachments"
        />
      </LayerBox>

      {/* Legend */}
      <div className="flex justify-center gap-6 pt-4 border-t">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="w-3 h-3 rounded bg-primary/20 border border-primary/30" />
          <span>Core Component</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="w-3 h-3 rounded bg-card border border-border" />
          <span>Supporting Service</span>
        </div>
      </div>
    </div>
  );
};
