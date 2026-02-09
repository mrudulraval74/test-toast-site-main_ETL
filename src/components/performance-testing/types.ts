// Performance Testing Types

export type BrowserType = 'chrome' | 'edge' | 'firefox';

export type CertificateStatus = 'not_generated' | 'generated' | 'expired';

export interface CertificateMetadata {
  status: CertificateStatus;
  generatedAt: number | null;
  expiresAt: number | null;
  serialNumber: string | null;
  commonName: string;
}

export interface SetupConfig {
  browser: BrowserType;
  proxyHost: string;
  proxyPort: number;
  certificateImported: boolean;
  enableRecording: boolean;
  certificate: CertificateMetadata;
}

export interface RecordedStep {
  id: string;
  stepNo: number;
  requestName: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  headers: Record<string, string>;
  queryParams: Record<string, string>;
  body: string;
  thinkTime: number;
  timestamp: number;
}

export interface TestPlanConfig {
  name: string;
  virtualUsers: number;
  rampUpTime: number;
  loopCount: number;
  duration: number;
  thinkTime: number;
  enableThinkTime: boolean;
}

export interface ParameterizationConfig {
  enabled: boolean;
  csvData: string;
  variables: Array<{
    name: string;
    column: string;
  }>;
}

export interface CorrelationConfig {
  enabled: boolean;
  rules: Array<{
    id: string;
    name: string;
    extractFrom: 'response_body' | 'response_header' | 'response_code';
    regex: string;
    variableName: string;
  }>;
}

export interface ExecutionMetrics {
  requestName: string;
  timestamp: number;
  responseTime: number;
  statusCode: number;
  success: boolean;
  bytes: number;
  errorMessage?: string;
}

export interface ExecutionSummary {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  throughput: number;
  errorRate: number;
  startTime: number;
  endTime: number;
}

export interface ExecutionProgress {
  status: 'idle' | 'running' | 'completed' | 'stopped';
  currentIteration: number;
  totalIterations: number;
  activeUsers: number;
  elapsedTime: number;
  metrics: ExecutionMetrics[];
  summary: ExecutionSummary | null;
}

export interface TestTemplate {
  id: string;
  name: string;
  description: string;
  steps: RecordedStep[];
  config: TestPlanConfig;
  parameterization: ParameterizationConfig;
  correlation: CorrelationConfig;
  createdAt: number;
  updatedAt: number;
}
