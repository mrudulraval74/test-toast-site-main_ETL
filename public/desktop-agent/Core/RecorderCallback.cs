using System.Text.Json.Nodes;

namespace WisprDesktopAgent.Core;

/// <summary>
/// Interface for receiving captured recording steps locally.
/// Implemented by the standalone RecorderApp for dual-write
/// (local UI + API submission).
/// </summary>
public interface IRecorderStepSink
{
    /// <summary>Called for each recorded step. Invoked from background threads.</summary>
    void OnStepCaptured(JsonObject step);
}
