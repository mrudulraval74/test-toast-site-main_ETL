# WISPR Selenium Self-Hosted Agent

A Java-based self-hosted agent that connects to WISPR platform and executes Selenium WebDriver tests on your local machine.

## Prerequisites

- **Java 11+** (JDK)
- **Maven 3.6+**
- **Chrome Browser** installed

## Quick Start

### 1. Build the project

```bash
mvn clean package
```

### 2. Configure Your API Token

Set your WISPR agent API token:

**Linux/macOS:**
```bash
export WISPR_API_TOKEN="your_api_token_here"
```

**Windows (PowerShell):**
```powershell
$env:WISPR_API_TOKEN="your_api_token_here"
```

### 3. Start the Agent

**Linux/macOS:**
```bash
./run-agent.sh
```

**Windows:**
```cmd
run-agent.bat
```

Or run directly:
```bash
java -jar target/wispr-selenium-agent-1.0.0.jar
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `WISPR_API_TOKEN` | (required) | Your agent API token from WISPR |
| `HEADLESS` | `true` | Run browser in headless mode |

## How It Works

1. **Registration**: Create an agent in WISPR and receive an API token
2. **Heartbeat**: The agent sends heartbeats every 30 seconds
3. **Job Polling**: The agent polls for available Selenium test jobs every 5 seconds
4. **Execution**: Jobs are executed using Selenium WebDriver with ChromeDriver
5. **Results**: Results and screenshots are submitted back to WISPR

## Support

For issues and feature requests, contact your WISPR administrator.
