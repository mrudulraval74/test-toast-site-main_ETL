using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace WisprDesktopAgent.Core;

/// <summary>
/// Parses Power Automate Desktop .robin script files into WISPR RecordedStep format.
/// Handles UIAutomation actions, MouseAndKeyboard actions, and System actions.
/// Extracts PAD selectors and maps them to WISPR selector format.
/// </summary>
public class RobinScriptParser
{
    /// <summary>
    /// Parses a .robin script file and returns a list of RecordedStep objects.
    /// </summary>
    public List<ParsedPadStep> ParseFile(string filePath)
    {
        if (!File.Exists(filePath))
            throw new FileNotFoundException("Robin script file not found: " + filePath);

        string content = File.ReadAllText(filePath, Encoding.UTF8);
        return ParseContent(content);
    }

    /// <summary>
    /// Parses .robin script content and returns a list of parsed steps.
    /// </summary>
    public List<ParsedPadStep> ParseContent(string content)
    {
        var steps = new List<ParsedPadStep>();
        var uiElements = new Dictionary<string, PadUIElement>();

        string[] lines = content.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);

        // First pass: extract UI element definitions
        for (int i = 0; i < lines.Length; i++)
        {
            string line = lines[i].Trim();
            if (line.StartsWith("# [ControlRepository]") || line.StartsWith("ELEMENT "))
            {
                // Parse element definition block
                var element = TryParseElementDefinition(lines, ref i);
                if (element != null && !string.IsNullOrEmpty(element.Name))
                {
                    uiElements[element.Name] = element;
                }
            }
        }

        // Second pass: extract actions
        for (int i = 0; i < lines.Length; i++)
        {
            string line = lines[i].Trim();
            if (string.IsNullOrEmpty(line) || line.StartsWith("#") || line.StartsWith("ELEMENT "))
                continue;

            var step = TryParseAction(line, uiElements);
            if (step != null)
            {
                steps.Add(step);
            }
        }

