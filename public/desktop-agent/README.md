# WISPR Desktop Test Recorder

## Prerequisites
- **Windows 10/11** (x64)
- **.NET 8 SDK** — https://dotnet.microsoft.com/download/dotnet/8.0
- **Java Access Bridge** enabled (for Java apps): `jabswitch /enable`

## Quick Start

```powershell
# Build the recorder
dotnet build .\WisprDesktopRecorder.csproj -c Release

# Run the recorder
dotnet run --project .\WisprDesktopRecorder.csproj --framework net8.0-windows
```

## Usage
1. Launch the recorder
2. Configure your API token (from WISPR → Desktop Automation)
3. Set the target application path and engine mode
4. Click Record and interact with your application
5. Review captured steps and save to the platform
