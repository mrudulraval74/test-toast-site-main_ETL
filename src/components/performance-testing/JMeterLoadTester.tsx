import { useState, useCallback, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Circle, Settings2, Play, BarChart3, Wrench, Download, CheckCircle2, XCircle, Clock } from "lucide-react";
import { RecordingTab } from "./RecordingTab";
import { ConfigurationTab } from "./ConfigurationTab";
import { ExecutionTab } from "./ExecutionTab";
import { ResultsTab } from "./ResultsTab";
import {
  RecordedStep,
  TestPlanConfig,
  ParameterizationConfig,
  CorrelationConfig,
  ExecutionProgress,
  SetupConfig,
  BrowserType,
  CertificateMetadata,
} from "./types";
import { toast } from "sonner";

interface JMeterLoadTesterProps {
  projectId: string;
}

const CERT_VALIDITY_HOURS = 24; // Certificate valid for 24 hours
const CERT_COMMON_NAME = "TemporaryRootCA";

// Simplified certificate generation - returns a placeholder for demo purposes
// In production, this would use a proper certificate library or backend service
const generateCertificate = (): { pem: string; metadata: CertificateMetadata } => {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CERT_VALIDITY_HOURS * 60 * 60 * 1000);
  const serialNumber = Date.now().toString(16);

  // Placeholder PEM - in production, generate via backend or use Web Crypto API
  const pem = `-----BEGIN CERTIFICATE-----
Demo Certificate for Performance Testing
Serial: ${serialNumber}
CN: ${CERT_COMMON_NAME}
Valid: ${now.toISOString()} to ${expiresAt.toISOString()}
-----END CERTIFICATE-----`;

  return {
    pem,
    metadata: {
      status: "generated",
      generatedAt: now.getTime(),
      expiresAt: expiresAt.getTime(),
      serialNumber: serialNumber,
      commonName: CERT_COMMON_NAME,
    },
  };
};

