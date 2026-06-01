import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Rocket, Terminal, History, BarChart3 } from "lucide-react";
import { InstructionConsole } from "./InstructionConsole";
import { InstructionHistory } from "./InstructionHistory";
import { InstructionDashboard } from "./InstructionDashboard";

interface TestPilotProps {
  projectId: string;
}

export const TestPilot = ({ projectId }: TestPilotProps) => {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Rocket className="h-5 w-5 text-primary" />
          <CardTitle>Test Pilot</CardTitle>
        </div>
        <CardDescription>
          Intent-driven agent orchestration — instruct AI agents in natural language to generate, automate, heal, and report.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="console" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="console" className="flex items-center gap-2">
              <Terminal className="h-4 w-4" />
              Console
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              History
            </TabsTrigger>
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
          </TabsList>

          <TabsContent value="console" className="mt-0">
            <InstructionConsole
              projectId={projectId}
              onInstructionCreated={() => setRefreshKey(k => k + 1)}
            />
          </TabsContent>

          <TabsContent value="history" className="mt-0">
            <InstructionHistory projectId={projectId} refreshKey={refreshKey} />
          </TabsContent>

          <TabsContent value="dashboard" className="mt-0">
            <InstructionDashboard projectId={projectId} refreshKey={refreshKey} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
