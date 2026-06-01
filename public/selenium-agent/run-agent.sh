#!/bin/bash
# WISPR Selenium Agent Runner
echo "Starting WISPR Selenium Agent..."
echo "================================"

if [ -z "$WISPR_API_TOKEN" ]; then
    echo "ERROR: WISPR_API_TOKEN environment variable is not set."
    echo "Usage: export WISPR_API_TOKEN=\"your_token_here\" && ./run-agent.sh"
    exit 1
fi

# Build if target doesn't exist
if [ ! -f "target/wispr-selenium-agent-1.0.0.jar" ]; then
    echo "Building agent..."
    mvn clean package -q
fi

echo "Agent starting with token: ${WISPR_API_TOKEN:0:20}..."
java -jar target/wispr-selenium-agent-1.0.0.jar
