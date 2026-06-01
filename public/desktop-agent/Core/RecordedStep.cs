using System;

namespace WisprDesktopAgent.Core;

/// <summary>Represents a single recorded step with OR-compatible metadata.</summary>
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
    public string PadAction { get; set; } = "";

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

    // Vision-based selector data
    public string? VisionScreenshot { get; set; }
    public double VisionBoundsX { get; set; }
    public double VisionBoundsY { get; set; }
    public double VisionBoundsW { get; set; }
    public double VisionBoundsH { get; set; }
}
