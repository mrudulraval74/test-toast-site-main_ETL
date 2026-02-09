import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Plus, 
  Trash2, 
  Edit, 
  Database, 
  ChevronDown, 
  ChevronRight,
  Upload,
  Download,
  Copy,
  FileSpreadsheet,
  Variable,
  Play,
  SkipForward
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";

export interface DataSet {
  id: string;
  name: string;
  variables: Record<string, string>;
  skip?: boolean;
}

interface DataDrivenTestEditorProps {
  datasets: DataSet[];
  onDatasetsChange: (datasets: DataSet[]) => void;
  extractedVariables?: string[];
  isCollapsible?: boolean;
}

export const DataDrivenTestEditor = ({
  datasets,
  onDatasetsChange,
  extractedVariables = [],
  isCollapsible = true
}: DataDrivenTestEditorProps) => {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(datasets.length > 0);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [editingDataset, setEditingDataset] = useState<DataSet | null>(null);
  
  // Form states
  const [datasetName, setDatasetName] = useState("");
  const [variableEntries, setVariableEntries] = useState<{ key: string; value: string }[]>([
    { key: "", value: "" }
  ]);
  const [csvContent, setCsvContent] = useState("");
  
  // Get all unique variable keys across all datasets
  const allVariableKeys = Array.from(
    new Set([
      ...extractedVariables,
      ...datasets.flatMap(ds => Object.keys(ds.variables))
    ])
  );
  
  const handleAddVariableEntry = () => {
    setVariableEntries([...variableEntries, { key: "", value: "" }]);
  };
  
  const handleRemoveVariableEntry = (index: number) => {
    setVariableEntries(variableEntries.filter((_, i) => i !== index));
  };
  
  const handleUpdateVariableEntry = (index: number, field: "key" | "value", value: string) => {
    const updated = [...variableEntries];
    updated[index] = { ...updated[index], [field]: value };
    setVariableEntries(updated);
  };
  
  const handleSaveDataset = () => {
    if (!datasetName.trim()) {
      toast({
        title: "Name Required",
        description: "Please provide a name for this dataset",
        variant: "destructive"
      });
      return;
    }
    
    const validEntries = variableEntries.filter(e => e.key.trim());
    if (validEntries.length === 0) {
      toast({
        title: "Variables Required",
        description: "Please add at least one variable with a name",
        variant: "destructive"
      });
      return;
    }
    
    const variables: Record<string, string> = {};
    validEntries.forEach(e => {
      variables[e.key.trim()] = e.value;
    });
    
    if (editingDataset) {
      // Update existing
      const updated = datasets.map(ds => 
        ds.id === editingDataset.id 
          ? { ...ds, name: datasetName, variables }
          : ds
      );
      onDatasetsChange(updated);
      toast({ title: "Dataset Updated" });
    } else {
      // Create new
      const newDataset: DataSet = {
        id: crypto.randomUUID(),
        name: datasetName,
        variables
      };
      onDatasetsChange([...datasets, newDataset]);
      toast({ title: "Dataset Added" });
    }
    
    resetForm();
    setShowAddDialog(false);
    setEditingDataset(null);
  };
  
  const handleEditDataset = (dataset: DataSet) => {
    setDatasetName(dataset.name);
    setVariableEntries(
      Object.entries(dataset.variables).map(([key, value]) => ({ key, value }))
    );
    setEditingDataset(dataset);
    setShowAddDialog(true);
  };
  
  const handleDeleteDataset = (id: string) => {
    onDatasetsChange(datasets.filter(ds => ds.id !== id));
    toast({ title: "Dataset Deleted" });
  };
  
  const handleToggleSkip = (id: string) => {
    const updated = datasets.map(ds => 
      ds.id === id ? { ...ds, skip: !ds.skip } : ds
    );
    onDatasetsChange(updated);
  };
  
  const handleDuplicateDataset = (dataset: DataSet) => {
    const duplicate: DataSet = {
      id: crypto.randomUUID(),
      name: `${dataset.name} (Copy)`,
      variables: { ...dataset.variables }
    };
    onDatasetsChange([...datasets, duplicate]);
    toast({ title: "Dataset Duplicated" });
  };
  
  const handleImportCSV = () => {
    if (!csvContent.trim()) {
      toast({
        title: "No Data",
        description: "Please paste CSV content to import",
        variant: "destructive"
      });
      return;
    }
    
    try {
      const lines = csvContent.trim().split("\n");
      if (lines.length < 2) {
        throw new Error("CSV must have a header row and at least one data row");
      }
      
      const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
      const newDatasets: DataSet[] = [];
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",").map(v => v.trim().replace(/^"|"$/g, ""));
        const variables: Record<string, string> = {};
        
        headers.forEach((header, idx) => {
          if (header && values[idx] !== undefined) {
            variables[header] = values[idx];
          }
        });
        
        if (Object.keys(variables).length > 0) {
          newDatasets.push({
            id: crypto.randomUUID(),
            name: `Dataset ${datasets.length + newDatasets.length + 1}`,
            variables
          });
        }
      }
      
      if (newDatasets.length === 0) {
        throw new Error("No valid data rows found");
      }
      
      onDatasetsChange([...datasets, ...newDatasets]);
      toast({
        title: "Import Successful",
        description: `Imported ${newDatasets.length} dataset(s)`
      });
      setCsvContent("");
      setShowImportDialog(false);
    } catch (error) {
      toast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : "Invalid CSV format",
        variant: "destructive"
      });
    }
  };
  
  const handleExportCSV = () => {
    if (datasets.length === 0) {
      toast({
        title: "No Data",
        description: "No datasets to export",
        variant: "destructive"
      });
      return;
    }
    
    const headers = allVariableKeys;
    const csvLines = [headers.join(",")];
    
    datasets.forEach(ds => {
      const values = headers.map(h => {
        const val = ds.variables[h] || "";
        return val.includes(",") ? `"${val}"` : val;
      });
      csvLines.push(values.join(","));
    });
    
    const csvBlob = new Blob([csvLines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(csvBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `test-datasets-${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast({ title: "Datasets Exported" });
  };
  
  const resetForm = () => {
    setDatasetName("");
    setVariableEntries([{ key: "", value: "" }]);
    setEditingDataset(null);
  };
  
  const handleOpenAdd = () => {
    resetForm();
    // Pre-populate with extracted variables
    if (extractedVariables.length > 0) {
      setVariableEntries(extractedVariables.map(v => ({ key: v, value: "" })));
    }
    setShowAddDialog(true);
  };
  
  const content = (
    <div className="space-y-4">
      {/* Header actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {datasets.length} dataset{datasets.length !== 1 ? "s" : ""}
          </Badge>
          {datasets.filter(ds => ds.skip).length > 0 && (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              {datasets.filter(ds => ds.skip).length} skipped
            </Badge>
          )}
          {allVariableKeys.length > 0 && (
            <Badge variant="outline" className="text-xs">
              {allVariableKeys.length} variable{allVariableKeys.length !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowImportDialog(true)}>
            <Upload className="h-4 w-4 mr-1" />
            Import CSV
          </Button>
          {datasets.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
          )}
          <Button size="sm" onClick={handleOpenAdd}>
            <Plus className="h-4 w-4 mr-1" />
            Add Dataset
          </Button>
        </div>
      </div>
      
      {/* Usage hint */}
      {datasets.length === 0 && (
        <div className="bg-muted/50 rounded-lg p-4 text-center">
          <Database className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            No datasets defined. Add datasets to run this test multiple times with different inputs.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Use <code className="bg-muted px-1 py-0.5 rounded">{"{{variableName}}"}</code> syntax in step values to reference dataset variables.
          </p>
        </div>
      )}
      
      {/* Datasets table */}
      {datasets.length > 0 && (
        <ScrollArea className="max-h-[300px]">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[50px]">Skip</TableHead>
                <TableHead className="w-[150px]">Dataset Name</TableHead>
                {allVariableKeys.map(key => (
                  <TableHead key={key} className="min-w-[100px]">
                    <div className="flex items-center gap-1">
                      <Variable className="h-3 w-3" />
                      {key}
                    </div>
                  </TableHead>
                ))}
                <TableHead className="w-[120px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {datasets.map(dataset => (
                <TableRow key={dataset.id} className={dataset.skip ? "opacity-50" : ""}>
                  <TableCell>
                    <Checkbox
                      checked={dataset.skip || false}
                      onCheckedChange={() => handleToggleSkip(dataset.id)}
                      title={dataset.skip ? "Include in test runs" : "Skip this dataset"}
                    />
                  </TableCell>
                  <TableCell className={`font-medium ${dataset.skip ? "line-through text-muted-foreground" : ""}`}>
                    {dataset.name}
                    {dataset.skip && (
                      <Badge variant="outline" className="ml-2 text-xs">
                        <SkipForward className="h-3 w-3 mr-1" />
                        Skipped
                      </Badge>
                    )}
                  </TableCell>
                  {allVariableKeys.map(key => (
                    <TableCell key={key} className="font-mono text-xs">
                      {dataset.variables[key] || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                  ))}
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditDataset(dataset)}
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDuplicateDataset(dataset)}
                        title="Duplicate"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteDataset(dataset.id)}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      )}
      
      {/* Add/Edit Dataset Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingDataset ? "Edit Dataset" : "Add Dataset"}
            </DialogTitle>
            <DialogDescription>
              Define variable values for this test iteration
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Dataset Name</Label>
              <Input
                placeholder="e.g., Valid User Login"
                value={datasetName}
                onChange={(e) => setDatasetName(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Variables</Label>
                <Button variant="ghost" size="sm" onClick={handleAddVariableEntry}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Variable
                </Button>
              </div>
              
              <ScrollArea className="max-h-[200px] pr-4">
                <div className="space-y-2">
                  {variableEntries.map((entry, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        placeholder="Variable name"
                        value={entry.key}
                        onChange={(e) => handleUpdateVariableEntry(index, "key", e.target.value)}
                        className="flex-1"
                      />
                      <Input
                        placeholder="Value"
                        value={entry.value}
                        onChange={(e) => handleUpdateVariableEntry(index, "value", e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveVariableEntry(index)}
                        disabled={variableEntries.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddDialog(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleSaveDataset}>
              {editingDataset ? "Save Changes" : "Add Dataset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Import CSV Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Import Datasets from CSV
            </DialogTitle>
            <DialogDescription>
              Paste CSV content with header row. Each row becomes a dataset.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-3 text-xs font-mono">
              <p className="font-semibold mb-1">Example format:</p>
              <p>username,password,expectedMessage</p>
              <p>admin,admin123,Welcome Admin</p>
              <p>user1,pass123,Hello User</p>
            </div>
            
            <Textarea
              placeholder="Paste CSV content here..."
              value={csvContent}
              onChange={(e) => setCsvContent(e.target.value)}
              className="min-h-[150px] font-mono text-sm"
            />
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowImportDialog(false); setCsvContent(""); }}>
              Cancel
            </Button>
            <Button onClick={handleImportCSV}>
              <Upload className="h-4 w-4 mr-1" />
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
  
  if (!isCollapsible) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4" />
            Test Datasets
          </CardTitle>
          <CardDescription>
            Define multiple datasets to run this test with different inputs
          </CardDescription>
        </CardHeader>
        <CardContent>{content}</CardContent>
      </Card>
    );
  }
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <Database className="h-4 w-4" />
                <CardTitle className="text-base">Data-Driven Testing</CardTitle>
                {datasets.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {datasets.length} dataset{datasets.length !== 1 ? "s" : ""}
                  </Badge>
                )}
              </div>
            </div>
            <CardDescription className="ml-6">
              Run test with multiple data inputs for comprehensive coverage
            </CardDescription>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">{content}</CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

// Utility to extract variable placeholders from test steps
export const extractVariablesFromSteps = (steps: any[]): string[] => {
  const variableRegex = /\{\{(\w+)\}\}/g;
  const variables = new Set<string>();
  
  steps.forEach(step => {
    const searchIn = [step.value, step.selector, step.description];
    searchIn.forEach(text => {
      if (typeof text === "string") {
        let match;
        while ((match = variableRegex.exec(text)) !== null) {
          variables.add(match[1]);
        }
      }
    });
    
    // Also check extraData
    if (step.extraData) {
      Object.values(step.extraData).forEach(val => {
        if (typeof val === "string") {
          let match;
          while ((match = variableRegex.exec(val)) !== null) {
            variables.add(match[1]);
          }
        }
      });
    }
  });
  
  return Array.from(variables);
};
