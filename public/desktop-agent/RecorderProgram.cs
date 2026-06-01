using System;
using System.Windows.Forms;
using WisprDesktopAgent.Core;

namespace WisprDesktopAgent;

/// <summary>
/// Dedicated recorder-only entry point that always launches the WinForms GUI.
/// Build this project to get a standalone clickable recorder executable.
/// </summary>
class RecorderProgram
{
    [STAThread]
    static void Main(string[] args)
    {
        Logger.Info("Launching WISPR Desktop Recorder...");
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new RecorderApp());
    }
}