const downloadCertificate = (pem: string) => {
  const blob = new Blob([pem], { type: "application/x-pem-file" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${CERT_COMMON_NAME}.usr`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const getInitialCertificateMetadata = (): CertificateMetadata => ({
  status: "not_generated",
  generatedAt: null,
  expiresAt: null,
  serialNumber: null,
  commonName: CERT_COMMON_NAME,
});

export const JMeterLoadTester = ({ projectId }: JMeterLoadTesterProps) => {
  const [activeTab, setActiveTab] = useState("setup");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingMode, setRecordingMode] = useState<"proxy" | "browser" | "extension">("browser");
  const [certificatePem, setCertificatePem] = useState<string | null>(null);

  // Setup state - persisted and used during recording
  const [setupConfig, setSetupConfig] = useState<SetupConfig>({
    browser: "chrome",
    proxyHost: "localhost",
    proxyPort: 8888,
    certificateImported: false,
    enableRecording: false,
    certificate: getInitialCertificateMetadata(),
  });

  // Check certificate expiration on mount and periodically
  useEffect(() => {
    const checkExpiration = () => {
      if (setupConfig.certificate.status === "generated" && setupConfig.certificate.expiresAt) {
        if (Date.now() > setupConfig.certificate.expiresAt) {
          setSetupConfig((prev) => ({
            ...prev,
            certificateImported: false,
            certificate: {
              ...prev.certificate,
              status: "expired",
            },
          }));
          setCertificatePem(null);
        }
      }
    };

    checkExpiration();
    const interval = setInterval(checkExpiration, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [setupConfig.certificate.expiresAt, setupConfig.certificate.status]);

  // Recording state
  const [steps, setSteps] = useState<RecordedStep[]>([]);

  // Configuration state
  const [config, setConfig] = useState<TestPlanConfig>({
    name: "Performance Test Plan",
    virtualUsers: 10,
    rampUpTime: 60,
    loopCount: 1,
    duration: 0,
    thinkTime: 1000,
    enableThinkTime: false,
  });
  const [parameterization, setParameterization] = useState<ParameterizationConfig>({
    enabled: false,
    csvData: "",
    variables: [],
  });
  const [correlation, setCorrelation] = useState<CorrelationConfig>({
    enabled: false,
    rules: [],
  });

  // Execution state
  const [executionProgress, setExecutionProgress] = useState<ExecutionProgress>({
    status: "idle",
    currentIteration: 0,
    totalIterations: 0,
    activeUsers: 0,
    elapsedTime: 0,
    metrics: [],
    summary: null,
  });

  const validateSetupConfig = useCallback((): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!setupConfig.browser) {
      errors.push("Browser not selected");
    }
    if (!setupConfig.proxyHost || setupConfig.proxyHost.trim() === "") {
      errors.push("Proxy host is required");
    }
    if (!setupConfig.proxyPort || setupConfig.proxyPort < 1 || setupConfig.proxyPort > 65535) {
      errors.push("Invalid proxy port (must be 1-65535)");
    }
    if (!setupConfig.enableRecording) {
      errors.push("Recording is not enabled in Setup");
    }

    return { valid: errors.length === 0, errors };
  }, [setupConfig]);

  const handleStartRecording = useCallback(async () => {
    const validation = validateSetupConfig();

    if (!validation.valid) {
      validation.errors.forEach((error) => toast.error(error));
      return;
    }

    // For browser mode, we don't need proxy or certificate
    if (recordingMode === "browser") {
      setIsRecording(true);
      toast.success("Browser request interception started. Make requests from this page to capture them.");
      return;
    }

    // For proxy mode, check certificate
    if (setupConfig.certificate.status !== "generated") {
      toast.error("SSL Certificate not generated. Required for proxy recording.");
      return;
    }

    if (!setupConfig.certificateImported) {
      toast.warning("Certificate not imported to browser - HTTPS traffic may not be captured");
    }

    // Note: We can't actually start a proxy server from the browser
    // Show informational message about external proxy requirement
    toast.info(
      "Note: This app cannot create a proxy server directly. " +
        "Please ensure an external proxy (e.g., mitmproxy, Charles) is running at " +
        `${setupConfig.proxyHost}:${setupConfig.proxyPort}`,
      { duration: 6000 },
    );

    setIsRecording(true);
    toast.success(
      `Recording started via ${setupConfig.browser} proxy at ${setupConfig.proxyHost}:${setupConfig.proxyPort}`,
    );
  }, [setupConfig, validateSetupConfig, recordingMode]);

  const handleStopRecording = useCallback(() => {
    setIsRecording(false);
    toast.info(`Recording stopped. ${steps.length} steps captured.`);
  }, [steps.length]);

  const handleRecordingModeChange = useCallback((mode: "proxy" | "browser") => {
    setRecordingMode(mode);
  }, []);

  const handleGenerateCertificate = useCallback(() => {
    try {
      const { pem, metadata } = generateCertificate();
      setCertificatePem(pem);
      setSetupConfig((prev) => ({
        ...prev,
        certificateImported: true,
        certificate: metadata,
      }));
      toast.success("Certificate generated successfully");
    } catch (error) {
      toast.error("Failed to generate certificate");
      console.error("Certificate generation error:", error);
    }
  }, []);

  const handleDownloadCertificate = useCallback(() => {
    if (certificatePem) {
      downloadCertificate(certificatePem);
      toast.success("Certificate downloaded");
    }
  }, [certificatePem]);

  const handleRegenerateCertificate = useCallback(() => {
    // Mark old as expired and generate new
    setSetupConfig((prev) => ({
      ...prev,
      certificate: { ...prev.certificate, status: "expired" },
    }));
    handleGenerateCertificate();
  }, [handleGenerateCertificate]);
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Performance Test Studio</h2>
          <p className="text-muted-foreground">
            End-to-End Load and Stress Testing with Live Execution and Configuration Management
          </p>
        </div>
        <div className="flex items-center gap-2">
          {setupConfig.enableRecording && (
            <Badge variant="outline" className="gap-1 border-green-500 text-green-500">
              Recording Enabled
            </Badge>
          )}
          {steps.length > 0 && (
            <Badge variant="outline" className="gap-1">
              {steps.length} Steps
            </Badge>
          )}
          {executionProgress.status === "running" && (
            <Badge className="gap-1 animate-pulse">
              <Circle className="h-2 w-2 fill-current" />
              Running
            </Badge>
          )}
          {executionProgress.status === "completed" && executionProgress.summary && (
            <Badge variant="outline" className="gap-1 border-emerald-500 text-emerald-500">
              {executionProgress.summary.totalRequests} requests completed
            </Badge>
          )}
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 lg:w-[750px]">
          <TabsTrigger value="setup" className="gap-2">
            <Wrench className="h-4 w-4" />
            Setup
          </TabsTrigger>
          <TabsTrigger value="recording" className="gap-2">
            <Circle className={`h-3 w-3 ${isRecording ? "fill-red-500 text-red-500 animate-pulse" : ""}`} />
            Recording
          </TabsTrigger>
          <TabsTrigger value="configuration" className="gap-2">
            <Settings2 className="h-4 w-4" />
            Configuration
          </TabsTrigger>
          <TabsTrigger value="execution" className="gap-2">
            <Play className="h-4 w-4" />
            Execution
          </TabsTrigger>
          <TabsTrigger value="results" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Results
          </TabsTrigger>
        </TabsList>

        {/* Setup Tab */}
        <TabsContent value="setup" className="mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Browser & Proxy Settings</CardTitle>
                <CardDescription>Configure the browser and proxy for traffic recording</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="browser">Browser</Label>
                  <Select
                    value={setupConfig.browser}
                    onValueChange={(value: BrowserType) =>
                      setSetupConfig((prev) => ({
                        ...prev,
                        browser: value,
                      }))
                    }
                  >
                    <SelectTrigger id="browser">
                      <SelectValue placeholder="Select browser" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="chrome">Google Chrome</SelectItem>
                      <SelectItem value="edge">Microsoft Edge</SelectItem>
                      <SelectItem value="firefox">Mozilla Firefox</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="proxyHost">Proxy Host</Label>
                  <Input
                    id="proxyHost"
                    value={setupConfig.proxyHost}
                    onChange={(e) =>
                      setSetupConfig((prev) => ({
                        ...prev,
                        proxyHost: e.target.value,
                      }))
                    }
                    placeholder="localhost"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="proxyPort">Proxy Port</Label>
                  <Input
                    id="proxyPort"
                    type="number"
                    value={setupConfig.proxyPort}
                    onChange={(e) =>
                      setSetupConfig((prev) => ({
                        ...prev,
                        proxyPort: parseInt(e.target.value) || 8888,
                      }))
                    }
                    placeholder="8888"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Certificate & Recording</CardTitle>
                <CardDescription>Generate certificate for HTTPS and enable recording</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>SSL Certificate</Label>
                  <div className="flex items-center gap-3">
                    {setupConfig.certificate.status === "not_generated" && (
                      <Button variant="outline" onClick={handleGenerateCertificate}>
                        <Download className="h-4 w-4 mr-2" />
                        Generate Certificate
                      </Button>
                    )}
                    {setupConfig.certificate.status === "generated" && (
                      <>
                        <Button variant="outline" onClick={handleDownloadCertificate}>
                          <Download className="h-4 w-4 mr-2" />
                          Download Certificate
                        </Button>
                        <Button variant="ghost" size="sm" onClick={handleRegenerateCertificate}>
                          Regenerate
                        </Button>
                      </>
                    )}
                    {setupConfig.certificate.status === "expired" && (
                      <Button variant="outline" onClick={handleGenerateCertificate}>
                        <Download className="h-4 w-4 mr-2" />
                        Regenerate Certificate
                      </Button>
                    )}
                  </div>

                  {/* Certificate Status Display */}
                  <div className="flex items-center gap-2 mt-2">
                    {setupConfig.certificate.status === "generated" && (
                      <div className="flex items-center gap-1 text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="text-sm">Generated</span>
                        {setupConfig.certificate.expiresAt && (
                          <span className="text-xs text-muted-foreground ml-2">
                            <Clock className="h-3 w-3 inline mr-1" />
                            Expires: {new Date(setupConfig.certificate.expiresAt).toLocaleString()}
                          </span>
                        )}
                      </div>
                    )}
                    {setupConfig.certificate.status === "expired" && (
                      <div className="flex items-center gap-1 text-destructive">
                        <XCircle className="h-4 w-4" />
                        <span className="text-sm">Expired - Please regenerate</span>
                      </div>
                    )}
                    {setupConfig.certificate.status === "not_generated" && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <span className="text-sm">Not Generated</span>
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {setupConfig.certificate.commonName} - Required for capturing HTTPS traffic
                  </p>
                </div>

                <div className="border-t pt-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="enableRecording">Enable Recording</Label>
                      <p className="text-xs text-muted-foreground">Turn on to start capturing HTTP/HTTPS traffic</p>
                    </div>
                    <Switch
                      id="enableRecording"
                      checked={setupConfig.enableRecording}
                      onCheckedChange={(checked) =>
                        setSetupConfig((prev) => ({
                          ...prev,
                          enableRecording: checked,
                        }))
                      }
                    />
                  </div>
                </div>

                {setupConfig.enableRecording && (
                  <div className="bg-muted/50 rounded-lg p-3 text-sm">
                    <p className="font-medium mb-1">Proxy Configuration</p>
                    <p className="text-muted-foreground">
                      Configure your{" "}
                      {setupConfig.browser === "chrome"
                        ? "Chrome"
                        : setupConfig.browser === "edge"
                          ? "Edge"
                          : "Firefox"}{" "}
                      browser to use proxy:
                    </p>
                    <code className="block mt-1 bg-background px-2 py-1 rounded text-xs">
                      {setupConfig.proxyHost}:{setupConfig.proxyPort}
                    </code>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="recording" className="mt-6">
          <RecordingTab
            steps={steps}
            onStepsChange={setSteps}
            isRecording={isRecording}
            onStartRecording={handleStartRecording}
            onStopRecording={handleStopRecording}
            setupConfig={setupConfig}
            recordingMode={recordingMode}
            onRecordingModeChange={handleRecordingModeChange}
          />
        </TabsContent>

        <TabsContent value="configuration" className="mt-6">
          <ConfigurationTab
            config={config}
            onConfigChange={setConfig}
            parameterization={parameterization}
            onParameterizationChange={setParameterization}
            correlation={correlation}
            onCorrelationChange={setCorrelation}
            steps={steps}
          />
        </TabsContent>

        <TabsContent value="execution" className="mt-6">
          <ExecutionTab
            steps={steps}
            config={config}
            parameterization={parameterization}
            correlation={correlation}
            progress={executionProgress}
            onProgressChange={setExecutionProgress}
            projectId={projectId}
          />
        </TabsContent>

        <TabsContent value="results" className="mt-6">
          <ResultsTab progress={executionProgress} projectId={projectId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};
