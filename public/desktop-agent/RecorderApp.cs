using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading;
using System.Threading.Tasks;
using WisprDesktopAgent.Core;
using System.Windows.Forms;
using WisprDesktopAgent.Core;
using Microsoft.Identity.Client;

namespace WisprDesktopAgent;

/// <summary>
/// Standalone WinForms-based Desktop Test Recorder.
/// Provides a local UI for recording, reviewing, editing, and saving
/// desktop automation tests. Supports UIA, JAB, and Hybrid engines.
/// Includes AI features for automated step generation from manual test cases
/// and element capture with Object Repository linking.
/// </summary>
public class RecorderApp : Form, IRecorderStepSink
{
    // Setup controls
    private TextBox _txtApiToken;
    private TextBox _txtApiUrl;
    private TextBox _txtAppName;
    private TextBox _txtAppPath;
    private TextBox _txtAppArgs;
    private ComboBox _cmbEngineMode;
    private TextBox _txtTestName;
    private TextBox _txtTestDescription;

    // PAD-specific setup controls
    private Label _lblPadEnvId;
    private TextBox _txtPadEnvironmentId;
    private Label _lblPadFlowId;
    private TextBox _txtPadWorkflowId;
    private Label _lblDataverseOrgUrl;
    private TextBox _txtDataverseOrgUrl;

    // AI controls
    private TextBox _txtManualTestSteps;
    private Button _btnAIGenerate;
    private Label _lblAIStatus;

    // Step grid
    private DataGridView _dgvSteps;
    private BindingSource _stepsBindingSource;
    private List<RecordedStep> _steps = new();

    // Toolbar
    private Button _btnStart;
    private Button _btnStop;
    private Button _btnSave;
    private Button _btnRunTest;
    private Button _btnDiscard;
    private Button _btnAddStep;
    private Button _btnMoveUp;
    private Button _btnMoveDown;
    private Button _btnDeleteStep;
    private Button _btnImportPad;
    private Button _btnShowDiagnostics;
    private Button _btnCreateCloudFlow;
    private Button _btnCreateDesktopFlow;
    private Label _lblStatus;
    private Label _lblStepCount;

    // PAD integration
    private PowerAutomateIntegration _padIntegration;
    private CloudFlowCreator _cloudFlowCreator;
    private DesktopFlowUpdater _desktopFlowUpdater;
    private PadExecutionResult _lastPadResult;

    // PAD Diagnostics panel controls
    private Panel _padDiagPanel;
    private DataGridView _dgvDiagnostics;
    private TextBox _txtDiagDetail;

    // State
    private ApiClient? _apiClient;
    private FullActionRecorder? _recorder;
    private CancellationTokenSource? _cts;
    private bool _isRecording;
    private string _currentJobId = "";
    private int _stepCounter;

    public RecorderApp()
    {
        InitializeUI();
    }

    #region IRecorderStepSink

    public void OnStepCaptured(JsonObject step)
    {
        if (InvokeRequired)
        {
            BeginInvoke(new Action(() => OnStepCaptured(step)));
            return;
        }

        _stepCounter++;
        var rs = new RecordedStep
        {
            StepNumber = _stepCounter,
            Action = step["action"]?.GetValue<string>() ?? "",
            Label = step["target"]?["label"]?.GetValue<string>() ?? "",
            AutomationId = step["target"]?["automationId"]?.GetValue<string>() ?? "",
            ControlType = step["target"]?["controlType"]?.GetValue<string>() ?? "",
            Value = step["value"]?.GetValue<string>() ?? "",
            ParentWindow = step["target"]?["parentWindow"]?.GetValue<string>() ?? "",
            ClassHint = step["target"]?["classHint"]?.GetValue<string>() ?? "",
            JabRole = step["jabRole"]?.GetValue<string>() ?? "",
            JabDescription = step["jabDescription"]?.GetValue<string>() ?? "",
            JabSelector = step["jabSelector"]?.GetValue<string>() ?? "",
            WindowSelector = step["windowSelector"]?.GetValue<string>() ?? "",
        };

        // Capture OR-compatible metadata for Object Repository sync
        var orMeta = step["orMetadata"]?.AsObject();
        if (orMeta != null)
        {
            rs.FrameworkId = orMeta["frameworkId"]?.GetValue<string>() ?? "";
            rs.HierarchyPath = orMeta["hierarchyPath"]?.GetValue<string>() ?? "";
            rs.IsEnabled = orMeta["isEnabled"]?.GetValue<bool>() ?? true;

            var patterns = orMeta["supportedPatterns"]?.AsArray();
            if (patterns != null)
            {
                var parts = new List<string>();
                foreach (var p in patterns)
                {
                    var pv = p?.GetValue<string>();
                    if (!string.IsNullOrEmpty(pv)) parts.Add(pv);
                }
                rs.SupportedPatterns = string.Join(", ", parts);
            }

            try
            {
                var rect = orMeta["boundingRectangle"]?.AsObject();
                if (rect != null)
                {
                    rs.BoundsX = rect["x"]?.GetValue<double>() ?? 0;
                    rs.BoundsY = rect["y"]?.GetValue<double>() ?? 0;
                    rs.BoundsW = rect["width"]?.GetValue<double>() ?? 0;
                    rs.BoundsH = rect["height"]?.GetValue<double>() ?? 0;
                }
            }
            catch { }

            rs.CurrentValue = orMeta["currentValue"]?.GetValue<string>() ?? "";
            rs.ToggleState = orMeta["toggleState"]?.GetValue<string>() ?? "";
        }

        // Capture vision screenshot data
        var visionScreenshot = step["visionScreenshot"]?.GetValue<string>();
        if (!string.IsNullOrEmpty(visionScreenshot))
        {
            rs.VisionScreenshot = visionScreenshot;
            try
            {
                var vBounds = step["visionBounds"]?.AsObject();
                if (vBounds != null)
                {
                    rs.VisionBoundsX = vBounds["x"]?.GetValue<double>() ?? 0;
                    rs.VisionBoundsY = vBounds["y"]?.GetValue<double>() ?? 0;
                    rs.VisionBoundsW = vBounds["width"]?.GetValue<double>() ?? 0;
                    rs.VisionBoundsH = vBounds["height"]?.GetValue<double>() ?? 0;
                }
            }
            catch { }
        }

        _steps.Add(rs);
        RefreshGrid();
        _lblStepCount.Text = _steps.Count + " steps";

        // Auto-scroll to last row
        if (_dgvSteps.Rows.Count > 0)
            _dgvSteps.FirstDisplayedScrollingRowIndex = _dgvSteps.Rows.Count - 1;
    }

    #endregion

    #region UI Initialization

    private void InitializeUI()
    {
        Text = "WISPR Desktop Test Recorder";
        Size = new Size(1200, 850);
        StartPosition = FormStartPosition.CenterScreen;
        MinimumSize = new Size(900, 600);

        var mainSplit = new SplitContainer
        {
            Dock = DockStyle.Fill,
            Orientation = Orientation.Vertical,
            SplitterDistance = 320,
            FixedPanel = FixedPanel.Panel1,
        };

        // Left panel: Setup + AI
        var leftPanel = new Panel { Dock = DockStyle.Fill, Padding = new Padding(8) };
        var setupGroup = CreateSetupPanel();
        var aiGroup = CreateAIPanel();

        setupGroup.Dock = DockStyle.Top;
        setupGroup.Height = 410;
        aiGroup.Dock = DockStyle.Fill;

        leftPanel.Controls.Add(aiGroup);
        leftPanel.Controls.Add(setupGroup);

        // Right panel: Steps grid + toolbar + PAD diagnostics
        var rightPanel = new Panel { Dock = DockStyle.Fill, Padding = new Padding(8) };
        var toolbar = CreateToolbar();
        toolbar.Dock = DockStyle.Top;
        toolbar.Height = 45;

        CreateStepsGrid();
        _dgvSteps.Dock = DockStyle.Fill;

        // PAD Diagnostics Panel (docked at bottom of right panel, initially hidden)
        CreatePadDiagnosticsPanel();

        var statusBar = new FlowLayoutPanel { Dock = DockStyle.Bottom, Height = 30, FlowDirection = FlowDirection.LeftToRight };
        _lblStatus = new Label { Text = "Ready", AutoSize = true, Padding = new Padding(4) };
        _lblStepCount = new Label { Text = "0 steps", AutoSize = true, Padding = new Padding(4) };
        statusBar.Controls.Add(_lblStatus);
        statusBar.Controls.Add(_lblStepCount);

        // Order matters for docking: bottom-docked first, then fill
        rightPanel.Controls.Add(_dgvSteps);
        rightPanel.Controls.Add(_padDiagPanel);
        rightPanel.Controls.Add(toolbar);
        rightPanel.Controls.Add(statusBar);

        mainSplit.Panel1.Controls.Add(leftPanel);
        mainSplit.Panel2.Controls.Add(rightPanel);
        Controls.Add(mainSplit);
    }

