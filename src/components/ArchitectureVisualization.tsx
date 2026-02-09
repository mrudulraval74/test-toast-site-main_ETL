import React, { useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { 
  Download, 
  Maximize2, 
  Minimize2, 
  Layers, 
  GitBranch, 
  Database, 
  LayoutDashboard,
  FileImage,
  FileText,
  Loader2
} from 'lucide-react';
import { 
  SystemArchitectureDiagram,
  FeatureModuleDiagram,
  DataFlowDiagram,
  StorageArchitectureDiagram,
  ExecutiveSummaryView,
  exportToPng,
  exportToPdf,
  ViewMode,
  DiagramType,
  ExportOptions
} from './architecture';

export const ArchitectureVisualization: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('technical');
  const [currentDiagram, setCurrentDiagram] = useState<DiagramType>('system');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'png',
    scope: 'current',
    includeExecutive: true,
    includeTechnical: true,
    includeFeatureList: true,
  });

  const diagramRef = useRef<HTMLDivElement>(null);
  const fullExportRef = useRef<HTMLDivElement>(null);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      if (exportOptions.format === 'png') {
        const ref = exportOptions.scope === 'current' ? diagramRef : fullExportRef;
        await exportToPng(ref, `wispr-${currentDiagram}-architecture`);
      } else {
        exportToPdf('export-content');
      }
    } finally {
      setIsExporting(false);
      setShowExportDialog(false);
    }
  };

  const renderDiagram = () => {
    if (viewMode === 'executive') {
      return <ExecutiveSummaryView />;
    }

    switch (currentDiagram) {
      case 'system':
        return <SystemArchitectureDiagram />;
      case 'features':
        return <FeatureModuleDiagram />;
      case 'dataflow':
        return <DataFlowDiagram />;
      case 'storage':
        return <StorageArchitectureDiagram />;
      default:
        return <SystemArchitectureDiagram />;
    }
  };

  const diagramTabs = [
    { value: 'system', label: 'System', icon: <Layers className="h-4 w-4" /> },
    { value: 'features', label: 'Features', icon: <LayoutDashboard className="h-4 w-4" /> },
    { value: 'dataflow', label: 'Data Flow', icon: <GitBranch className="h-4 w-4" /> },
    { value: 'storage', label: 'Storage', icon: <Database className="h-4 w-4" /> },
  ];

  return (
    <div className={`space-y-4 ${isFullscreen ? 'fixed inset-0 z-50 bg-background p-6 overflow-auto' : ''}`}>
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              Architecture Visualization
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="View mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="technical">Technical View</SelectItem>
                  <SelectItem value="executive">Executive Summary</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsFullscreen(!isFullscreen)}
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
              <Button
                variant="default"
                onClick={() => setShowExportDialog(true)}
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {viewMode === 'technical' && (
            <Tabs value={currentDiagram} onValueChange={(v) => setCurrentDiagram(v as DiagramType)} className="mb-4">
              <TabsList className="grid w-full grid-cols-4">
                {diagramTabs.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value} className="flex items-center gap-2">
                    {tab.icon}
                    <span className="hidden sm:inline">{tab.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}

          <div 
            ref={diagramRef} 
            id="export-content"
            className="bg-background rounded-lg border min-h-[500px]"
          >
            {renderDiagram()}
          </div>
        </CardContent>
      </Card>

      {/* Hidden full export content */}
      <div ref={fullExportRef} className="hidden">
        <div className="p-8 bg-white" style={{ width: '1200px' }}>
          <h1 className="text-3xl font-bold mb-2">WISPR Architecture Documentation</h1>
          <p className="text-gray-600 mb-8">AI-Powered Test Automation Platform</p>
          
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-4">Executive Summary</h2>
            <ExecutiveSummaryView />
          </div>
          
          <div className="mb-8 page-break">
            <h2 className="text-xl font-bold mb-4">System Architecture</h2>
            <SystemArchitectureDiagram />
          </div>
          
          <div className="mb-8 page-break">
            <h2 className="text-xl font-bold mb-4">Feature Modules</h2>
            <FeatureModuleDiagram />
          </div>
          
          <div className="mb-8 page-break">
            <h2 className="text-xl font-bold mb-4">Data Flow</h2>
            <DataFlowDiagram />
          </div>
          
          <div className="mb-8 page-break">
            <h2 className="text-xl font-bold mb-4">Storage Architecture</h2>
            <StorageArchitectureDiagram />
          </div>

          <div className="mt-8 pt-8 border-t">
            <h2 className="text-xl font-bold mb-4">Feature Summary</h2>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-3 text-left">Category</th>
                  <th className="border p-3 text-left">Features</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border p-3 font-medium">AI Capabilities</td>
                  <td className="border p-3">Test Case Generation, Auto-Healing, Semantic Search, Defect Analysis</td>
                </tr>
                <tr>
                  <td className="border p-3 font-medium">Test Automation</td>
                  <td className="border p-3">No-Code Visual Builder, Selenium/Java/Python, API Testing, JMeter Performance</td>
                </tr>
                <tr>
                  <td className="border p-3 font-medium">Governance</td>
                  <td className="border p-3">Safety Controls, Rate Limiting, Audit Trails, Confidence Thresholds</td>
                </tr>
                <tr>
                  <td className="border p-3 font-medium">Execution</td>
                  <td className="border p-3">Self-Hosted Agents, Scheduled Triggers, Visual Regression, Real-time Results</td>
                </tr>
                <tr>
                  <td className="border p-3 font-medium">Integration</td>
                  <td className="border p-3">GitHub, Jira, Azure DevOps, CI/CD Pipelines</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Export Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export Architecture Diagrams</DialogTitle>
            <DialogDescription>
              Choose your export format and options
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Format Selection */}
            <div className="space-y-2">
              <Label>Format</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="format"
                    checked={exportOptions.format === 'png'}
                    onChange={() => setExportOptions({ ...exportOptions, format: 'png' })}
                    className="w-4 h-4"
                  />
                  <FileImage className="h-4 w-4" />
                  <span>PNG Image</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="format"
                    checked={exportOptions.format === 'pdf'}
                    onChange={() => setExportOptions({ ...exportOptions, format: 'pdf' })}
                    className="w-4 h-4"
                  />
                  <FileText className="h-4 w-4" />
                  <span>PDF Document</span>
                </label>
              </div>
            </div>

            {/* Scope Selection */}
            <div className="space-y-2">
              <Label>Scope</Label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="scope"
                    checked={exportOptions.scope === 'current'}
                    onChange={() => setExportOptions({ ...exportOptions, scope: 'current' })}
                    className="w-4 h-4"
                  />
                  <span>Current Diagram Only</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="scope"
                    checked={exportOptions.scope === 'full'}
                    onChange={() => setExportOptions({ ...exportOptions, scope: 'full' })}
                    className="w-4 h-4"
                  />
                  <span>Full Presentation (All Diagrams)</span>
                </label>
              </div>
            </div>

            {/* Include Options */}
            {exportOptions.scope === 'full' && (
              <div className="space-y-2">
                <Label>Include</Label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="includeExecutive"
                      checked={exportOptions.includeExecutive}
                      onCheckedChange={(checked) => 
                        setExportOptions({ ...exportOptions, includeExecutive: !!checked })
                      }
                    />
                    <label htmlFor="includeExecutive" className="cursor-pointer">
                      Executive Summary
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="includeTechnical"
                      checked={exportOptions.includeTechnical}
                      onCheckedChange={(checked) => 
                        setExportOptions({ ...exportOptions, includeTechnical: !!checked })
                      }
                    />
                    <label htmlFor="includeTechnical" className="cursor-pointer">
                      Technical Diagrams
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="includeFeatureList"
                      checked={exportOptions.includeFeatureList}
                      onCheckedChange={(checked) => 
                        setExportOptions({ ...exportOptions, includeFeatureList: !!checked })
                      }
                    />
                    <label htmlFor="includeFeatureList" className="cursor-pointer">
                      Feature Summary Table
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExportDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleExport} disabled={isExporting}>
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ArchitectureVisualization;
