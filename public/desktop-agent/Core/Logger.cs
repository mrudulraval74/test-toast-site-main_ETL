using System;

namespace WisprDesktopAgent.Core;

public static class Logger
{
    public static void Info(string msg) => Log("INFO", msg);
    public static void Debug(string msg) => Log("DEBUG", msg);
    public static void Warn(string msg) => Log("WARN", msg);
    public static void Error(string msg) => Log("ERROR", msg);

    private static void Log(string level, string msg)
    {
        Console.WriteLine($"[{DateTime.UtcNow:O}] [{level}] {msg}");
    }
}