        return steps;
    }

    /// <summary>
    /// Tries to parse a .robin element definition block.
    /// </summary>
    private PadUIElement TryParseElementDefinition(string[] lines, ref int index)
    {
        var element = new PadUIElement();
        string line = lines[index].Trim();

        // Format: ELEMENT elementName @'selector string'
        var match = Regex.Match(line, @"ELEMENT\s+(\w+)");
        if (match.Success)
        {
            element.Name = match.Groups[1].Value;

            if (TryExtractAtQuotedValue(line, out var selector))
            {
                element.Selector = selector;
                ParsePadSelector(element);
                return element;
            }

            // Alternative format: multi-line element with selector on next line
            if (index + 1 < lines.Length)
            {
                string nextLine = lines[index + 1].Trim();
                if (TryExtractAtQuotedValue(nextLine, out selector))
                {
                    element.Selector = selector;
                    index++;
                    ParsePadSelector(element);
                }
            }

            return element;
        }

        return null;
    }

    /// <summary>
    /// Parses a PAD selector string into structured components.
    /// PAD format: :desktop > window[Name="App"][Process="app.exe"] > button[Name="Login"]
    /// </summary>
    private void ParsePadSelector(PadUIElement element)
    {
        if (string.IsNullOrEmpty(element.Selector)) return;

        string selector = element.Selector;

        // Extract segments separated by " > "
        string[] segments = selector.Split(new[] { " > " }, StringSplitOptions.RemoveEmptyEntries);

        var hierarchyParts = new List<string>();
        for (int i = 0; i < segments.Length; i++)
        {
            string seg = segments[i].Trim();
            if (seg == ":desktop") continue;

            hierarchyParts.Add(seg);

            // Extract attributes from this segment
            string controlType = ExtractControlTypeFromSegment(seg);
            string name = ExtractAttributeValue(seg, "Name");
            string process = ExtractAttributeValue(seg, "Process");
            string automationId = ExtractAttributeValue(seg, "AutomationId");
            string className = ExtractAttributeValue(seg, "Class");

            // The last segment is the target element
            if (i == segments.Length - 1)
            {
                element.ControlType = MapPadControlType(controlType);
                element.ElementName = name;
                element.AutomationId = automationId;
                element.ClassName = className;
            }
            // Window segment (usually the first non-desktop segment)
            else if (controlType == "window" || controlType == "dialog" || controlType == "frame")
            {
                if (string.IsNullOrEmpty(element.WindowTitle))
                {
                    element.WindowTitle = name;
                    element.ProcessName = process;
                }
            }
        }

        element.HierarchyPath = string.Join(" > ", hierarchyParts.ToArray());
    }

    /// <summary>
    /// Extracts the control type name from a PAD selector segment.
    /// e.g., "button[Name="Login"]" returns "button"
    /// </summary>
    private string ExtractControlTypeFromSegment(string segment)
    {
        int bracketIdx = segment.IndexOf('[');
        if (bracketIdx > 0)
            return segment.Substring(0, bracketIdx).Trim();
        return segment.Trim();
    }

    /// <summary>
    /// Extracts an attribute value from a PAD selector segment.
    /// e.g., ExtractAttributeValue("button[Name=\"Login\"]", "Name") returns "Login"
    /// </summary>
    private string ExtractAttributeValue(string segment, string attributeName)
    {
        string pattern = attributeName + @"=""([^""]*)""";
        var match = Regex.Match(segment, pattern);
        if (match.Success) return match.Groups[1].Value;

        // Also try single-quote variant
        pattern = attributeName + @"='([^']*)'";
        match = Regex.Match(segment, pattern);
        if (match.Success) return match.Groups[1].Value;

        return "";
    }

    /// <summary>
    /// Maps PAD control type names to UIA control types.
    /// </summary>
    private string MapPadControlType(string padType)
    {
        if (string.IsNullOrEmpty(padType)) return "";
        string lower = padType.ToLower();
        if (lower == "button" || lower == "push_button") return "Button";
        if (lower == "edit" || lower == "text_field" || lower == "textbox") return "Edit";
        if (lower == "combobox" || lower == "combo_box" || lower == "dropdown") return "ComboBox";
        if (lower == "checkbox" || lower == "check_box") return "CheckBox";
        if (lower == "radiobutton" || lower == "radio_button") return "RadioButton";
        if (lower == "list" || lower == "listbox") return "List";
        if (lower == "listitem" || lower == "list_item") return "ListItem";
        if (lower == "tree" || lower == "treeview") return "Tree";
        if (lower == "treeitem" || lower == "tree_item") return "TreeItem";
        if (lower == "tab" || lower == "tabcontrol") return "Tab";
        if (lower == "tabitem" || lower == "tab_item") return "TabItem";
        if (lower == "menu") return "Menu";
        if (lower == "menuitem" || lower == "menu_item") return "MenuItem";
        if (lower == "datagrid" || lower == "data_grid" || lower == "table") return "DataGrid";
        if (lower == "text" || lower == "label" || lower == "static_text") return "Text";
        if (lower == "image") return "Image";
        if (lower == "hyperlink" || lower == "link") return "Hyperlink";
        if (lower == "window" || lower == "frame" || lower == "dialog") return "Window";
        if (lower == "pane" || lower == "panel" || lower == "group") return "Pane";
        if (lower == "scrollbar" || lower == "scroll_bar") return "ScrollBar";
        if (lower == "slider") return "Slider";
        if (lower == "progressbar" || lower == "progress_bar") return "ProgressBar";
        if (lower == "toolbar" || lower == "tool_bar") return "ToolBar";
        if (lower == "statusbar" || lower == "status_bar") return "StatusBar";
        // Return original with first letter uppercase
        if (padType.Length > 0)
            return char.ToUpper(padType[0]) + padType.Substring(1);
        return padType;
    }

    /// <summary>
    /// Tries to parse a single .robin action line into a ParsedPadStep.
    /// </summary>
    private ParsedPadStep TryParseAction(string line, Dictionary<string, PadUIElement> elements)
    {
        // UIAutomation.Click
        if (line.StartsWith("UIAutomation.Click"))
        {
            return ParseUIAutomationAction(line, "click", elements);
        }

        // UIAutomation.DoubleClick
        if (line.StartsWith("UIAutomation.DoubleClick"))
        {
            return ParseUIAutomationAction(line, "double_click", elements);
        }

        // UIAutomation.RightClick
        if (line.StartsWith("UIAutomation.RightClick"))
        {
            return ParseUIAutomationAction(line, "right_click", elements);
        }

        // UIAutomation.PopulateTextField / SetText
        if (line.StartsWith("UIAutomation.PopulateTextField") || line.StartsWith("UIAutomation.SetText"))
        {
            var step = ParseUIAutomationAction(line, "type", elements);
            if (step != null)
            {
                // Extract text value
                string textValue = ExtractParameterValue(line, "Text");
                if (string.IsNullOrEmpty(textValue))
                    textValue = ExtractParameterValue(line, "Value");
                step.Value = textValue;
            }
            return step;
        }

        // UIAutomation.SelectMenuItem
        if (line.StartsWith("UIAutomation.SelectMenuItem"))
        {
            return ParseUIAutomationAction(line, "click", elements);
        }

        // UIAutomation.DragAndDrop
        if (line.StartsWith("UIAutomation.DragAndDrop"))
        {
            return ParseUIAutomationAction(line, "drag_drop", elements);
        }

        // UIAutomation.GetDetailsOfUiElement / GetText
        if (line.StartsWith("UIAutomation.GetDetailsOfUiElement") || line.StartsWith("UIAutomation.GetText"))
        {
            return ParseUIAutomationAction(line, "assert_text", elements);
        }

        // UIAutomation.WaitForUiElement
        if (line.StartsWith("UIAutomation.WaitForUiElement"))
        {
            return ParseUIAutomationAction(line, "wait_for_element", elements);
        }

        // UIAutomation.SelectCheckBox / UncheckCheckBox
        if (line.StartsWith("UIAutomation.SelectCheckBox") || line.StartsWith("UIAutomation.UncheckCheckBox"))
        {
            return ParseUIAutomationAction(line, "click", elements);
        }

        // UIAutomation.SelectRadioButton
        if (line.StartsWith("UIAutomation.SelectRadioButton"))
        {
            return ParseUIAutomationAction(line, "click", elements);
        }

        // UIAutomation.SelectDropDownListItem
        if (line.StartsWith("UIAutomation.SelectDropDownListItem"))
        {
            var step = ParseUIAutomationAction(line, "select", elements);
            if (step != null)
            {
                step.Value = ExtractParameterValue(line, "Item");
            }
            return step;
        }

        // UIAutomation.FocusWindow / SetForeground
        if (line.StartsWith("UIAutomation.FocusWindow") || line.StartsWith("UIAutomation.SetForeground"))
        {
            return ParseUIAutomationAction(line, "window_switch", elements);
        }

        // UIAutomation.CloseWindow
        if (line.StartsWith("UIAutomation.CloseWindow"))
        {
            return ParseUIAutomationAction(line, "window_close", elements);
        }

        // UIAutomation.PressButton
        if (line.StartsWith("UIAutomation.PressButton"))
        {
            return ParseUIAutomationAction(line, "click", elements);
        }

        // MouseAndKeyboard.SendKeys
        if (line.StartsWith("MouseAndKeyboard.SendKeys"))
        {
            var step = new ParsedPadStep { Action = "type" };
            step.Value = ExtractParameterValue(line, "TextToSend");
            if (string.IsNullOrEmpty(step.Value))
                step.Value = ExtractParameterValue(line, "Keys");
            return step;
        }

        // MouseAndKeyboard.MoveMouse / Click
        if (line.StartsWith("MouseAndKeyboard."))
        {
            var step = new ParsedPadStep { Action = "click" };
            string x = ExtractParameterValue(line, "X");
            string y = ExtractParameterValue(line, "Y");
            if (!string.IsNullOrEmpty(x) && !string.IsNullOrEmpty(y))
            {
                step.Value = "x:" + x + " y:" + y;
            }
            return step;
        }

        // System.LaunchApplication / RunApplication
        if (line.StartsWith("System.LaunchApplication") || line.StartsWith("System.RunApplication"))
        {
            var step = new ParsedPadStep { Action = "launch_app" };
            step.Value = ExtractParameterValue(line, "ApplicationPath");
            if (string.IsNullOrEmpty(step.Value))
                step.Value = ExtractParameterValue(line, "Path");
            return step;
        }

        // Wait / Delay
        if (line.StartsWith("Wait") || line.StartsWith("WAIT") || line.StartsWith("Scripting.Delay"))
        {
            var step = new ParsedPadStep { Action = "wait" };
            string duration = ExtractParameterValue(line, "Duration");
            if (string.IsNullOrEmpty(duration))
                duration = ExtractParameterValue(line, "Seconds");
            step.Value = duration;
            return step;
        }

        // UIAutomation.TakeScreenshot
        if (line.StartsWith("UIAutomation.TakeScreenshot"))
        {
            return new ParsedPadStep { Action = "screenshot" };
        }

        // UIAutomation.Hover
        if (line.StartsWith("UIAutomation.Hover"))
        {
            return ParseUIAutomationAction(line, "hover", elements);
        }

        // Unknown action — import as comment
        return null;
    }

    /// <summary>
    /// Parses a UIAutomation.* action line, extracting the element reference and mapping it.
    /// </summary>
    private ParsedPadStep ParseUIAutomationAction(string line, string action, Dictionary<string, PadUIElement> elements)
    {
        var step = new ParsedPadStep { Action = action };

        // Try appmask['Window Name']['Element Name'] format first
        if (TryExtractAppMaskSelector(line, out var appmaskSelector, out var windowName, out var elementName))
        {
            step.WindowTitle = windowName;
            step.Label = elementName;
            step.PadSelector = appmaskSelector;

            // Infer control type from element name
            step.ControlType = InferControlTypeFromName(elementName);

            // Build WISPR window selector
            var wndSb = new StringBuilder("<wnd");
            wndSb.Append(" title=\"" + windowName + "\"");
            wndSb.Append(" />");
            step.WindowSelector = wndSb.ToString();

            return step;
        }

        // Extract element reference: Element: / UiElement: / TextField: / Button:
        string elementRef = ExtractParameterValue(line, "Element");
        if (string.IsNullOrEmpty(elementRef))
            elementRef = ExtractParameterValue(line, "UiElement");
        if (string.IsNullOrEmpty(elementRef))
            elementRef = ExtractParameterValue(line, "TextField");
        if (string.IsNullOrEmpty(elementRef))
            elementRef = ExtractParameterValue(line, "Button");

        // Remove PAD variable markers: %elementName%
        if (!string.IsNullOrEmpty(elementRef))
        {
            elementRef = elementRef.Trim('%', ' ');
        }

        if (!string.IsNullOrEmpty(elementRef) && elements.ContainsKey(elementRef))
        {
            var el = elements[elementRef];
            step.Label = el.ElementName;
            step.AutomationId = el.AutomationId;
            step.ControlType = el.ControlType;
            step.PadSelector = el.Selector;
            step.WindowTitle = el.WindowTitle;
            step.ProcessName = el.ProcessName;
            step.ClassName = el.ClassName;
            step.HierarchyPath = el.HierarchyPath;

            // Build WISPR window selector
            if (!string.IsNullOrEmpty(el.WindowTitle) || !string.IsNullOrEmpty(el.ProcessName))
            {
                var wndSb = new StringBuilder("<wnd");
                if (!string.IsNullOrEmpty(el.ProcessName))
                    wndSb.Append(" app=\"" + el.ProcessName + "\"");
                if (!string.IsNullOrEmpty(el.ClassName))
                    wndSb.Append(" cls=\"" + el.ClassName + "\"");
                if (!string.IsNullOrEmpty(el.WindowTitle))
                    wndSb.Append(" title=\"" + el.WindowTitle + "\"");
                wndSb.Append(" />");
                step.WindowSelector = wndSb.ToString();
            }
        }
        else
        {
            // Try to extract inline selector
            string inlineSelector = ExtractInlineSelector(line);
            if (!string.IsNullOrEmpty(inlineSelector))
            {
                step.PadSelector = inlineSelector;
                // Parse inline selector for element info
                var tempEl = new PadUIElement { Selector = inlineSelector };
                ParsePadSelector(tempEl);
                step.Label = tempEl.ElementName;
                step.ControlType = tempEl.ControlType;
                step.AutomationId = tempEl.AutomationId;
                step.WindowTitle = tempEl.WindowTitle;
                step.HierarchyPath = tempEl.HierarchyPath;
            }
        }

        return step;
    }

    /// <summary>
    /// Infers a UIA control type from the PAD element name.
    /// e.g., "JPush Button 'Login'" → "Button", "JText" → "Edit"
    /// </summary>
    private string InferControlTypeFromName(string elementName)
    {
        if (string.IsNullOrEmpty(elementName)) return "";
        string lower = elementName.ToLower();
        if (lower.Contains("button") || lower.Contains("push button") || lower.Contains("jpush")) return "Button";
        if (lower.Contains("jtext") || lower.Contains("text field") || lower.Contains("textbox") || lower.Contains("edit")) return "Edit";
        if (lower.Contains("password")) return "Edit";
        if (lower.Contains("combobox") || lower.Contains("combo box") || lower.Contains("dropdown")) return "ComboBox";
        if (lower.Contains("checkbox") || lower.Contains("check box")) return "CheckBox";
        if (lower.Contains("radio")) return "RadioButton";
        if (lower.Contains("list item")) return "ListItem";
        if (lower.Contains("list")) return "List";
        if (lower.Contains("tree item")) return "TreeItem";
        if (lower.Contains("tree")) return "Tree";
        if (lower.Contains("tab item") || lower.Contains("tabitem")) return "TabItem";
        if (lower.Contains("tab")) return "Tab";
        if (lower.Contains("menu item")) return "MenuItem";
        if (lower.Contains("menu")) return "Menu";
        if (lower.Contains("label") || lower.Contains("static")) return "Text";
        return "";
    }

    /// <summary>
    /// Extracts a parameter value from a .robin action line.
    /// Format: ParameterName: value or ParameterName: 'value' or ParameterName: $'''value'''
    /// </summary>
    private string ExtractParameterValue(string line, string paramName)
    {
        // Try pattern: ParamName: $'''value'''
        string pattern = paramName + @":\s*\$'''(.*?)'''";
        var match = Regex.Match(line, pattern);
        if (match.Success) return match.Groups[1].Value;

        // Try pattern: ParamName: 'value'
        pattern = paramName + @":\s*'([^']*)'";
        match = Regex.Match(line, pattern);
        if (match.Success) return match.Groups[1].Value;

        // Try pattern: ParamName: "value"
        pattern = paramName + @":\s*""([^""]*)""";
        match = Regex.Match(line, pattern);
        if (match.Success) return match.Groups[1].Value;

        // Try pattern: ParamName: value (up to next param or end)
        pattern = paramName + @":\s*([^\s,]+)";
        match = Regex.Match(line, pattern);
        if (match.Success) return match.Groups[1].Value;

        return "";
    }

    /// <summary>
    /// Extracts an inline selector from a .robin action line.
    /// </summary>
    private string ExtractInlineSelector(string line)
    {
        // Look for :desktop > ... pattern
        var match = Regex.Match(line, @"(:desktop\s*>.*?)(?:\s+\w+:|$)");
        if (match.Success) return match.Groups[1].Value.Trim();

        // Look for @'...' pattern, supporting escaped or doubled single quotes
        if (TryExtractAtQuotedValue(line, out var selector))
            return selector;

        return "";
    }

    /// <summary>
    /// Extracts content from PAD @'...' literals while preserving embedded apostrophes.
    /// Supports both doubled apostrophes ('') and backslash-escaped apostrophes (\').
    /// </summary>
    private bool TryExtractAtQuotedValue(string text, out string value)
    {
        value = "";
        if (string.IsNullOrEmpty(text)) return false;

        int start = text.IndexOf("@'", StringComparison.Ordinal);
        if (start < 0 || start + 2 >= text.Length) return false;

        int end = -1;
        for (int i = text.Length - 1; i > start + 1; i--)
        {
            if (text[i] != '\'') continue;

            bool isEscapedByBackslash = i > start + 2 && text[i - 1] == '\\';
            bool isDoubledQuote = i > start + 2 && text[i - 1] == '\'';
            if (!isEscapedByBackslash && !isDoubledQuote)
            {
                end = i;
                break;
            }
        }

        if (end <= start + 1) return false;

        value = text.Substring(start + 2, end - (start + 2));
        value = value.Replace("''", "'");
        return true;
    }

    /// <summary>
    /// Extracts appmask selector + window/element names from inline PAD references.
    /// Handles apostrophes inside names (escaped or doubled).
    /// </summary>
    private bool TryExtractAppMaskSelector(string line, out string fullSelector, out string windowName, out string elementName)
    {
        fullSelector = "";
        windowName = "";
        elementName = "";
        if (string.IsNullOrEmpty(line)) return false;

        int appmaskStart = line.IndexOf("appmask['", StringComparison.OrdinalIgnoreCase);
        if (appmaskStart < 0) return false;

        int firstValueStart = appmaskStart + "appmask['".Length;
        int separatorIndex = line.IndexOf("']['", firstValueStart, StringComparison.Ordinal);
        if (separatorIndex < 0) return false;

        int endIndex = line.IndexOf("']", separatorIndex + 4, StringComparison.Ordinal);
        if (endIndex < 0) return false;

        string rawWindow = line.Substring(firstValueStart, separatorIndex - firstValueStart);
        string rawElement = line.Substring(separatorIndex + 4, endIndex - (separatorIndex + 4));

        fullSelector = line.Substring(appmaskStart, endIndex - appmaskStart + 2);
        windowName = UnescapePadQuotedValue(rawWindow);
        elementName = UnescapePadQuotedValue(rawElement);
        return true;
    }

    private string UnescapePadQuotedValue(string value)
    {
        if (string.IsNullOrEmpty(value)) return "";
        return value.Replace("\\'", "'").Replace("''", "'");
    }

    /// <summary>
    /// Static helper: parses Robin script content and returns JsonObject steps
    /// compatible with the WISPR recorded step format.
    /// </summary>
    public static List<JsonObject> ParseToSteps(string content)
    {
        var parser = new RobinScriptParser();
        var parsed = parser.ParseContent(content);
        var results = new List<JsonObject>();

        foreach (var step in parsed)
        {
            var obj = new JsonObject
            {
                ["action"] = step.Action,
                ["description"] = $"{step.Action} on {(string.IsNullOrEmpty(step.Label) ? "element" : step.Label)}",
            };

            if (!string.IsNullOrEmpty(step.Label))
            {
                obj["target"] = new JsonObject
                {
                    ["label"] = step.Label,
                    ["controlType"] = step.ControlType,
                    ["automationId"] = step.AutomationId,
                    ["className"] = step.ClassName,
                    ["parentWindow"] = step.WindowTitle,
                };
            }

            if (!string.IsNullOrEmpty(step.Value))
                obj["value"] = step.Value;
            if (!string.IsNullOrEmpty(step.PadSelector))
                obj["padSelector"] = step.PadSelector;
            if (!string.IsNullOrEmpty(step.WindowSelector))
                obj["windowSelector"] = step.WindowSelector;

            results.Add(obj);
        }

        return results;
    }
}

/// <summary>Represents a UI element definition parsed from a .robin script.</summary>
public class PadUIElement
{
    public string Name { get; set; } = "";
    public string Selector { get; set; } = "";
    public string ElementName { get; set; } = "";
    public string ControlType { get; set; } = "";
    public string AutomationId { get; set; } = "";
    public string ClassName { get; set; } = "";
    public string WindowTitle { get; set; } = "";
    public string ProcessName { get; set; } = "";
    public string HierarchyPath { get; set; } = "";
}

/// <summary>Represents a single step parsed from a .robin script.</summary>
public class ParsedPadStep
{
    public string Action { get; set; } = "";
    public string Label { get; set; } = "";
    public string AutomationId { get; set; } = "";
    public string ControlType { get; set; } = "";
    public string Value { get; set; } = "";
    public string PadSelector { get; set; } = "";
    public string WindowTitle { get; set; } = "";
    public string ProcessName { get; set; } = "";
    public string ClassName { get; set; } = "";
    public string WindowSelector { get; set; } = "";
    public string HierarchyPath { get; set; } = "";
}
