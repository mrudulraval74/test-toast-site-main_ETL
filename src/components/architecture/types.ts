export interface DiagramNode {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  children?: DiagramNode[];
}

export interface DiagramConnection {
  from: string;
  to: string;
  label?: string;
  animated?: boolean;
  color?: string;
}

export interface DiagramData {
  nodes: DiagramNode[];
  connections: DiagramConnection[];
}

export type ViewMode = 'technical' | 'executive';
export type DiagramType = 'system' | 'features' | 'dataflow' | 'storage';

export interface ExportOptions {
  format: 'png' | 'pdf';
  scope: 'current' | 'all' | 'full';
  includeExecutive: boolean;
  includeTechnical: boolean;
  includeFeatureList: boolean;
}

export interface FeatureCategory {
  name: string;
  icon: React.ReactNode;
  color: string;
  features: string[];
}
