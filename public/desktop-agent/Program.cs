using System;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using WisprDesktopAgent.Core;

namespace WisprDesktopAgent;

class Program
{
    [STAThread]
    static void Main(string[] args)
    {
        // Check for --recorder flag to launch standalone WinForms recorder
        bool recorderMode = false;
        foreach (var arg in args)
        {
            if (arg == "--recorder" || arg == "-r")
            {
                recorderMode = true;
                break;
            }
        }

        if (recorderMode)
        {
            Logger.Info("Launching Standalone Desktop Test Recorder...");
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new RecorderApp());
            return;
        }

        // Standard agent mode — run async work on the thread pool
        RunAgentAsync(args).GetAwaiter().GetResult();
    }

    static async Task RunAgentAsync(string[] args)
    {
        // Standard agent mode
        var apiToken = Environment.GetEnvironmentVariable("WISPR_API_TOKEN") ?? "";
        var apiUrl = Environment.GetEnvironmentVariable("WISPR_API_URL")
            ?? "https://lghzmijzfpvrcvogxpew.supabase.co/functions/v1/desktop-agent-api";
        var heartbeatMs = int.TryParse(Environment.GetEnvironmentVariable("HEARTBEAT_INTERVAL_MS"), out var hb) ? hb : 30000;
        var pollMs = int.TryParse(Environment.GetEnvironmentVariable("POLL_INTERVAL_MS"), out var pm) ? pm : 5000;

        if (string.IsNullOrEmpty(apiToken))
        {
            Logger.Error("WISPR_API_TOKEN environment variable is required.");
            Environment.Exit(1);
        }

        Logger.Info("WISPR Desktop Agent Starting...");
        Logger.Info($"API URL: {apiUrl}");
        Logger.Info($"Token: {apiToken[..Math.Min(20, apiToken.Length)]}...");

        // Initialize Java Access Bridge early
        var jabAvailable = JavaAccessBridge.Initialize();
        if (jabAvailable)
            Logger.Info("JAB is available — Java Swing/AWT components will be accessible");
        else
            Logger.Info("JAB not available — using UIA3 only (install JDK/JRE and run 'jabswitch /enable' for JAB support)");

        var apiClient = new ApiClient(apiUrl, apiToken);
        var cts = new CancellationTokenSource();

        Console.CancelKeyPress += (_, e) => { e.Cancel = true; cts.Cancel(); };

        // Heartbeat loop
        _ = Task.Run(async () =>
        {
            while (!cts.IsCancellationRequested)
            {
                try { await apiClient.SendHeartbeat(); }
                catch (Exception ex) { Logger.Error($"Heartbeat failed: {ex.Message}"); }
                await Task.Delay(heartbeatMs, cts.Token);
            }
        }, cts.Token);

        // Job poll loop
        while (!cts.IsCancellationRequested)
        {
            try
            {
                var job = await apiClient.PollForJob();
                if (job != null)
                {
                    if (job.IsRecordJob)
                    {
                        Logger.Info($"Recording job received: {job.Id}");
                        var recorder = new FullActionRecorder(apiClient, job);
                        await recorder.RunAsync(cts.Token);
                    }
                    else
                    {
                        Logger.Info($"Execution job received: {job.Id}");
                        var executor = new TestExecutor(apiClient, job);
                        await executor.RunAsync(cts.Token);
                    }
                }
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex) { Logger.Error($"Poll error: {ex.Message}"); }

            try { await Task.Delay(pollMs, cts.Token); }
            catch (OperationCanceledException) { break; }
        }

        Logger.Info("Agent stopped.");
    }
}

