@echo off
title WISPR Selenium Agent
echo Starting WISPR Selenium Agent...
echo ================================

if "%WISPR_API_TOKEN%"=="" (
    echo ERROR: WISPR_API_TOKEN environment variable is not set.
    echo Usage: set WISPR_API_TOKEN=your_token_here ^&^& run-agent.bat
    pause
    exit /b 1
)

if not exist "target\wispr-selenium-agent-1.0.0.jar" (
    echo Building agent...
    call mvn clean package -q
)

echo Agent starting...
java -jar target\wispr-selenium-agent-1.0.0.jar
pause
