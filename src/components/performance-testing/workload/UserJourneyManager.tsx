import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Edit2, Route, AlertCircle, CheckCircle2 } from "lucide-react";
import { UserJourney, RecordedStep } from "../types";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface UserJourneyManagerProps {
  journeys: UserJourney[];
  onChange: (journeys: UserJourney[]) => void;
  recordedSteps: RecordedStep[];
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export const UserJourneyManager = ({ journeys, onChange, recordedSteps }: UserJourneyManagerProps) => {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingJourney, setEditingJourney] = useState<UserJourney | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    trafficPercentage: 25,
    avgResponseTime: 500,
    thinkTime: 2000,
  });

  const totalPercentage = journeys.reduce((sum, j) => sum + j.trafficPercentage, 0);
  const isValid = Math.abs(totalPercentage - 100) < 0.1;

  const handleAdd = () => {
    setEditingJourney(null);
    setEditForm({
      name: `Journey ${journeys.length + 1}`,
      trafficPercentage: Math.max(0, 100 - totalPercentage),
      avgResponseTime: 500,
      thinkTime: 2000,
    });
    setEditDialogOpen(true);
  };

  const handleEdit = (journey: UserJourney) => {
    setEditingJourney(journey);
    setEditForm({
      name: journey.name,
      trafficPercentage: journey.trafficPercentage,
      avgResponseTime: journey.avgResponseTime,
      thinkTime: journey.thinkTime,
    });
    setEditDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    onChange(journeys.filter((j) => j.id !== id));
  };

  const handleSave = () => {
    if (editingJourney) {
      onChange(
        journeys.map((j) =>
          j.id === editingJourney.id
            ? { ...j, ...editForm }
            : j
        )
      );
    } else {
      const newJourney: UserJourney = {
        id: crypto.randomUUID(),
        ...editForm,
        steps: [],
      };
      onChange([...journeys, newJourney]);
    }
    setEditDialogOpen(false);
  };

  const chartData = journeys.map((j) => ({
    name: j.name,
    value: j.trafficPercentage,
  }));

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Route className="h-5 w-5" />
                User Journeys
              </CardTitle>
              <CardDescription>
                Define traffic distribution across different user flows
              </CardDescription>
            </div>
            <Button onClick={handleAdd} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add Journey
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Traffic Distribution Status */}
          <div className="flex items-center gap-2">
            {isValid ? (
              <Badge variant="outline" className="gap-1 border-green-500 text-green-600">
                <CheckCircle2 className="h-3 w-3" />
                Traffic: 100%
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 border-destructive text-destructive">
                <AlertCircle className="h-3 w-3" />
                Traffic: {totalPercentage.toFixed(1)}% (must equal 100%)
              </Badge>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Journeys Table */}
            <div>
              {journeys.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border rounded-lg">
                  <Route className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>No journeys defined yet</p>
                  <p className="text-sm">Add user journeys to model traffic distribution</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Journey</TableHead>
                      <TableHead className="text-right">Traffic %</TableHead>
                      <TableHead className="text-right">Avg RT</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {journeys.map((journey, index) => (
                      <TableRow key={journey.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: COLORS[index % COLORS.length] }}
                            />
                            <span className="font-medium">{journey.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{journey.trafficPercentage}%</TableCell>
                        <TableCell className="text-right">{journey.avgResponseTime}ms</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleEdit(journey)}
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              onClick={() => handleDelete(journey.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            {/* Traffic Distribution Chart */}
            {journeys.length > 0 && (
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {chartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => `${value}%`}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingJourney ? 'Edit' : 'Add'} User Journey</DialogTitle>
            <DialogDescription>
              Define the journey name, traffic percentage, and performance expectations
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="journey-name">Journey Name</Label>
              <Input
                id="journey-name"
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g., Login Flow, Search, Checkout"
              />
            </div>

            <div className="space-y-3">
              <Label>Traffic Percentage: {editForm.trafficPercentage}%</Label>
              <Slider
                value={[editForm.trafficPercentage]}
                onValueChange={([value]) => setEditForm((f) => ({ ...f, trafficPercentage: value }))}
                min={1}
                max={100}
                step={1}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="avgRt">Avg Response Time (ms)</Label>
                <Input
                  id="avgRt"
                  type="number"
                  value={editForm.avgResponseTime}
                  onChange={(e) => setEditForm((f) => ({ ...f, avgResponseTime: parseInt(e.target.value) || 100 }))}
                  min={1}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="thinkTime">Think Time (ms)</Label>
                <Input
                  id="thinkTime"
                  type="number"
                  value={editForm.thinkTime}
                  onChange={(e) => setEditForm((f) => ({ ...f, thinkTime: parseInt(e.target.value) || 0 }))}
                  min={0}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!editForm.name.trim()}>
              {editingJourney ? 'Update' : 'Add'} Journey
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
