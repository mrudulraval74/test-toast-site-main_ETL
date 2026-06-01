import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, ClipboardList, FileText, Workflow } from "lucide-react";

interface LocalSDLCPageProps {
  title: string;
  phase: string;
  projectId: string;
  onViewChange?: (view: string) => void;
}

export const LocalSDLCPage = ({ title, phase, projectId, onViewChange }: LocalSDLCPageProps) => {
  const relatedViews = [
    { label: "User Stories", view: "user-stories" },
    { label: "Test Cases", view: "test-cases" },
    { label: "Integrations", view: "integrations" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{phase}</Badge>
            <Badge variant="outline">Local</Badge>
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Project workspace: {projectId}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-4 w-4" />
              Work Items
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Local workspace is ready for this SDLC area.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Workflow className="h-4 w-4" />
              Flow
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Use the linked project modules below to continue.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              Artifacts
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            No local artifacts have been added for this view.
          </CardContent>
        </Card>
      </div>

      {onViewChange && (
        <div className="flex flex-wrap gap-2">
          {relatedViews.map((item) => (
            <Button key={item.view} variant="outline" onClick={() => onViewChange(item.view)}>
              {item.label}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ))}
        </div>
      )}
    </div>
  );
};