    private GroupBox CreateSetupPanel()
    {
        var group = new GroupBox { Text = "Setup", Padding = new Padding(8) };
        var layout = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 2,
            RowCount = 13,
            AutoSize = true,
        };
        layout.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 110));
        layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));

        int row = 0;
        layout.Controls.Add(new Label { Text = "API Token:", Anchor = AnchorStyles.Left }, 0, row);
        _txtApiToken = new TextBox { Dock = DockStyle.Fill, UseSystemPasswordChar = true };
        _txtApiToken.Text = Environment.GetEnvironmentVariable("WISPR_API_TOKEN") ?? "";
        layout.Controls.Add(_txtApiToken, 1, row++);

        layout.Controls.Add(new Label { Text = "API URL:", Anchor = AnchorStyles.Left }, 0, row);
        _txtApiUrl = new TextBox { Dock = DockStyle.Fill };
        _txtApiUrl.Text = Environment.GetEnvironmentVariable("WISPR_API_URL")
            ?? "https://lghzmijzfpvrcvogxpew.supabase.co/functions/v1/desktop-agent-api";
        layout.Controls.Add(_txtApiUrl, 1, row++);

        layout.Controls.Add(new Label { Text = "Test Name:", Anchor = AnchorStyles.Left }, 0, row);
        _txtTestName = new TextBox { Dock = DockStyle.Fill };
        layout.Controls.Add(_txtTestName, 1, row++);

        layout.Controls.Add(new Label { Text = "Description:", Anchor = AnchorStyles.Left }, 0, row);
        _txtTestDescription = new TextBox { Dock = DockStyle.Fill };
        layout.Controls.Add(_txtTestDescription, 1, row++);

        layout.Controls.Add(new Label { Text = "App Name:", Anchor = AnchorStyles.Left }, 0, row);
        _txtAppName = new TextBox { Dock = DockStyle.Fill, Text = "AppName" };
        layout.Controls.Add(_txtAppName, 1, row++);

        layout.Controls.Add(new Label { Text = "App Path:", Anchor = AnchorStyles.Left }, 0, row);
        var pathPanel = new Panel { Dock = DockStyle.Fill, Height = 24 };
        _txtAppPath = new TextBox { Dock = DockStyle.Fill };
        var btnBrowse = new Button { Text = "...", Dock = DockStyle.Right, Width = 30 };
        btnBrowse.Click += (_, _) =>
        {
            using var ofd = new OpenFileDialog { Filter = "Executables|*.exe;*.jar;*.jnlp;*.bat;*.lnk|All|*.*" };
            if (ofd.ShowDialog() == DialogResult.OK)
                _txtAppPath.Text = ofd.FileName;
        };
        pathPanel.Controls.Add(_txtAppPath);
        pathPanel.Controls.Add(btnBrowse);
        layout.Controls.Add(pathPanel, 1, row++);

        layout.Controls.Add(new Label { Text = "App Args:", Anchor = AnchorStyles.Left }, 0, row);
        _txtAppArgs = new TextBox { Dock = DockStyle.Fill };
        layout.Controls.Add(_txtAppArgs, 1, row++);

        layout.Controls.Add(new Label { Text = "Engine Mode:", Anchor = AnchorStyles.Left }, 0, row);
        _cmbEngineMode = new ComboBox { Dock = DockStyle.Fill, DropDownStyle = ComboBoxStyle.DropDownList };
        _cmbEngineMode.Items.AddRange(new object[] { "uia", "jab", "hybrid", "vision", "pad" });
        _cmbEngineMode.SelectedIndex = 0;
        _cmbEngineMode.SelectedIndexChanged += CmbEngineMode_Changed;
        layout.Controls.Add(_cmbEngineMode, 1, row++);

        // PAD-specific fields (hidden by default, shown when PAD engine mode is selected)
        _lblPadEnvId = new Label { Text = "PAD Env ID:", Anchor = AnchorStyles.Left, Visible = false };
        layout.Controls.Add(_lblPadEnvId, 0, row);
        _txtPadEnvironmentId = new TextBox { Dock = DockStyle.Fill, Visible = false };
        layout.Controls.Add(_txtPadEnvironmentId, 1, row++);

        _lblPadFlowId = new Label { Text = "PAD Flow ID:", Anchor = AnchorStyles.Left, Visible = false };
        layout.Controls.Add(_lblPadFlowId, 0, row);
        _txtPadWorkflowId = new TextBox { Dock = DockStyle.Fill, Visible = false };
        layout.Controls.Add(_txtPadWorkflowId, 1, row++);

        // Dataverse Org URL field (for Desktop Flow creation)
        _lblDataverseOrgUrl = new Label { Text = "Dataverse URL:", Anchor = AnchorStyles.Left, Visible = false };
        layout.Controls.Add(_lblDataverseOrgUrl, 0, row);
        _txtDataverseOrgUrl = new TextBox { Dock = DockStyle.Fill, Visible = false };
        _txtDataverseOrgUrl.PlaceholderText = "https://org12345.crm.dynamics.com";
        layout.Controls.Add(_txtDataverseOrgUrl, 1, row++);

        group.Controls.Add(layout);
        return group;
    }

    private GroupBox CreateAIPanel()
    {
        var group = new GroupBox { Text = "AI: Convert Manual Test Steps", Padding = new Padding(8) };
        var layout = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 1,
            RowCount = 4,
        };
        layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        layout.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));

        layout.Controls.Add(new Label
        {
            Text = "Paste manual test steps (one per line). AI will generate automation steps:",
            AutoSize = true,
            Padding = new Padding(0, 0, 0, 4),
        }, 0, 0);

        _txtManualTestSteps = new TextBox
        {
            Dock = DockStyle.Fill,
            Multiline = true,
            ScrollBars = ScrollBars.Vertical,
            AcceptsReturn = true,
        };
        layout.Controls.Add(_txtManualTestSteps, 0, 1);

        _btnAIGenerate = new Button
        {
            Text = "🤖 Generate Automation Steps with AI",
            Dock = DockStyle.Fill,
            Height = 32,
            BackColor = Color.FromArgb(59, 130, 246),
            ForeColor = Color.White,
            FlatStyle = FlatStyle.Flat,
        };
        _btnAIGenerate.Click += BtnAIGenerate_Click;
        layout.Controls.Add(_btnAIGenerate, 0, 2);

        _lblAIStatus = new Label { Text = "", AutoSize = true, ForeColor = Color.Gray };
        layout.Controls.Add(_lblAIStatus, 0, 3);

        group.Controls.Add(layout);
        return group;
    }

    private FlowLayoutPanel CreateToolbar()
    {
        var toolbar = new FlowLayoutPanel { FlowDirection = FlowDirection.LeftToRight, WrapContents = false };

        _btnStart = new Button { Text = "▶ Start Recording", Width = 130, Height = 32, BackColor = Color.FromArgb(34, 197, 94), ForeColor = Color.White, FlatStyle = FlatStyle.Flat };
        _btnStop = new Button { Text = "⏹ Stop", Width = 80, Height = 32, Enabled = false };
        _btnRunTest = new Button { Text = "▶ Run Test", Width = 100, Height = 32, BackColor = Color.FromArgb(168, 85, 247), ForeColor = Color.White, FlatStyle = FlatStyle.Flat };
        _btnSave = new Button { Text = "💾 Save Test", Width = 100, Height = 32, BackColor = Color.FromArgb(59, 130, 246), ForeColor = Color.White, FlatStyle = FlatStyle.Flat };
        _btnDiscard = new Button { Text = "🗑 Discard", Width = 90, Height = 32 };
        _btnAddStep = new Button { Text = "+ Step", Width = 70, Height = 32 };
        _btnMoveUp = new Button { Text = "↑", Width = 32, Height = 32 };
        _btnMoveDown = new Button { Text = "↓", Width = 32, Height = 32 };
        _btnDeleteStep = new Button { Text = "✕", Width = 32, Height = 32, ForeColor = Color.Red };
        _btnImportPad = new Button { Text = "📥 Import PAD Flow", Width = 140, Height = 32, BackColor = Color.FromArgb(14, 165, 233), ForeColor = Color.White, FlatStyle = FlatStyle.Flat, Visible = false };
        _btnShowDiagnostics = new Button { Text = "🔍 PAD Diagnostics", Width = 140, Height = 32, BackColor = Color.FromArgb(100, 116, 139), ForeColor = Color.White, FlatStyle = FlatStyle.Flat, Visible = false };
        _btnCreateCloudFlow = new Button { Text = "☁ Create Cloud Flow", Width = 150, Height = 32, BackColor = Color.FromArgb(234, 88, 12), ForeColor = Color.White, FlatStyle = FlatStyle.Flat, Visible = false };
        _btnCreateDesktopFlow = new Button { Text = "🖥 Create Desktop Flow", Width = 160, Height = 32, BackColor = Color.FromArgb(16, 185, 129), ForeColor = Color.White, FlatStyle = FlatStyle.Flat, Visible = false };

        _btnStart.Click += BtnStart_Click;
        _btnStop.Click += BtnStop_Click;
        _btnRunTest.Click += BtnRunTest_Click;
        _btnSave.Click += BtnSave_Click;
        _btnDiscard.Click += BtnDiscard_Click;
        _btnAddStep.Click += (_, _) => AddManualStep();
        _btnMoveUp.Click += (_, _) => MoveSelectedStep(-1);
        _btnMoveDown.Click += (_, _) => MoveSelectedStep(1);
        _btnDeleteStep.Click += (_, _) => DeleteSelectedStep();
        _btnImportPad.Click += BtnImportPad_Click;
        _btnShowDiagnostics.Click += (_, _) => TogglePadDiagnosticsPanel();
        _btnCreateCloudFlow.Click += BtnCreateCloudFlow_Click;
        _btnCreateDesktopFlow.Click += BtnCreateDesktopFlow_Click;

        toolbar.Controls.AddRange(new Control[] { _btnStart, _btnStop, _btnRunTest, _btnSave, _btnDiscard, _btnAddStep, _btnMoveUp, _btnMoveDown, _btnDeleteStep, _btnImportPad, _btnCreateCloudFlow, _btnCreateDesktopFlow, _btnShowDiagnostics });
        return toolbar;
    }

    private void CreateStepsGrid()
    {
        _dgvSteps = new DataGridView
        {
            AllowUserToAddRows = false,
            AllowUserToDeleteRows = false,
            AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill,
            SelectionMode = DataGridViewSelectionMode.FullRowSelect,
            MultiSelect = false,
            RowHeadersVisible = false,
            BackgroundColor = SystemColors.Window,
            BorderStyle = BorderStyle.Fixed3D,
        };

        _dgvSteps.Columns.Add(new DataGridViewTextBoxColumn { Name = "StepNumber", HeaderText = "#", Width = 35, FillWeight = 3 });
        _dgvSteps.Columns.Add(new DataGridViewComboBoxColumn
        {
            Name = "Action", HeaderText = "Action", FillWeight = 10,
            Items = { "click", "double_click", "right_click", "type", "clear", "select", "assert_text",
                      "assert_state", "assert_visible", "wait", "wait_for_element", "window_switch",
                      "window_close", "screenshot", "scroll", "hover", "keyboard_shortcut", "drag_drop", "launch_app" }
        });
        _dgvSteps.Columns.Add(new DataGridViewTextBoxColumn { Name = "Label", HeaderText = "Label / Name", FillWeight = 12 });
        _dgvSteps.Columns.Add(new DataGridViewTextBoxColumn { Name = "AutomationId", HeaderText = "Automation ID", FillWeight = 10 });
        _dgvSteps.Columns.Add(new DataGridViewTextBoxColumn { Name = "ControlType", HeaderText = "Control Type", FillWeight = 8 });
        _dgvSteps.Columns.Add(new DataGridViewTextBoxColumn { Name = "Value", HeaderText = "Value", FillWeight = 10 });
        _dgvSteps.Columns.Add(new DataGridViewTextBoxColumn { Name = "ParentWindow", HeaderText = "Parent Window", FillWeight = 10 });
        _dgvSteps.Columns.Add(new DataGridViewTextBoxColumn { Name = "ClassHint", HeaderText = "Class / Framework", FillWeight = 8 });
        _dgvSteps.Columns.Add(new DataGridViewTextBoxColumn { Name = "HierarchyPath", HeaderText = "Hierarchy Path", FillWeight = 10 });
        _dgvSteps.Columns.Add(new DataGridViewTextBoxColumn { Name = "Patterns", HeaderText = "UIA Patterns", FillWeight = 6 });
        _dgvSteps.Columns.Add(new DataGridViewTextBoxColumn { Name = "JabRole", HeaderText = "JAB Role", FillWeight = 5 });
        _dgvSteps.Columns.Add(new DataGridViewTextBoxColumn { Name = "JabSelector", HeaderText = "JAB Selector", FillWeight = 12 });
        _dgvSteps.Columns.Add(new DataGridViewTextBoxColumn { Name = "WindowSelector", HeaderText = "Window Selector", FillWeight = 12 });
        _dgvSteps.Columns.Add(new DataGridViewTextBoxColumn { Name = "VisionCaptured", HeaderText = "Vision", FillWeight = 4, ReadOnly = true });
        _dgvSteps.Columns.Add(new DataGridViewTextBoxColumn { Name = "VisionBounds", HeaderText = "Vision Bounds", FillWeight = 8, ReadOnly = true });
        _dgvSteps.Columns.Add(new DataGridViewTextBoxColumn { Name = "PadSelector", HeaderText = "PAD Selector", FillWeight = 12 });

        _dgvSteps.CellValueChanged += DgvSteps_CellValueChanged;
    }

    #endregion

    #region Recording

    private async void BtnStart_Click(object? sender, EventArgs e)
    {
        string engineMode = _cmbEngineMode.SelectedItem?.ToString() ?? "uia";

        // PAD mode: launch PAD designer instead of internal recorder
        if (engineMode == "pad")
        {
            StartPadRecording();
            return;
        }

        if (string.IsNullOrWhiteSpace(_txtApiToken.Text))
        {
            MessageBox.Show("API Token is required.", "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return;
        }

        _apiClient = new ApiClient(_txtApiUrl.Text.Trim(), _txtApiToken.Text.Trim());
        _cts = new CancellationTokenSource();
        _isRecording = true;
        _stepCounter = 0;
        _steps.Clear();
        RefreshGrid();

        _btnStart.Enabled = false;
        _btnStop.Enabled = true;
        _lblStatus.Text = "Recording...";
        _lblStatus.ForeColor = Color.Green;

        // Create a simulated recording job
        var job = new DesktopJob
        {
            Id = "recorder-" + Guid.NewGuid().ToString("N")[..8],
            ApplicationPath = _txtAppPath.Text.Trim(),
            ApplicationArgs = _txtAppArgs.Text.Trim(),
            EngineMode = _cmbEngineMode.SelectedItem?.ToString() ?? "uia",
            IsRecordJob = true,
        };
        _currentJobId = job.Id;

        _recorder = new FullActionRecorder(_apiClient, job, this);

        try
        {
            await Task.Run(() => _recorder.RunAsync(_cts.Token), _cts.Token);
        }
        catch (OperationCanceledException) { }
        catch (Exception ex)
        {
            MessageBox.Show("Recording error: " + ex.Message, "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
        finally
        {
            StopRecordingUI();
        }
    }

    private void BtnStop_Click(object? sender, EventArgs e)
    {
        string engineMode = _cmbEngineMode.SelectedItem?.ToString() ?? "uia";

        if (engineMode == "pad")
        {
            StopPadRecording();
            return;
        }

        _cts?.Cancel();
        StopRecordingUI();
    }

    private void StopRecordingUI()
    {
        _isRecording = false;
        _btnStart.Enabled = true;
        _btnStop.Enabled = false;
        _lblStatus.Text = "Stopped — Review & edit steps before saving";
        _lblStatus.ForeColor = Color.DarkOrange;
    }

    #endregion

    #region PAD Integration

    private void CmbEngineMode_Changed(object? sender, EventArgs e)
    {
        bool isPad = _cmbEngineMode.SelectedItem?.ToString() == "pad";
        _btnImportPad.Visible = isPad;
        _btnShowDiagnostics.Visible = isPad;
        _btnCreateCloudFlow.Visible = isPad;
        _btnCreateDesktopFlow.Visible = isPad;
        if (!isPad) _padDiagPanel.Visible = false;

        // Toggle PAD Environment/Workflow ID fields
        _lblPadEnvId.Visible = isPad;
        _txtPadEnvironmentId.Visible = isPad;
        _lblPadFlowId.Visible = isPad;
        _txtPadWorkflowId.Visible = isPad;
        _lblDataverseOrgUrl.Visible = isPad;
        _txtDataverseOrgUrl.Visible = isPad;
    }

    // PAD recording state: track .robin files present before recording started
    private HashSet<string> _padPreRecordingFiles = new();
    private DateTime _padRecordingStartTime;

    private void StartPadRecording()
    {
        if (_padIntegration == null)
            _padIntegration = new PowerAutomateIntegration();

        if (!_padIntegration.IsPadInstalled)
        {
            MessageBox.Show(
                "Power Automate Desktop is not installed on this machine.\n\n" +
                "Please install it from the Microsoft Store (free with Windows 10/11) or from:\n" +
                "https://go.microsoft.com/fwlink/?linkid=2102613",
                "PAD Not Found", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }

        // Snapshot existing .robin files so we can detect new ones on Stop
        _padPreRecordingFiles.Clear();
        var existingFlows = _padIntegration.GetAvailableFlows();
        foreach (var f in existingFlows)
            _padPreRecordingFiles.Add(f);
        _padRecordingStartTime = DateTime.UtcNow;

        // Clear previous steps
        _stepCounter = 0;
        _steps.Clear();
        RefreshGrid();

        // Launch PAD designer/recorder
        bool launched = _padIntegration.LaunchPadDesigner();
        if (!launched)
        {
            MessageBox.Show(
                "Failed to launch Power Automate Desktop.\nPlease open it manually and record your flow.",
                "Launch Failed", MessageBoxButtons.OK, MessageBoxIcon.Warning);
        }

        // Set recording UI state
        _isRecording = true;
        _btnStart.Enabled = false;
        _btnStop.Enabled = true;
        _btnImportPad.Visible = true;
        _lblStatus.Text = "PAD Recording — Record your flow in Power Automate Desktop, then click Stop";
        _lblStatus.ForeColor = Color.Green;
        _lblStepCount.Text = "0 steps";

        MessageBox.Show(
            "Power Automate Desktop has been launched.\n\n" +
            "Instructions:\n" +
            "1. Create a new flow in PAD and use its recorder to capture actions\n" +
            "2. Save the flow in PAD when done\n" +
            "3. Click 'Stop' in this recorder to auto-import the recorded steps\n\n" +
            "The steps will be displayed in the grid automatically.",
            "PAD Recording Started", MessageBoxButtons.OK, MessageBoxIcon.Information);
    }

    private void StopPadRecording()
    {
        _isRecording = false;
        _btnStart.Enabled = true;
        _btnStop.Enabled = false;

        if (_padIntegration == null)
            _padIntegration = new PowerAutomateIntegration();

        _lblStatus.Text = "Importing PAD recorded steps...";
        _lblStatus.ForeColor = Color.FromArgb(14, 165, 233);

        // Find new or modified .robin files since recording started
        var currentFlows = _padIntegration.GetAvailableFlows();
        var newFlows = new List<string>();

        foreach (var flow in currentFlows)
        {
            // New file that didn't exist before
            if (!_padPreRecordingFiles.Contains(flow))
            {
                newFlows.Add(flow);
                continue;
            }
            // Existing file that was modified during recording
            try
            {
                var lastWrite = System.IO.File.GetLastWriteTimeUtc(flow);
                if (lastWrite >= _padRecordingStartTime)
                    newFlows.Add(flow);
            }
            catch { }
        }

        if (newFlows.Count == 0)
        {
            // No auto-detected files, prompt user to pick one manually
            _lblStatus.Text = "No new PAD flows detected. Use 'Import PAD Flow' to select a .robin file.";
            _lblStatus.ForeColor = Color.DarkOrange;

            var result = MessageBox.Show(
                "No new or modified Power Automate flows were detected.\n\n" +
                "Would you like to manually select a .robin file to import?",
                "No Flows Detected", MessageBoxButtons.YesNo, MessageBoxIcon.Question);

            if (result == DialogResult.Yes)
                BtnImportPad_Click(null, EventArgs.Empty);
            return;
        }

        // Import all new/modified .robin files
        int totalImported = 0;
        foreach (var flowPath in newFlows)
        {
            try
            {
                var parser = new RobinScriptParser();
                var parsedSteps = parser.ParseFile(flowPath);

                foreach (var ps in parsedSteps)
                {
                    _stepCounter++;
                    _steps.Add(new RecordedStep
                    {
                        StepNumber = _stepCounter,
                        Action = ps.Action,
                        Label = ps.Label,
                        AutomationId = ps.AutomationId,
                        ControlType = ps.ControlType,
                        Value = ps.Value,
                        ParentWindow = ps.WindowTitle,
                        ClassHint = ps.ClassName,
                        WindowSelector = ps.WindowSelector,
                        HierarchyPath = ps.HierarchyPath,
                        PadSelector = ps.PadSelector,
                    });
                    totalImported++;
                }
            }
            catch (Exception ex)
            {
                Logger.Error($"Failed to parse Robin script {flowPath}: {ex.Message}");
            }
        }

        RefreshGrid();
        _lblStepCount.Text = _steps.Count + " steps";

        if (totalImported > 0)
        {
            _lblStatus.Text = $"Imported {totalImported} steps from {newFlows.Count} PAD flow(s). Review & edit before saving.";
            _lblStatus.ForeColor = Color.Green;

            if (_dgvSteps.Rows.Count > 0)
                _dgvSteps.FirstDisplayedScrollingRowIndex = _dgvSteps.Rows.Count - 1;

            MessageBox.Show(
                $"Successfully imported {totalImported} steps from Power Automate Desktop.\n\n" +
                "Review the steps in the grid and edit as needed before saving.",
                "PAD Import Complete", MessageBoxButtons.OK, MessageBoxIcon.Information);
        }
        else
        {
            _lblStatus.Text = "No actionable steps found in the recorded PAD flows.";
            _lblStatus.ForeColor = Color.DarkOrange;
        }
    }

    private void BtnImportPad_Click(object? sender, EventArgs e)
    {
        if (_padIntegration == null)
            _padIntegration = new PowerAutomateIntegration();

        using var ofd = new OpenFileDialog
        {
            Title = "Import Power Automate Desktop Flow",
            Filter = "Robin Scripts|*.robin|All Files|*.*",
            InitialDirectory = _padIntegration.PadScriptsFolder,
        };

        if (ofd.ShowDialog() != DialogResult.OK) return;

        try
        {
            var parser = new RobinScriptParser();
            var parsedSteps = parser.ParseFile(ofd.FileName);

            if (parsedSteps.Count == 0)
            {
                MessageBox.Show("No actionable steps found in the selected .robin file.", "Import Result", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }

            // Convert parsed PAD steps to RecordedStep format
            int imported = 0;
            for (int i = 0; i < parsedSteps.Count; i++)
            {
                var ps = parsedSteps[i];
                _stepCounter++;
                _steps.Add(new RecordedStep
                {
                    StepNumber = _stepCounter,
                    Action = ps.Action,
                    Label = ps.Label,
                    AutomationId = ps.AutomationId,
                    ControlType = ps.ControlType,
                    Value = ps.Value,
                    ParentWindow = ps.WindowTitle,
                    ClassHint = ps.ClassName,
                    WindowSelector = ps.WindowSelector,
                    HierarchyPath = ps.HierarchyPath,
                    PadSelector = ps.PadSelector,
                });
                imported++;
            }

            RefreshGrid();
            _lblStepCount.Text = _steps.Count + " steps";
            _lblStatus.Text = "Imported " + imported + " steps from PAD flow. Review and edit before saving.";
            _lblStatus.ForeColor = Color.Green;

            MessageBox.Show("Successfully imported " + imported + " steps from Power Automate Desktop flow.\n\nReview the steps in the grid and edit as needed.", "Import Complete", MessageBoxButtons.OK, MessageBoxIcon.Information);
        }
        catch (Exception ex)
        {
            MessageBox.Show("Failed to import PAD flow: " + ex.Message, "Import Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            _lblStatus.Text = "PAD import failed: " + ex.Message;
            _lblStatus.ForeColor = Color.Red;
        }
    }

    private void RunTestViaPad()
    {
        if (_padIntegration == null)
            _padIntegration = new PowerAutomateIntegration();

        if (!_padIntegration.IsPadInstalled || string.IsNullOrEmpty(_padIntegration.PadConsolePath))
        {
            MessageBox.Show(
                "PAD CLI (PAD.Console.Host.exe) not found.\n\n" +
                "Power Automate Desktop must be installed with CLI support to execute flows.",
                "PAD CLI Not Found", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return;
        }

        var confirm = MessageBox.Show(
            "Execute the " + _steps.Count + " steps via Power Automate Desktop?\n\n" +
            "A .robin flow will be generated and executed using the PAD CLI.",
            "Confirm PAD Execution", MessageBoxButtons.YesNo, MessageBoxIcon.Question);
        if (confirm != DialogResult.Yes) return;

        _btnRunTest.Enabled = false;
        _btnStart.Enabled = false;
        _lblStatus.Text = "Executing via Power Automate Desktop...";
        _lblStatus.ForeColor = Color.FromArgb(168, 85, 247);

        PadExecutionResult result = null;
        try
        {
            // Convert steps to .robin script
            var writer = new RobinScriptWriter();
            string robinContent = writer.WriteScript(_steps, _txtAppName.Text.Trim(), _txtAppPath.Text.Trim());

            // Export and execute — use user-provided IDs if available
            string flowName = _padIntegration.ExportFlowForExecution(robinContent, _txtTestName.Text.Trim());
            string userEnvId = _txtPadEnvironmentId.Text.Trim();
            string userFlowId = _txtPadWorkflowId.Text.Trim();

            if (!string.IsNullOrEmpty(userEnvId) && !string.IsNullOrEmpty(userFlowId))
            {
                result = _padIntegration.ExecuteFlowWithIds(flowName, userEnvId, userFlowId, 300);
            }
            else
            {
                result = _padIntegration.ExecuteFlow(flowName, 300);
            }

            if (result.Success)
            {
                _lblStatus.Text = "PAD execution PASSED ✅ — " + result.DurationMs + "ms";
                _lblStatus.ForeColor = Color.Green;

                for (int i = 0; i < _dgvSteps.Rows.Count; i++)
                {
                    _dgvSteps.Rows[i].DefaultCellStyle.BackColor = Color.FromArgb(220, 252, 231);
                }

                MessageBox.Show(
                    "PAD flow executed successfully!\n\n" +
                    "Duration: " + result.DurationMs + " ms\n" +
                    "Exit Code: " + result.ExitCode,
                    "PAD Execution — PASSED", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
            else
            {
                _lblStatus.Text = "PAD execution FAILED ❌ — " + result.ErrorMessage;
                _lblStatus.ForeColor = Color.Red;

                MessageBox.Show(
                    "PAD flow execution failed.\n\n" +
                    "Error: " + result.ErrorMessage + "\n" +
                    "Exit Code: " + result.ExitCode + "\n" +
                    "Duration: " + result.DurationMs + " ms\n\n" +
                    (string.IsNullOrEmpty(result.StandardError) ? "" : "Stderr:\n" + result.StandardError),
                    "PAD Execution — FAILED", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }
        catch (Exception ex)
        {
            _lblStatus.Text = "PAD execution error: " + ex.Message;
            _lblStatus.ForeColor = Color.Red;
            MessageBox.Show("PAD execution error: " + ex.Message, "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
        finally
        {
            _btnRunTest.Enabled = true;
            _btnStart.Enabled = true;

            // Populate embedded diagnostics panel and show it
            if (result != null && result.DiagnosticLog != null && result.DiagnosticLog.Count > 0)
            {
                _lastPadResult = result;
                PopulatePadDiagnostics(result);
                _padDiagPanel.Visible = true;
                _btnShowDiagnostics.Text = "🔍 Hide Diagnostics";
            }
        }
    }

    /// <summary>
    /// Creates an Instant Cloud Flow in Power Automate with "When an HTTP request is received" trigger.
    /// Converts the current test steps into flow actions and auto-populates the Workflow ID in the GUI.
    /// </summary>
    private async void BtnCreateCloudFlow_Click(object? sender, EventArgs e)
    {
        if (_steps.Count == 0)
        {
            MessageBox.Show("No steps available. Import a PAD flow or record steps first.",
                "No Steps", MessageBoxButtons.OK, MessageBoxIcon.Information);
            return;
        }

        string envId = _txtPadEnvironmentId.Text.Trim();
        if (string.IsNullOrEmpty(envId))
        {
            MessageBox.Show(
                "PAD Environment ID is required to create a Cloud Flow.\n\n" +
                "You can find it in Power Automate → Settings → Session details,\n" +
                "or from the URL: make.powerautomate.com/environments/{environmentId}/...",
                "Environment ID Required", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }

        string flowName = _txtTestName.Text.Trim();
        if (string.IsNullOrEmpty(flowName))
        {
            flowName = "Wispr_Test_" + DateTime.Now.ToString("yyyyMMdd_HHmmss");
            _txtTestName.Text = flowName;
        }

        var confirm = MessageBox.Show(
            "Create an Instant Cloud Flow in Power Automate?\n\n" +
            "Flow Name: " + flowName + "\n" +
            "Environment: " + envId + "\n" +
            "Steps: " + _steps.Count + "\n" +
            "Trigger: When an HTTP request is received\n\n" +
            "You will be prompted to sign in with your Microsoft account.",
            "Create Cloud Flow", MessageBoxButtons.YesNo, MessageBoxIcon.Question);
        if (confirm != DialogResult.Yes) return;

        // Disable UI during creation
        _btnCreateCloudFlow.Enabled = false;
        _btnRunTest.Enabled = false;
        _btnStart.Enabled = false;
        _lblStatus.Text = "Creating Cloud Flow... (sign in when prompted)";
        _lblStatus.ForeColor = Color.FromArgb(234, 88, 12);

        try
        {
            if (_cloudFlowCreator == null)
            {
                _cloudFlowCreator = new CloudFlowCreator();
            }

            _cloudFlowCreator.OnDeviceCodePrompt = (userCode, verificationUrl, fullMessage) =>
            {
                void ShowPrompt()
                {
                    bool hasCode = !string.IsNullOrWhiteSpace(userCode);

                    if (!string.IsNullOrWhiteSpace(verificationUrl))
                    {
                        try
                        {
                            Process.Start(new ProcessStartInfo
                            {
                                FileName = verificationUrl,
                                UseShellExecute = true,
                            });
                        }
                        catch { }
                    }

                    string dialogText = hasCode
                        ? "Sign in to Microsoft to authorize Cloud Flow creation:\n\n" +
                          "1. Browser login page:\n   " + verificationUrl + "\n\n" +
                          "2. Enter this code when prompted:\n\n   " + userCode + "\n\n" +
                          "3. Complete sign-in, then click OK here to continue.\n\n" +
                          "(The code has been copied to your clipboard)"
                        : "Microsoft sign-in could not generate a device code prompt.\n\n" +
                          "Open this URL and sign in manually, then retry:\n" + verificationUrl + "\n\n" +
                          (string.IsNullOrWhiteSpace(fullMessage) ? "" : "Details:\n" + fullMessage);

                    MessageBox.Show(this,
                        dialogText,
                        hasCode ? "Microsoft Sign-In Required" : "Microsoft Sign-In Issue",
                        MessageBoxButtons.OK,
                        hasCode ? MessageBoxIcon.Information : MessageBoxIcon.Warning);

                    if (hasCode)
                    {
                        try
                        {
                            Clipboard.SetText(userCode);
                        }
                        catch { }
                    }
                }

                if (IsHandleCreated && !IsDisposed)
                {
                    if (InvokeRequired)
                    {
                        BeginInvoke(new Action(ShowPrompt));
                    }
                    else
                    {
                        ShowPrompt();
                    }
                }
            };

            var result = await _cloudFlowCreator.CreateCloudFlowAsync(
                envId, flowName, _steps, _txtAppName.Text.Trim(), _txtAppPath.Text.Trim());

            if (result.Success)
            {
                // Auto-populate the Workflow ID in the GUI
                _txtPadWorkflowId.Text = result.WorkflowId;

                _lblStatus.Text = "Cloud Flow created ✅ — Workflow ID: " + result.WorkflowId;
                _lblStatus.ForeColor = Color.Green;

                string successMsg = "Cloud Flow created successfully!\n\n" +
                    "Flow Name: " + flowName + "\n" +
                    "Workflow ID: " + result.WorkflowId + "\n" +
                    "Environment ID: " + result.EnvironmentId;

                if (!string.IsNullOrEmpty(result.HttpTriggerUrl))
                {
                    successMsg += "\n\nHTTP Trigger URL:\n" + result.HttpTriggerUrl;

                    // Copy trigger URL to clipboard
                    try
                    {
                        Clipboard.SetText(result.HttpTriggerUrl);
                        successMsg += "\n\n(URL copied to clipboard)";
                    }
                    catch { }
                }

                successMsg += "\n\nThe Workflow ID has been auto-populated in the GUI.\n" +
                    "Click 'Run Test' to execute the flow via protocol URI.";

                MessageBox.Show(successMsg, "Cloud Flow Created", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
            else
            {
                _lblStatus.Text = "Cloud Flow creation failed ❌";
                _lblStatus.ForeColor = Color.Red;

                MessageBox.Show(
                    "Failed to create Cloud Flow.\n\n" +
                    "Error: " + result.ErrorMessage + "\n\n" +
                    (string.IsNullOrEmpty(result.RawResponse) ? "" : "Response:\n" + result.RawResponse),
                    "Cloud Flow Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }
        catch (Exception ex)
        {
            _lblStatus.Text = "Cloud Flow error: " + ex.Message;
            _lblStatus.ForeColor = Color.Red;
            MessageBox.Show("Error: " + ex.Message, "Cloud Flow Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
        finally
        {
            _btnCreateCloudFlow.Enabled = true;
            _btnRunTest.Enabled = true;
            _btnStart.Enabled = true;
        }
    }

    /// <summary>
    /// Creates a Power Automate Desktop Flow via Dataverse Web API using the recorded Robin script.
    /// </summary>

 private async void BtnCreateDesktopFlow_Click(object sender, EventArgs e)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(_txtPadWorkflowId.Text))
                {
                    MessageBox.Show("Please enter PAD Flow ID");
                    return;
                }

                if (string.IsNullOrWhiteSpace(_txtDataverseOrgUrl.Text))
                {
                    MessageBox.Show("Please enter Dataverse URL");
                    return;
                }

                if (!Guid.TryParse(_txtPadWorkflowId.Text, out Guid flowId))
                {
                    MessageBox.Show("Invalid Flow ID");
                    return;
                }

                _lblStatus.Text = "Generating ROBIN script...";

                // ✅ Generate ROBIN script
                var writer = new RobinScriptWriter();
                string robinScript = writer.WriteScript(_steps, _txtAppName.Text, _txtAppPath.Text);

                _lblStatus.Text = "Authenticating with Microsoft...";

                // ✅ Get Access Token
                string accessToken = await GetAccessTokenAsync();

                _lblStatus.Text = "Updating Desktop Flow...";

                // ✅ Update existing flow
                var updater = new DesktopFlowUpdater(_txtDataverseOrgUrl.Text, accessToken);

                await updater.UpdateDesktopFlowAsync(flowId, robinScript);

                _lblStatus.Text = "Flow updated successfully";

                MessageBox.Show("✅ Desktop Flow Updated Successfully!");
            }
            catch (Exception ex)
            {
                _lblStatus.Text = "Error";
                MessageBox.Show("❌ Error:\n" + ex.Message);
            }
        }

        // 🔥 MSAL TOKEN GENERATION (WORKING FOR DATAVERSE)
        private async Task<string> GetAccessTokenAsync()
        {
            string clientId = "51f81489-12ee-4a9e-aaae-a2591f45987d"; // Microsoft public client

            var app = PublicClientApplicationBuilder
                .Create(clientId)
                .WithAuthority("https://login.microsoftonline.com/organizations")
                .WithRedirectUri("http://localhost")
                .Build();

            string[] scopes = new[]
            {
                $"{_txtDataverseOrgUrl.Text}/.default"
            };

            var result = await app.AcquireTokenInteractive(scopes).ExecuteAsync();

            return result.AccessToken;
        }


    private void ShowPadDiagnosticsDialog(PadExecutionResult result)
    {
        var diagForm = new Form
        {
            Text = "PAD Execution Diagnostics",
            Size = new Size(900, 620),
            StartPosition = FormStartPosition.CenterParent,
            MinimumSize = new Size(700, 400),
        };

        var mainLayout = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 1,
            RowCount = 3,
            Padding = new Padding(10),
        };
        mainLayout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        mainLayout.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        mainLayout.RowStyles.Add(new RowStyle(SizeType.AutoSize));

        // Summary header
        var summaryPanel = new FlowLayoutPanel { Dock = DockStyle.Fill, AutoSize = true, FlowDirection = FlowDirection.LeftToRight, WrapContents = true };
        var lblOutcome = new Label
        {
            Text = result.Success ? "✅ EXECUTION PASSED" : "❌ EXECUTION FAILED",
            Font = new Font(Font.FontFamily, 12, FontStyle.Bold),
            ForeColor = result.Success ? Color.FromArgb(22, 163, 74) : Color.FromArgb(220, 38, 38),
            AutoSize = true,
            Padding = new Padding(0, 0, 20, 4),
        };
        var lblDuration = new Label
        {
            Text = "Total Duration: " + result.DurationMs + " ms",
            AutoSize = true,
            Padding = new Padding(0, 4, 20, 4),
        };
        var lblStrategies = new Label
        {
            Text = "Strategies Attempted: " + result.DiagnosticLog.Count,
            AutoSize = true,
            Padding = new Padding(0, 4, 0, 4),
        };
        summaryPanel.Controls.Add(lblOutcome);
        summaryPanel.Controls.Add(lblDuration);
        summaryPanel.Controls.Add(lblStrategies);
        mainLayout.Controls.Add(summaryPanel, 0, 0);

        // Diagnostics grid
        var dgv = new DataGridView
        {
            Dock = DockStyle.Fill,
            AllowUserToAddRows = false,
            AllowUserToDeleteRows = false,
            ReadOnly = true,
            AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill,
            SelectionMode = DataGridViewSelectionMode.FullRowSelect,
            MultiSelect = false,
            RowHeadersVisible = false,
            BackgroundColor = SystemColors.Window,
            BorderStyle = BorderStyle.Fixed3D,
            AllowUserToResizeRows = true,
        };

        dgv.Columns.Add(new DataGridViewTextBoxColumn { Name = "Idx", HeaderText = "#", FillWeight = 3 });
        dgv.Columns.Add(new DataGridViewTextBoxColumn { Name = "Strategy", HeaderText = "Strategy", FillWeight = 18 });
        dgv.Columns.Add(new DataGridViewTextBoxColumn { Name = "FlowName", HeaderText = "Flow Name", FillWeight = 12 });
        dgv.Columns.Add(new DataGridViewTextBoxColumn { Name = "Command", HeaderText = "Command", FillWeight = 12 });
        dgv.Columns.Add(new DataGridViewTextBoxColumn { Name = "Arguments", HeaderText = "Arguments", FillWeight = 16 });
        dgv.Columns.Add(new DataGridViewTextBoxColumn { Name = "ExitCode", HeaderText = "Exit", FillWeight = 4 });
        dgv.Columns.Add(new DataGridViewTextBoxColumn { Name = "Duration", HeaderText = "Duration (ms)", FillWeight = 8 });
        dgv.Columns.Add(new DataGridViewTextBoxColumn { Name = "Result", HeaderText = "Result", FillWeight = 5 });
        dgv.Columns.Add(new DataGridViewTextBoxColumn { Name = "Error", HeaderText = "Error / Message", FillWeight = 20 });

        for (int i = 0; i < result.DiagnosticLog.Count; i++)
        {
            var entry = result.DiagnosticLog[i];
            int rowIdx = dgv.Rows.Add(
                (i + 1).ToString(),
                entry.Strategy,
                entry.FlowName,
                TruncateForGrid(entry.Command, 60),
                TruncateForGrid(entry.Arguments, 80),
                entry.ExitCode.ToString(),
                entry.DurationMs.ToString(),
                entry.Succeeded ? "✅ Pass" : "❌ Fail",
                TruncateForGrid(entry.ErrorMessage, 120)
            );

            dgv.Rows[rowIdx].DefaultCellStyle.BackColor = entry.Succeeded
                ? Color.FromArgb(220, 252, 231)
                : Color.FromArgb(254, 226, 226);
        }

        mainLayout.Controls.Add(dgv, 0, 1);

        // Detail text area (shown when a row is selected)
        var txtDetail = new TextBox
        {
            Dock = DockStyle.Fill,
            Multiline = true,
            ReadOnly = true,
            ScrollBars = ScrollBars.Both,
            Font = new Font("Consolas", 9),
            Height = 160,
            BackColor = Color.FromArgb(30, 30, 30),
            ForeColor = Color.FromArgb(212, 212, 212),
        };

        dgv.SelectionChanged += (_, _) =>
        {
            if (dgv.SelectedRows.Count == 0) return;
            int idx = dgv.SelectedRows[0].Index;
            if (idx < 0 || idx >= result.DiagnosticLog.Count) return;
            var entry = result.DiagnosticLog[idx];
            var sb = new StringBuilder();
            sb.AppendLine("═══ PAD Diagnostic Detail ═══");
            sb.AppendLine("Strategy:   " + entry.Strategy);
            sb.AppendLine("Flow Name:  " + entry.FlowName);
            sb.AppendLine("Command:    " + entry.Command);
            sb.AppendLine("Arguments:  " + entry.Arguments);
            sb.AppendLine("Exit Code:  " + entry.ExitCode);
            sb.AppendLine("Duration:   " + entry.DurationMs + " ms");
            sb.AppendLine("Timestamp:  " + entry.Timestamp.ToString("yyyy-MM-dd HH:mm:ss.fff") + " UTC");
            sb.AppendLine("Result:     " + (entry.Succeeded ? "PASSED" : "FAILED"));
            sb.AppendLine();
            if (!string.IsNullOrWhiteSpace(entry.ErrorMessage))
            {
                sb.AppendLine("── Error ──");
                sb.AppendLine(entry.ErrorMessage);
                sb.AppendLine();
            }
            if (!string.IsNullOrWhiteSpace(entry.Stdout))
            {
                sb.AppendLine("── Standard Output ──");
                sb.AppendLine(entry.Stdout);
                sb.AppendLine();
            }
            if (!string.IsNullOrWhiteSpace(entry.Stderr))
            {
                sb.AppendLine("── Standard Error ──");
                sb.AppendLine(entry.Stderr);
            }
            txtDetail.Text = sb.ToString();
        };

        var detailGroup = new GroupBox { Text = "Selected Attempt — Full Output", Dock = DockStyle.Fill, Height = 180 };
        detailGroup.Controls.Add(txtDetail);
        mainLayout.Controls.Add(detailGroup, 0, 2);
        mainLayout.RowStyles[2] = new RowStyle(SizeType.Absolute, 180);

        // Auto-select first row to populate detail
        diagForm.Controls.Add(mainLayout);
        diagForm.Shown += (_, _) =>
        {
            if (dgv.Rows.Count > 0) dgv.Rows[0].Selected = true;
        };

        diagForm.ShowDialog(this);
    }

    private static string TruncateForGrid(string value, int maxLen)
    {
        if (string.IsNullOrEmpty(value)) return "";
        string singleLine = value.Replace("\r\n", " ").Replace("\n", " ");
        if (singleLine.Length <= maxLen) return singleLine;
        return singleLine.Substring(0, maxLen - 3) + "...";
    }

    /// <summary>
    /// Creates the embedded PAD diagnostics panel docked at the bottom of the right panel.
    /// </summary>
    private void CreatePadDiagnosticsPanel()
    {
        _padDiagPanel = new Panel
        {
            Dock = DockStyle.Bottom,
            Height = 220,
            Visible = false,
            BorderStyle = BorderStyle.FixedSingle,
        };

        var headerPanel = new Panel { Dock = DockStyle.Top, Height = 28, BackColor = Color.FromArgb(30, 41, 59) };
        var lblHeader = new Label
        {
            Text = "🔍 PAD Execution Diagnostics",
            ForeColor = Color.White,
            Font = new Font(Font.FontFamily, 9, FontStyle.Bold),
            AutoSize = true,
            Padding = new Padding(6, 4, 0, 0),
            Dock = DockStyle.Left,
        };
        var btnCloseDiag = new Button
        {
            Text = "✕",
            Width = 28,
            Height = 28,
            Dock = DockStyle.Right,
            FlatStyle = FlatStyle.Flat,
            ForeColor = Color.White,
            BackColor = Color.FromArgb(30, 41, 59),
        };
        btnCloseDiag.FlatAppearance.BorderSize = 0;
        btnCloseDiag.Click += (_, _) =>
        {
            _padDiagPanel.Visible = false;
            _btnShowDiagnostics.Text = "🔍 PAD Diagnostics";
        };
        headerPanel.Controls.Add(lblHeader);
        headerPanel.Controls.Add(btnCloseDiag);

        var splitDiag = new SplitContainer
        {
            Dock = DockStyle.Fill,
            Orientation = Orientation.Vertical,
            SplitterDistance = 400,
        };

        _dgvDiagnostics = new DataGridView
        {
            Dock = DockStyle.Fill,
            AllowUserToAddRows = false,
            AllowUserToDeleteRows = false,
            ReadOnly = true,
            AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill,
            SelectionMode = DataGridViewSelectionMode.FullRowSelect,
            MultiSelect = false,
            RowHeadersVisible = false,
            BackgroundColor = SystemColors.Window,
            BorderStyle = BorderStyle.None,
        };
        _dgvDiagnostics.Columns.Add(new DataGridViewTextBoxColumn { Name = "DIdx", HeaderText = "#", FillWeight = 3 });
        _dgvDiagnostics.Columns.Add(new DataGridViewTextBoxColumn { Name = "DStrategy", HeaderText = "Strategy", FillWeight = 20 });
        _dgvDiagnostics.Columns.Add(new DataGridViewTextBoxColumn { Name = "DFlowName", HeaderText = "Flow Name", FillWeight = 12 });
        _dgvDiagnostics.Columns.Add(new DataGridViewTextBoxColumn { Name = "DExitCode", HeaderText = "Exit", FillWeight = 4 });
        _dgvDiagnostics.Columns.Add(new DataGridViewTextBoxColumn { Name = "DDuration", HeaderText = "Duration", FillWeight = 7 });
        _dgvDiagnostics.Columns.Add(new DataGridViewTextBoxColumn { Name = "DResult", HeaderText = "Result", FillWeight = 5 });
        _dgvDiagnostics.Columns.Add(new DataGridViewTextBoxColumn { Name = "DError", HeaderText = "Error / Message", FillWeight = 22 });

        _txtDiagDetail = new TextBox
        {
            Dock = DockStyle.Fill,
            Multiline = true,
            ReadOnly = true,
            ScrollBars = ScrollBars.Both,
            Font = new Font("Consolas", 8.5f),
            BackColor = Color.FromArgb(30, 30, 30),
            ForeColor = Color.FromArgb(212, 212, 212),
            WordWrap = false,
        };

        _dgvDiagnostics.SelectionChanged += (_, _) =>
        {
            if (_lastPadResult == null || _dgvDiagnostics.SelectedRows.Count == 0) return;
            int idx = _dgvDiagnostics.SelectedRows[0].Index;
            if (idx < 0 || idx >= _lastPadResult.DiagnosticLog.Count) return;
            var entry = _lastPadResult.DiagnosticLog[idx];
            var sb = new StringBuilder();
            sb.AppendLine("Strategy:   " + entry.Strategy);
            sb.AppendLine("Flow Name:  " + entry.FlowName);
            sb.AppendLine("Command:    " + entry.Command);
            sb.AppendLine("Arguments:  " + entry.Arguments);
            sb.AppendLine("Exit Code:  " + entry.ExitCode);
            sb.AppendLine("Duration:   " + entry.DurationMs + " ms");
            sb.AppendLine("Result:     " + (entry.Succeeded ? "PASSED" : "FAILED"));
            sb.AppendLine("Timestamp:  " + entry.Timestamp.ToString("yyyy-MM-dd HH:mm:ss.fff") + " UTC");
            if (!string.IsNullOrWhiteSpace(entry.ErrorMessage))
            {
                sb.AppendLine();
                sb.AppendLine("── Error ──");
                sb.AppendLine(entry.ErrorMessage);
            }
            if (!string.IsNullOrWhiteSpace(entry.Stdout))
            {
                sb.AppendLine();
                sb.AppendLine("── stdout ──");
                sb.AppendLine(entry.Stdout);
            }
            if (!string.IsNullOrWhiteSpace(entry.Stderr))
            {
                sb.AppendLine();
                sb.AppendLine("── stderr ──");
                sb.AppendLine(entry.Stderr);
            }
            _txtDiagDetail.Text = sb.ToString();
        };

        splitDiag.Panel1.Controls.Add(_dgvDiagnostics);
        splitDiag.Panel2.Controls.Add(_txtDiagDetail);

        _padDiagPanel.Controls.Add(splitDiag);
        _padDiagPanel.Controls.Add(headerPanel);
    }

    /// <summary>
    /// Populates the embedded diagnostics grid with execution log entries.
    /// </summary>
    private void PopulatePadDiagnostics(PadExecutionResult result)
    {
        _dgvDiagnostics.Rows.Clear();
        _txtDiagDetail.Text = "";

        for (int i = 0; i < result.DiagnosticLog.Count; i++)
        {
            var entry = result.DiagnosticLog[i];
            int rowIdx = _dgvDiagnostics.Rows.Add(
                (i + 1).ToString(),
                entry.Strategy,
                entry.FlowName,
                entry.ExitCode.ToString(),
                entry.DurationMs + " ms",
                entry.Succeeded ? "✅ Pass" : "❌ Fail",
                TruncateForGrid(entry.ErrorMessage, 100)
            );
            _dgvDiagnostics.Rows[rowIdx].DefaultCellStyle.BackColor = entry.Succeeded
                ? Color.FromArgb(220, 252, 231)
                : Color.FromArgb(254, 226, 226);
        }

        if (_dgvDiagnostics.Rows.Count > 0)
            _dgvDiagnostics.Rows[0].Selected = true;
    }

    /// <summary>
    /// Toggles the embedded PAD diagnostics panel visibility.
    /// </summary>
    private void TogglePadDiagnosticsPanel()
    {
        if (_padDiagPanel.Visible)
        {
            _padDiagPanel.Visible = false;
            _btnShowDiagnostics.Text = "🔍 PAD Diagnostics";
        }
        else
        {
            _padDiagPanel.Visible = true;
            _btnShowDiagnostics.Text = "🔍 Hide Diagnostics";
            if (_lastPadResult != null)
                PopulatePadDiagnostics(_lastPadResult);
        }
    }

    #endregion

    #region Run Test (Dry Run)

    private async void BtnRunTest_Click(object? sender, EventArgs e)
    {
        // PAD mode: execute via PAD CLI
        string engineMode = _cmbEngineMode.SelectedItem?.ToString() ?? "uia";
        if (engineMode == "pad")
        {
            if (_steps.Count == 0)
            {
                MessageBox.Show("No steps to run. Import a PAD flow first.", "Info", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }
            RunTestViaPad();
            return;
        }

        if (_steps.Count == 0)
        {
            MessageBox.Show("No steps to run. Record or add steps first.", "Info", MessageBoxButtons.OK, MessageBoxIcon.Information);
            return;
        }
        if (_isRecording)
        {
            MessageBox.Show("Stop recording before running the test.", "Info", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }
        if (string.IsNullOrWhiteSpace(_txtAppPath.Text))
        {
            MessageBox.Show("Application Path is required to run the test.", "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return;
        }

        var confirm = MessageBox.Show(
            "Run the recorded " + _steps.Count + " steps against the application?\n\nThe target application will be launched/attached and steps will be executed sequentially.",
            "Confirm Test Run", MessageBoxButtons.YesNo, MessageBoxIcon.Question);
        if (confirm != DialogResult.Yes) return;

        // Build steps JSON from current grid
        var stepsArray = new JsonArray();
        foreach (var s in _steps)
        {
            var stepObj = new JsonObject
            {
                ["action"] = s.Action,
                ["value"] = s.Value,
                ["target"] = new JsonObject
                {
                    ["automationId"] = s.AutomationId,
                    ["label"] = s.Label,
                    ["controlType"] = s.ControlType,
                    ["classHint"] = s.ClassHint,
                    ["parentWindow"] = s.ParentWindow,
                },
            };
            if (!string.IsNullOrEmpty(s.JabRole))
                stepObj["jabRole"] = s.JabRole;
            if (!string.IsNullOrEmpty(s.JabSelector))
                stepObj["jabSelector"] = s.JabSelector;
            if (!string.IsNullOrEmpty(s.WindowSelector))
                stepObj["windowSelector"] = s.WindowSelector;
            // Include vision data for execution
            if (!string.IsNullOrEmpty(s.VisionScreenshot))
            {
                stepObj["visionScreenshot"] = s.VisionScreenshot;
                if (s.VisionBoundsW > 0 || s.VisionBoundsH > 0)
                {
                    stepObj["visionBounds"] = new JsonObject
                    {
                        ["x"] = s.VisionBoundsX, ["y"] = s.VisionBoundsY,
                        ["width"] = s.VisionBoundsW, ["height"] = s.VisionBoundsH,
                    };
                }
            }
            stepsArray.Add(stepObj);
        }

        // Create a local-only DesktopJob for execution
        var dryRunJob = new DesktopJob
        {
            Id = "dryrun-" + Guid.NewGuid().ToString("N")[..8],
            ApplicationPath = _txtAppPath.Text.Trim(),
            ApplicationArgs = _txtAppArgs.Text.Trim(),
            EngineMode = _cmbEngineMode.SelectedItem?.ToString() ?? "uia",
            Steps = stepsArray,
            IsRecordJob = false,
        };

        // Use a no-op API client that doesn't actually call the server
        var dryRunApi = new DryRunApiClient();
        var executor = new TestExecutor(dryRunApi, dryRunJob);
        var cts = new CancellationTokenSource();

        // Disable UI during execution
        _btnRunTest.Enabled = false;
        _btnStart.Enabled = false;
        _btnSave.Enabled = false;
        _btnDiscard.Enabled = false;
        _lblStatus.Text = "Running test...";
        _lblStatus.ForeColor = Color.FromArgb(168, 85, 247);

        try
        {
            await Task.Run(() => executor.RunAsync(cts.Token), cts.Token);

            // Retrieve results from the dry-run client
            var results = dryRunApi.CapturedResults;
            if (results != null)
            {
                ShowDryRunResults(results);
            }
            else
            {
                _lblStatus.Text = "Test run completed (no results captured).";
                _lblStatus.ForeColor = Color.DarkOrange;
            }
        }
        catch (Exception ex)
        {
            _lblStatus.Text = "Test run failed: " + ex.Message;
            _lblStatus.ForeColor = Color.Red;
            MessageBox.Show("Test run error: " + ex.Message, "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
        finally
        {
            _btnRunTest.Enabled = true;
            _btnStart.Enabled = true;
            _btnSave.Enabled = true;
            _btnDiscard.Enabled = true;
        }
    }

    private void ShowDryRunResults(DryRunResults results)
    {
        var statusText = results.Status == "passed" ? "PASSED ✅" : "FAILED ❌";
        _lblStatus.Text = "Test " + statusText + " — " + results.Passed + "/" + results.TotalSteps + " passed in " + results.DurationMs + "ms";
        _lblStatus.ForeColor = results.Status == "passed" ? Color.Green : Color.Red;

        // Highlight failed steps in the grid
        for (int i = 0; i < _dgvSteps.Rows.Count && i < results.StepStatuses.Count; i++)
        {
            var stepStatus = results.StepStatuses[i];
            if (stepStatus == "passed")
            {
                _dgvSteps.Rows[i].DefaultCellStyle.BackColor = Color.FromArgb(220, 252, 231);
            }
            else
            {
                _dgvSteps.Rows[i].DefaultCellStyle.BackColor = Color.FromArgb(254, 226, 226);
            }
        }

        // Show detailed results dialog
        var sb = new StringBuilder();
        sb.AppendLine("Test Run Results: " + statusText);
        sb.AppendLine("Duration: " + results.DurationMs + " ms");
        sb.AppendLine("Steps: " + results.Passed + " passed, " + results.Failed + " failed out of " + results.TotalSteps);
        sb.AppendLine();

        for (int i = 0; i < results.StepDetails.Count; i++)
        {
            var detail = results.StepDetails[i];
            var icon = detail.Status == "passed" ? "✅" : "❌";
            sb.AppendLine(icon + " Step " + (i + 1) + ": " + detail.Action + " → " + detail.Target);
            if (!string.IsNullOrEmpty(detail.Error))
                sb.AppendLine("   Error: " + detail.Error);
        }

        var resultForm = new Form
        {
            Text = "Test Run Results — " + statusText,
            Size = new Size(650, 450),
            StartPosition = FormStartPosition.CenterParent,
            MinimumSize = new Size(400, 300),
        };
        var txtResults = new TextBox
        {
            Dock = DockStyle.Fill,
            Multiline = true,
            ReadOnly = true,
            ScrollBars = ScrollBars.Both,
            Font = new Font("Consolas", 9),
            Text = sb.ToString(),
        };
        var btnClose = new Button
        {
            Text = "Close",
            Dock = DockStyle.Bottom,
            Height = 35,
        };
        btnClose.Click += (_, _) => resultForm.Close();
        resultForm.Controls.Add(txtResults);
        resultForm.Controls.Add(btnClose);
        resultForm.ShowDialog(this);
    }

    #endregion

    #region Save / Discard

    private async void BtnSave_Click(object? sender, EventArgs e)
    {
        if (_steps.Count == 0)
        {
            MessageBox.Show("No steps to save.", "Info", MessageBoxButtons.OK, MessageBoxIcon.Information);
            return;
        }
        if (string.IsNullOrWhiteSpace(_txtTestName.Text))
        {
            MessageBox.Show("Test Name is required.", "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return;
        }
        if (_apiClient == null)
        {
            if (string.IsNullOrWhiteSpace(_txtApiToken.Text))
            {
                MessageBox.Show("API Token is required to save.", "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }
            _apiClient = new ApiClient(_txtApiUrl.Text.Trim(), _txtApiToken.Text.Trim());
        }

        _btnSave.Enabled = false;
        _lblStatus.Text = "Saving...";

        try
        {
            var stepsArray = new JsonArray();
            foreach (var s in _steps)
            {
                var stepObj = new JsonObject
                {
                    ["action"] = s.Action,
                    ["value"] = s.Value,
                    ["target"] = new JsonObject
                    {
                        ["automationId"] = s.AutomationId,
                        ["label"] = s.Label,
                        ["controlType"] = s.ControlType,
                        ["classHint"] = s.ClassHint,
                        ["parentWindow"] = s.ParentWindow,
                    },
                };
                if (!string.IsNullOrEmpty(s.JabRole))
                    stepObj["jabRole"] = s.JabRole;
                if (!string.IsNullOrEmpty(s.JabDescription))
                    stepObj["jabDescription"] = s.JabDescription;
                if (!string.IsNullOrEmpty(s.JabSelector))
                    stepObj["jabSelector"] = s.JabSelector;
                if (!string.IsNullOrEmpty(s.WindowSelector))
                    stepObj["windowSelector"] = s.WindowSelector;

                // Include vision screenshot for hybrid/vision modes
                if (!string.IsNullOrEmpty(s.VisionScreenshot))
                {
                    stepObj["visionScreenshot"] = s.VisionScreenshot;
                    if (s.VisionBoundsW > 0 || s.VisionBoundsH > 0)
                    {
                        stepObj["visionBounds"] = new JsonObject
                        {
                            ["x"] = s.VisionBoundsX, ["y"] = s.VisionBoundsY,
                            ["width"] = s.VisionBoundsW, ["height"] = s.VisionBoundsH,
                        };
                    }
                }

                // Include OR-compatible metadata for Object Repository sync
                var orMeta = new JsonObject();
                if (!string.IsNullOrEmpty(s.FrameworkId))
                    orMeta["frameworkId"] = s.FrameworkId;
                if (!string.IsNullOrEmpty(s.HierarchyPath))
                    orMeta["hierarchyPath"] = s.HierarchyPath;
                if (!string.IsNullOrEmpty(s.SupportedPatterns))
                    orMeta["supportedPatterns"] = s.SupportedPatterns;
                if (s.BoundsW > 0 || s.BoundsH > 0)
                {
                    orMeta["boundingRectangle"] = new JsonObject
                    {
                        ["x"] = s.BoundsX, ["y"] = s.BoundsY,
                        ["width"] = s.BoundsW, ["height"] = s.BoundsH,
                    };
                }
                if (!string.IsNullOrEmpty(s.CurrentValue))
                    orMeta["currentValue"] = s.CurrentValue;
                if (!string.IsNullOrEmpty(s.ToggleState))
                    orMeta["toggleState"] = s.ToggleState;
                orMeta["isEnabled"] = s.IsEnabled;

                if (orMeta.Count > 1) // more than just isEnabled
                    stepObj["orMetadata"] = orMeta;

                stepsArray.Add(stepObj);
            }

            await _apiClient.SaveRecordedTest(
                _txtTestName.Text.Trim(),
                _txtTestDescription.Text.Trim(),
                _txtAppName.Text.Trim(),
                _txtAppPath.Text.Trim(),
                _cmbEngineMode.SelectedItem?.ToString() ?? "uia",
                stepsArray
            );

            _lblStatus.Text = "Test saved successfully!";
            _lblStatus.ForeColor = Color.Green;
            MessageBox.Show("Test saved to the platform.", "Success", MessageBoxButtons.OK, MessageBoxIcon.Information);
        }
        catch (Exception ex)
        {
            _lblStatus.Text = "Save failed: " + ex.Message;
            _lblStatus.ForeColor = Color.Red;
            MessageBox.Show("Failed to save: " + ex.Message, "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
        finally
        {
            _btnSave.Enabled = true;
        }
    }

    private void BtnDiscard_Click(object? sender, EventArgs e)
    {
        if (_steps.Count > 0)
        {
            var result = MessageBox.Show("Discard all recorded steps?", "Confirm", MessageBoxButtons.YesNo, MessageBoxIcon.Question);
            if (result != DialogResult.Yes) return;
        }
        _steps.Clear();
        _stepCounter = 0;
        RefreshGrid();
        _lblStepCount.Text = "0 steps";
        _lblStatus.Text = "Ready";
        _lblStatus.ForeColor = SystemColors.ControlText;
    }

    #endregion

    #region AI Step Generation

    private async void BtnAIGenerate_Click(object? sender, EventArgs e)
    {
        var manualSteps = _txtManualTestSteps.Text.Trim();
        if (string.IsNullOrEmpty(manualSteps))
        {
            MessageBox.Show("Please enter manual test steps.", "Info", MessageBoxButtons.OK, MessageBoxIcon.Information);
            return;
        }

        if (string.IsNullOrWhiteSpace(_txtApiToken.Text))
        {
            MessageBox.Show("API Token is required for AI generation.", "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return;
        }

        _btnAIGenerate.Enabled = false;
        _lblAIStatus.Text = "Generating automation steps with AI...";
        _lblAIStatus.ForeColor = Color.Blue;

        try
        {
            if (_apiClient == null)
                _apiClient = new ApiClient(_txtApiUrl.Text.Trim(), _txtApiToken.Text.Trim());

            var generatedSteps = await _apiClient.AIGenerateSteps(
                manualSteps,
                _txtAppName.Text.Trim(),
                _cmbEngineMode.SelectedItem?.ToString() ?? "uia"
            );

            if (generatedSteps != null)
            {
                foreach (var stepNode in generatedSteps)
                {
                    if (stepNode == null) continue;
                    var sObj = stepNode.AsObject();
                    _stepCounter++;
                    _steps.Add(new RecordedStep
                    {
                        StepNumber = _stepCounter,
                        Action = sObj["action"]?.GetValue<string>() ?? "click",
                        Label = sObj["target"]?["label"]?.GetValue<string>() ?? sObj["description"]?.GetValue<string>() ?? "",
                        AutomationId = sObj["target"]?["automationId"]?.GetValue<string>() ?? "",
                        ControlType = sObj["target"]?["controlType"]?.GetValue<string>() ?? "",
                        Value = sObj["value"]?.GetValue<string>() ?? "",
                        ParentWindow = sObj["target"]?["parentWindow"]?.GetValue<string>() ?? "",
                        ClassHint = sObj["target"]?["classHint"]?.GetValue<string>() ?? "",
                        JabRole = sObj["jabRole"]?.GetValue<string>() ?? "",
                    });
                }
                RefreshGrid();
                _lblStepCount.Text = _steps.Count + " steps";
                _lblAIStatus.Text = "Generated " + generatedSteps.Count + " steps. Review and edit before saving.";
                _lblAIStatus.ForeColor = Color.Green;
            }
            else
            {
                _lblAIStatus.Text = "AI returned no steps.";
                _lblAIStatus.ForeColor = Color.Red;
            }
        }
        catch (Exception ex)
        {
            _lblAIStatus.Text = "AI generation failed: " + ex.Message;
            _lblAIStatus.ForeColor = Color.Red;
        }
        finally
        {
            _btnAIGenerate.Enabled = true;
        }
    }

    #endregion

    #region Grid Helpers

    private void RefreshGrid()
    {
        _dgvSteps.Rows.Clear();
        for (int i = 0; i < _steps.Count; i++)
        {
            var s = _steps[i];
            s.StepNumber = i + 1;
             _dgvSteps.Rows.Add(s.StepNumber, s.Action, s.Label, s.AutomationId,
                s.ControlType, s.Value, s.ParentWindow, s.ClassHint,
                s.HierarchyPath, s.SupportedPatterns, s.JabRole,
                s.JabSelector, s.WindowSelector,
                string.IsNullOrEmpty(s.VisionScreenshot) ? "No" : "Yes",
                GetVisionBoundsLabel(s),
                s.PadSelector);
        }
    }

    private static string GetVisionBoundsLabel(RecordedStep step)
    {
        if (string.IsNullOrEmpty(step.VisionScreenshot))
            return "";

        if (step.VisionBoundsW <= 0 && step.VisionBoundsH <= 0)
            return "captured";

        return $"x:{step.VisionBoundsX:0}, y:{step.VisionBoundsY:0}, w:{step.VisionBoundsW:0}, h:{step.VisionBoundsH:0}";
    }

    private void DgvSteps_CellValueChanged(object? sender, DataGridViewCellEventArgs e)
    {
        if (e.RowIndex < 0 || e.RowIndex >= _steps.Count) return;
        var s = _steps[e.RowIndex];
        var col = _dgvSteps.Columns[e.ColumnIndex].Name;
        var val = _dgvSteps.Rows[e.RowIndex].Cells[e.ColumnIndex].Value?.ToString() ?? "";

        switch (col)
        {
            case "Action": s.Action = val; break;
            case "Label": s.Label = val; break;
            case "AutomationId": s.AutomationId = val; break;
            case "ControlType": s.ControlType = val; break;
            case "Value": s.Value = val; break;
            case "ParentWindow": s.ParentWindow = val; break;
            case "ClassHint": s.ClassHint = val; break;
            case "HierarchyPath": s.HierarchyPath = val; break;
            case "Patterns": s.SupportedPatterns = val; break;
            case "JabRole": s.JabRole = val; break;
            case "JabSelector": s.JabSelector = val; break;
            case "WindowSelector": s.WindowSelector = val; break;
            case "PadSelector": s.PadSelector = val; break;
        }
    }

    private void AddManualStep()
    {
        _stepCounter++;
        _steps.Add(new RecordedStep
        {
            StepNumber = _stepCounter,
            Action = "click",
            ControlType = "Button",
        });
        RefreshGrid();
        _lblStepCount.Text = _steps.Count + " steps";
    }

    private void MoveSelectedStep(int direction)
    {
        if (_dgvSteps.CurrentRow == null) return;
        int idx = _dgvSteps.CurrentRow.Index;
        int newIdx = idx + direction;
        if (newIdx < 0 || newIdx >= _steps.Count) return;

        var temp = _steps[idx];
        _steps[idx] = _steps[newIdx];
        _steps[newIdx] = temp;
        RefreshGrid();
        _dgvSteps.CurrentCell = _dgvSteps.Rows[newIdx].Cells[0];
    }

    private void DeleteSelectedStep()
    {
        if (_dgvSteps.CurrentRow == null) return;
        int idx = _dgvSteps.CurrentRow.Index;
        if (idx >= 0 && idx < _steps.Count)
        {
            _steps.RemoveAt(idx);
            RefreshGrid();
            _lblStepCount.Text = _steps.Count + " steps";
        }
    }

    #endregion
}

/// <summary>Represents a single recorded step in the local grid with OR-compatible metadata.</summary>
public class RecordedStep
{
    public int StepNumber { get; set; }
    public string Action { get; set; } = "";
    public string Label { get; set; } = "";
    public string AutomationId { get; set; } = "";
    public string ControlType { get; set; } = "";
    public string Value { get; set; } = "";
    public string ParentWindow { get; set; } = "";
    public string ClassHint { get; set; } = "";
    public string JabRole { get; set; } = "";
    public string JabDescription { get; set; } = "";
    public string JabSelector { get; set; } = "";
    public string WindowSelector { get; set; } = "";
    public string? OrElementId { get; set; }
    public string PadSelector { get; set; } = "";

    // OR-compatible enriched metadata
    public string FrameworkId { get; set; } = "";
    public string HierarchyPath { get; set; } = "";
    public bool IsEnabled { get; set; } = true;
    public string SupportedPatterns { get; set; } = "";
    public double BoundsX { get; set; }
    public double BoundsY { get; set; }
    public double BoundsW { get; set; }
    public double BoundsH { get; set; }
    public string CurrentValue { get; set; } = "";
    public string ToggleState { get; set; } = "";

    // Vision-based selector data (captured screenshot of element)
    public string? VisionScreenshot { get; set; }
    public double VisionBoundsX { get; set; }
    public double VisionBoundsY { get; set; }
    public double VisionBoundsW { get; set; }
    public double VisionBoundsH { get; set; }
}

/// <summary>
/// A no-op ApiClient subclass that captures execution results locally
/// without making any HTTP calls. Used for dry-run test execution in the recorder.
/// </summary>
public class DryRunApiClient : ApiClient
{
    public DryRunResults? CapturedResults { get; private set; }

    public DryRunApiClient() : base("http://localhost/noop", "dryrun") { }

    public override Task SendHeartbeat() => Task.CompletedTask;
    public override Task NotifyStart(string jobId) => Task.CompletedTask;

    public override Task SubmitResults(string jobId, string status, int totalSteps,
        int passedSteps, int failedSteps, long durationMs, JsonArray? stepResults,
        string? errorMessage = null, string? failureCategory = null, string? engineMode = null)
    {
        var results = new DryRunResults
        {
            Status = status,
            TotalSteps = totalSteps,
            Passed = passedSteps,
            Failed = failedSteps,
            DurationMs = durationMs,
            ErrorMessage = errorMessage,
        };

        if (stepResults != null)
        {
            foreach (var sr in stepResults)
            {
                if (sr == null) continue;
                var obj = sr.AsObject();
                var stepStatus = obj["status"]?.GetValue<string>() ?? "unknown";
                results.StepStatuses.Add(stepStatus);
                results.StepDetails.Add(new DryRunStepDetail
                {
                    Action = obj["action"]?.GetValue<string>() ?? "",
                    Target = obj["target"]?.GetValue<string>() ?? "",
                    Status = stepStatus,
                    Error = obj["error"]?.GetValue<string>() ?? "",
                    DurationMs = obj["duration_ms"]?.GetValue<long>() ?? 0,
                });
            }
        }

        CapturedResults = results;
        return Task.CompletedTask;
    }
}

/// <summary>Captured results from a dry-run test execution.</summary>
public class DryRunResults
{
    public string Status { get; set; } = "";
    public int TotalSteps { get; set; }
    public int Passed { get; set; }
    public int Failed { get; set; }
    public long DurationMs { get; set; }
    public string? ErrorMessage { get; set; }
    public List<string> StepStatuses { get; set; } = new();
    public List<DryRunStepDetail> StepDetails { get; set; } = new();
}

/// <summary>Detail for a single step in a dry-run execution.</summary>
public class DryRunStepDetail
{
    public string Action { get; set; } = "";
    public string Target { get; set; } = "";
    public string Status { get; set; } = "";
    public string Error { get; set; } = "";
    public long DurationMs { get; set; }
}
