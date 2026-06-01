export interface Instruction {
  id: string;
  project_id: string;
  instruction_text: string;
  parsed_intent: ParsedIntent | null;
  intent_type: string | null;
  target_agents: string[];
  scope: Record<string, any>;
  constraints: Record<string, any>;
  risk_level: 'low' | 'medium' | 'high';
  confidence: number | null;
  approval_required: boolean;
  approved_by: string | null;
  approved_at: string | null;
  status: InstructionStatus;
  error_message: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type InstructionStatus =
  | 'created'
  | 'validated'
  | 'pending_approval'
  | 'approved'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'partially_completed'
  | 'cancelled';

export interface ParsedIntent {
  intent: string;
  target_agents: string[];
  scope: Record<string, any>;
  constraints: Record<string, any>;
  confidence: number;
  approval_required: boolean;
  risk_level: 'low' | 'medium' | 'high';
  summary: string;
}

export interface InstructionAgent {
  id: string;
  instruction_id: string;
  agent_type: string;
  execution_order: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  payload: Record<string, any>;
  result_summary: Record<string, any> | null;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
}

export interface InstructionAudit {
  id: string;
  instruction_id: string;
  action: string;
  actor_id: string | null;
  details: Record<string, any>;
  created_at: string;
}

export const AGENT_TYPES = [
  { id: 'analyst', label: 'Analyst Agent', description: 'Generates test cases and user stories' },
  { id: 'automation', label: 'Automation Agent', description: 'Creates and runs automation scripts' },
  { id: 'healer', label: 'Healer Agent', description: 'Fixes and heals broken test scripts' },
  { id: 'performance', label: 'Performance Agent', description: 'Runs performance and load tests' },
  { id: 'security', label: 'Security Agent', description: 'Performs security scans and audits' },
  { id: 'reporting', label: 'Reporting Agent', description: 'Generates reports and summaries' },
] as const;

export const INTENT_TYPES: Record<string, { label: string; color: string }> = {
  TEST_GENERATION: { label: 'Test Generation', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  AUTOMATE_ONLY: { label: 'Automate Only', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
  FIX_FAILURES: { label: 'Fix Failures', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
  RUN_NFR: { label: 'Run NFR', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  SECURITY_AUDIT: { label: 'Security Audit', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
  RELEASE_SUMMARY: { label: 'Release Summary', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
  DATA_VALIDATION: { label: 'Data Validation', color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200' },
  COMPOUND: { label: 'Compound', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200' },
  CUSTOM: { label: 'Custom', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200' },
};

export const STATUS_CONFIG: Record<InstructionStatus, { label: string; color: string; icon: string }> = {
  created: { label: 'Created', color: 'bg-muted text-muted-foreground', icon: 'circle' },
  validated: { label: 'Validated', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', icon: 'check-circle' },
  pending_approval: { label: 'Pending Approval', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200', icon: 'clock' },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', icon: 'check' },
  in_progress: { label: 'In Progress', color: 'bg-primary/10 text-primary', icon: 'loader' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', icon: 'check-circle-2' },
  failed: { label: 'Failed', color: 'bg-destructive/10 text-destructive', icon: 'x-circle' },
  partially_completed: { label: 'Partial', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200', icon: 'alert-circle' },
  cancelled: { label: 'Cancelled', color: 'bg-muted text-muted-foreground', icon: 'ban' },
};
