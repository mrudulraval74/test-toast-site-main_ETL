using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Threading;

namespace WisprDesktopAgent.Core;

/// <summary>
/// Java Access Bridge (JAB) P/Invoke wrapper for interacting with Java-based UI components.
/// Oracle's JAB enables assistive technologies to access Java Swing/AWT controls on Windows.
/// Requires WindowsAccessBridge-64.dll (ships with JDK/JRE).
/// Run "jabswitch /enable" on the host machine before using.
/// </summary>
public static class JavaAccessBridge
{
    private static bool _initialized = false;
    private static bool _available = false;

    #region P/Invoke Declarations

    [DllImport("WindowsAccessBridge-64.dll", CallingConvention = CallingConvention.Cdecl)]
    private static extern void Windows_run();

    [DllImport("WindowsAccessBridge-64.dll", CallingConvention = CallingConvention.Cdecl)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool isJavaWindow(IntPtr hwnd);

    [DllImport("WindowsAccessBridge-64.dll", CallingConvention = CallingConvention.Cdecl)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool getAccessibleContextFromHWND(IntPtr hwnd, out int vmID, out long ac);

    [DllImport("WindowsAccessBridge-64.dll", CallingConvention = CallingConvention.Cdecl)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool getAccessibleContextInfo(int vmID, long ac, out AccessibleContextInfo info);

    [DllImport("WindowsAccessBridge-64.dll", CallingConvention = CallingConvention.Cdecl)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool getAccessibleContextAt(int vmID, long acParent, int x, int y, out long ac);

    [DllImport("WindowsAccessBridge-64.dll", CallingConvention = CallingConvention.Cdecl)]
    private static extern long getAccessibleChildFromContext(int vmID, long ac, int index);

    [DllImport("WindowsAccessBridge-64.dll", CallingConvention = CallingConvention.Cdecl)]
    private static extern long getAccessibleParentFromContext(int vmID, long ac);

    [DllImport("WindowsAccessBridge-64.dll", CallingConvention = CallingConvention.Cdecl)]
    private static extern void releaseJavaObject(int vmID, long ac);

    [DllImport("WindowsAccessBridge-64.dll", CallingConvention = CallingConvention.Cdecl)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool getAccessibleActions(int vmID, long ac, out AccessibleActions actions);

    [DllImport("WindowsAccessBridge-64.dll", CallingConvention = CallingConvention.Cdecl)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool doAccessibleActions(int vmID, long ac, ref AccessibleActionsToDo actionsToDo, out int failure);

    [DllImport("WindowsAccessBridge-64.dll", CallingConvention = CallingConvention.Cdecl)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool setTextContents(int vmID, long ac, [MarshalAs(UnmanagedType.LPWStr)] string text);

    [DllImport("user32.dll")]
    private static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
    private delegate bool EnumWindowsProc(IntPtr hwnd, IntPtr lParam);

    #endregion

    #region Structs

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct AccessibleContextInfo
    {
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 1024)]
        public string name;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)]
        public string description;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)]
        public string role;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)]
        public string role_en_US;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)]
        public string states;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)]
        public string states_en_US;
        public int indexInParent;
        public int childrenCount;
        public int x, y, width, height;
        [MarshalAs(UnmanagedType.Bool)]
        public bool accessibleComponent;
        [MarshalAs(UnmanagedType.Bool)]
        public bool accessibleAction;
        [MarshalAs(UnmanagedType.Bool)]
        public bool accessibleSelection;
        [MarshalAs(UnmanagedType.Bool)]
        public bool accessibleText;
        [MarshalAs(UnmanagedType.Bool)]
        public bool accessibleValue;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct AccessibleActions
    {
        public int actionsCount;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 256)]
        public AccessibleActionInfo[] actionInfo;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct AccessibleActionInfo
    {
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)]
        public string name;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct AccessibleActionsToDo
    {
        public int actionsCount;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 32)]
        public AccessibleActionInfo[] actions;
    }

    #endregion

    #region Public API

    /// <summary>
    /// Initialize the Java Access Bridge. Must be called once before any JAB operations.
    /// Returns true if JAB is available and initialized.
    /// </summary>
    public static bool Initialize()
    {
        if (_initialized) return _available;
        _initialized = true;
        try
        {
            Windows_run();
            // Give JAB a moment to discover running JVMs
            Thread.Sleep(500);
            _available = true;
            Logger.Info("Java Access Bridge initialized successfully");
        }
        catch (DllNotFoundException)
        {
            Logger.Warn("WindowsAccessBridge-64.dll not found — JAB not available. Install JDK/JRE or copy DLL to agent directory.");
            _available = false;
        }
        catch (Exception ex)
        {
            Logger.Warn("JAB initialization failed: " + ex.Message);
            _available = false;
        }
        return _available;
    }

    /// <summary>Whether JAB is available for use.</summary>
    public static bool IsAvailable => _available;

    /// <summary>
    /// Check if a given HWND is a Java window.
    /// </summary>
    public static bool IsJavaWindow(IntPtr hwnd)
    {
        if (!_available) return false;
        try { return isJavaWindow(hwnd); }
        catch { return false; }
    }

    /// <summary>
    /// Find all Java windows on the desktop and return their HWND + accessible context.
    /// </summary>
    public static List<JabWindowInfo> GetJavaWindows()
    {
        var results = new List<JabWindowInfo>();
        if (!_available) return results;

        EnumWindows((hwnd, _) =>
        {
            try
            {
                if (isJavaWindow(hwnd))
                {
                    if (getAccessibleContextFromHWND(hwnd, out int vmID, out long ac))
                        results.Add(new JabWindowInfo { Hwnd = hwnd, VmID = vmID, Ac = ac });
                }
            }
            catch { /* skip */ }
            return true;
        }, IntPtr.Zero);

        return results;
    }

    /// <summary>
    /// Search the JAB accessible tree for an element matching the given criteria.
    /// </summary>
    public static JabElementResult? FindElement(string? name, string? role, string? automationId, int maxDepth = 15)
    {
        if (!_available) return null;

        var javaWindows = GetJavaWindows();
        foreach (var jw in javaWindows)
        {
            var result = SearchTree(jw.VmID, jw.Ac, name, role, automationId, 0, maxDepth);
            if (result != null) return result;
        }
        return null;
    }

    /// <summary>
    /// Search the JAB tree starting from a specific window HWND (scoped to a process).
    /// </summary>
    public static JabElementResult? FindElementInWindow(IntPtr hwnd, string? name, string? role, string? automationId, int maxDepth = 15)
    {
        if (!_available) return null;
        try
        {
            if (!isJavaWindow(hwnd)) return null;
            if (!getAccessibleContextFromHWND(hwnd, out int vmID, out long ac)) return null;
            return SearchTree(vmID, ac, name, role, automationId, 0, maxDepth);
        }
        catch { return null; }
    }

    /// <summary>
    /// Perform a click action on a JAB accessible element.
    /// </summary>
    public static bool DoClick(int vmID, long ac)
    {
        var actionsToDo = new AccessibleActionsToDo
        {
            actionsCount = 1,
            actions = new AccessibleActionInfo[32]
        };
        actionsToDo.actions[0] = new AccessibleActionInfo { name = "click" };
        return doAccessibleActions(vmID, ac, ref actionsToDo, out _);
    }

    /// <summary>
    /// Set text in a JAB accessible text element.
    /// </summary>
    public static bool SetText(int vmID, long ac, string text)
    {
        return setTextContents(vmID, ac, text);
    }

    /// <summary>
    /// Get info about a JAB accessible element (for selector capture / OR linking).
    /// </summary>
    public static Dictionary<string, string>? GetElementInfo(int vmID, long ac)
    {
        if (!getAccessibleContextInfo(vmID, ac, out var info)) return null;
        var dict = new Dictionary<string, string>();
        dict["name"] = info.name ?? "";
        dict["role"] = info.role_en_US ?? info.role ?? "";
        dict["description"] = info.description ?? "";
        dict["states"] = info.states_en_US ?? info.states ?? "";
        dict["x"] = info.x.ToString();
        dict["y"] = info.y.ToString();
        dict["width"] = info.width.ToString();
        dict["height"] = info.height.ToString();
        dict["childrenCount"] = info.childrenCount.ToString();
        dict["hasAction"] = info.accessibleAction.ToString();
        dict["hasText"] = info.accessibleText.ToString();
        dict["hasValue"] = info.accessibleValue.ToString();
        return dict;
    }

    /// <summary>
    /// Get the accessible context info for a specific element.
    /// </summary>
    public static AccessibleContextInfo? GetContextInfo(int vmID, long ac)
    {
        if (!getAccessibleContextInfo(vmID, ac, out var info)) return null;
        return info;
    }

    /// <summary>
    /// Release a JAB object reference.
    /// </summary>
    public static void ReleaseObject(int vmID, long ac)
    {
        try { releaseJavaObject(vmID, ac); }
        catch { /* ignore */ }
    }

    /// <summary>
    /// Get accessible context from a window handle.
    /// </summary>
    public static bool GetContextFromHwnd(IntPtr hwnd, out int vmID, out long ac)
    {
        vmID = 0;
        ac = 0;
        if (!_available) return false;
        try { return getAccessibleContextFromHWND(hwnd, out vmID, out ac); }
        catch { return false; }
    }

    /// <summary>
    /// Find the JAB accessible element at a specific screen coordinate within a Java window.
    /// This is critical for recording clicks on Java apps where UIA only resolves to the
    /// top-level SunAwtFrame window instead of the actual button/control.
    /// </summary>
    public static JabElementResult? FindElementAtPoint(IntPtr hwnd, int x, int y)
    {
        if (!_available) return null;
        try
        {
            if (!isJavaWindow(hwnd)) return null;
            if (!getAccessibleContextFromHWND(hwnd, out int vmID, out long acParent)) return null;

            if (getAccessibleContextAt(vmID, acParent, x, y, out long acAtPoint) && acAtPoint != 0)
            {
                if (getAccessibleContextInfo(vmID, acAtPoint, out var info))
                {
                    // Skip if we got the root window back (role is usually "frame" or "dialog")
                    var role = info.role_en_US ?? info.role ?? "";
                    if (role != "frame" && role != "dialog" && role != "root pane"
                        && role != "layered pane" && role != "panel"
                        && !string.IsNullOrEmpty(role))
                    {
                        return new JabElementResult { VmID = vmID, Ac = acAtPoint, Info = info };
                    }

                    // If we got a container, search children for a more specific element
                    // that contains the point
                    if (info.childrenCount > 0)
                    {
                        var specific = FindMostSpecificAtPoint(vmID, acAtPoint, x, y, 0, 5);
                        if (specific != null) return specific;
                    }

                    // Return what we found even if it's a container
                    if (acAtPoint != acParent)
                        return new JabElementResult { VmID = vmID, Ac = acAtPoint, Info = info };
                }
            }
        }
        catch (Exception ex)
        {
            Logger.Debug("JAB FindElementAtPoint failed: " + ex.Message);
        }
        return null;
    }

    /// <summary>
    /// Builds a hierarchical selector path from the given element to its root.
    /// Example: > frame[Name="LoanDesk Enterprise Login"] > root_pane > layered_pane > panel > push_button[Name="Login"]
    /// </summary>
    public static string? BuildSelectorPath(int vmID, long ac, int maxDepth = 16)
    {
        if (!_available || ac == 0) return null;

        var segments = new List<string>();
        var parentHandles = new List<long>();

        try
        {
            long current = ac;
            int depth = 0;

            while (current != 0 && depth < maxDepth)
            {
                if (!getAccessibleContextInfo(vmID, current, out var info)) break;

                bool isLeaf = depth == 0;
                segments.Add(BuildSelectorSegment(info, isLeaf));

                long parent = getAccessibleParentFromContext(vmID, current);
                if (parent == 0 || parent == current) break;

                parentHandles.Add(parent);
                current = parent;
                depth++;
            }

            if (segments.Count == 0) return null;

            segments.Reverse();
            return "> " + string.Join(" > ", segments);
        }
        catch (Exception ex)
        {
            Logger.Debug("JAB BuildSelectorPath failed: " + ex.Message);
            return null;
        }
        finally
        {
            foreach (var handle in parentHandles)
            {
                try { releaseJavaObject(vmID, handle); }
                catch { }
            }
        }
    }

    private static string BuildSelectorSegment(AccessibleContextInfo info, bool isLeaf)
    {
        var roleToken = NormalizeRoleToken(info.role_en_US ?? info.role ?? "");
        if (string.IsNullOrEmpty(roleToken))
            roleToken = "custom";

        var segment = roleToken;
        var name = (info.name ?? "").Trim();

        if (!string.IsNullOrEmpty(name) && (isLeaf || ShouldIncludeNameForRole(roleToken)))
            segment += "[Name=\"" + EscapeSelectorName(name) + "\"]";

        return segment;
    }

    private static bool ShouldIncludeNameForRole(string normalizedRole)
    {
        return normalizedRole == "frame"
            || normalizedRole == "dialog"
            || normalizedRole == "window";
    }

    private static string NormalizeRoleToken(string role)
    {
        if (string.IsNullOrWhiteSpace(role)) return "";
        return role.Trim().ToLowerInvariant().Replace("-", "_").Replace(" ", "_");
    }

    private static string EscapeSelectorName(string value)
    {
        return value.Replace("\\", "\\\\").Replace("\"", "\\\"");
    }

    /// <summary>
    /// Recursively find the most specific (leaf) element containing the given point.
    /// </summary>
    private static JabElementResult? FindMostSpecificAtPoint(int vmID, long ac, int x, int y, int depth, int maxDepth)
    {
        if (depth >= maxDepth || ac == 0) return null;

        if (!getAccessibleContextInfo(vmID, ac, out var info)) return null;

        JabElementResult? bestMatch = null;

        for (int i = 0; i < info.childrenCount; i++)
        {
            long childAc = getAccessibleChildFromContext(vmID, ac, i);
            if (childAc == 0) continue;

            if (getAccessibleContextInfo(vmID, childAc, out var childInfo))
            {
                // Check if point is within this child's bounds
                if (x >= childInfo.x && x < childInfo.x + childInfo.width
                    && y >= childInfo.y && y < childInfo.y + childInfo.height)
                {
                    var childRole = childInfo.role_en_US ?? childInfo.role ?? "";
                    // If it's an actionable element, prefer it
                    if (childInfo.accessibleAction
                        || childRole == "push button" || childRole == "toggle button"
                        || childRole == "check box" || childRole == "radio button"
                        || childRole == "menu item" || childRole == "text"
                        || childRole == "combo box" || childRole == "list item"
                        || childRole == "tab" || childRole == "tree node")
                    {
                        bestMatch = new JabElementResult { VmID = vmID, Ac = childAc, Info = childInfo };
                    }

                    // Try to find something more specific deeper
                    var deeper = FindMostSpecificAtPoint(vmID, childAc, x, y, depth + 1, maxDepth);
                    if (deeper != null)
                    {
                        if (childAc != deeper.Ac)
                            releaseJavaObject(vmID, childAc);
                        bestMatch = deeper;
                    }
                    else if (bestMatch == null || bestMatch.Ac != childAc)
                    {
                        // Keep this as a candidate if nothing deeper was found
                        if (bestMatch == null && !string.IsNullOrEmpty(childInfo.name ?? ""))
                            bestMatch = new JabElementResult { VmID = vmID, Ac = childAc, Info = childInfo };
                    }
                }
                else
                {
                    releaseJavaObject(vmID, childAc);
                }
            }
            else
            {
                releaseJavaObject(vmID, childAc);
            }
        }

        return bestMatch;
    }

    #endregion

    #region Internal Helpers

    private static JabElementResult? SearchTree(
        int vmID, long ac, string? name, string? role, string? automationId, int depth, int maxDepth)
    {
        if (depth > maxDepth || ac == 0) return null;

        if (getAccessibleContextInfo(vmID, ac, out var info))
        {
            bool nameMatch = string.IsNullOrEmpty(name)
                || (!string.IsNullOrEmpty(info.name) && info.name.IndexOf(name, StringComparison.OrdinalIgnoreCase) >= 0);
            bool roleMatch = string.IsNullOrEmpty(role)
                || (!string.IsNullOrEmpty(info.role_en_US) && info.role_en_US.IndexOf(role, StringComparison.OrdinalIgnoreCase) >= 0)
                || (!string.IsNullOrEmpty(info.role) && info.role.IndexOf(role, StringComparison.OrdinalIgnoreCase) >= 0);
            bool idMatch = string.IsNullOrEmpty(automationId)
                || (!string.IsNullOrEmpty(info.description) && info.description.IndexOf(automationId, StringComparison.OrdinalIgnoreCase) >= 0);

            bool hasSearchCriteria = !string.IsNullOrEmpty(name) || !string.IsNullOrEmpty(role) || !string.IsNullOrEmpty(automationId);
            if (hasSearchCriteria && nameMatch && roleMatch && idMatch)
                return new JabElementResult { VmID = vmID, Ac = ac, Info = info };

            // Recurse into children
            for (int i = 0; i < info.childrenCount; i++)
            {
                long childAc = getAccessibleChildFromContext(vmID, ac, i);
                if (childAc != 0)
                {
                    var found = SearchTree(vmID, childAc, name, role, automationId, depth + 1, maxDepth);
                    if (found != null) return found;
                    releaseJavaObject(vmID, childAc);
                }
            }
        }
        return null;
    }

    #endregion
}

/// <summary>Result of a JAB window enumeration.</summary>
public class JabWindowInfo
{
    public IntPtr Hwnd { get; set; }
    public int VmID { get; set; }
    public long Ac { get; set; }
}

/// <summary>Result of a JAB element search.</summary>
public class JabElementResult
{
    public int VmID { get; set; }
    public long Ac { get; set; }
    public JavaAccessBridge.AccessibleContextInfo Info { get; set; }
}
