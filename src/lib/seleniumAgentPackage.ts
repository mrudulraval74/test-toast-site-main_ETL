// Selenium Agent package contents - inlined to avoid SPA routing issues with static file serving

export function getSeleniumAgentJava(token: string, supabaseUrl: string, supabaseKey: string): string {
  return `package com.wispr.agent;

import com.google.gson.*;
import io.github.bonigarcia.wdm.WebDriverManager;
import org.openqa.selenium.*;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;

public class SeleniumAgent {

    private static final String API_TOKEN = System.getenv("WISPR_API_TOKEN") != null
            ? System.getenv("WISPR_API_TOKEN")
            : "${token}";

    private static final String SUPABASE_URL = "${supabaseUrl}";
    private static final String SUPABASE_KEY = "${supabaseKey}";
    private static final boolean HEADLESS = !"false".equalsIgnoreCase(System.getenv("HEADLESS"));

    private static final Gson gson = new GsonBuilder().setPrettyPrinting().create();
    private static final int POLL_INTERVAL_MS = 5000;
    private static final int HEARTBEAT_INTERVAL_MS = 30000;
    private static volatile boolean running = true;

    public static void main(String[] args) {
        log("INFO", "WISPR Selenium Agent Starting...");
        log("INFO", "API Token: " + API_TOKEN.substring(0, Math.min(20, API_TOKEN.length())) + "...");
        log("INFO", "Headless: " + HEADLESS);
        WebDriverManager.chromedriver().setup();

        ScheduledExecutorService heartbeatExecutor = Executors.newSingleThreadScheduledExecutor();
        heartbeatExecutor.scheduleAtFixedRate(() -> {
            try { sendHeartbeat(); } catch (Exception e) { log("ERROR", "Heartbeat failed: " + e.getMessage()); }
        }, 0, HEARTBEAT_INTERVAL_MS, TimeUnit.MILLISECONDS);

        while (running) {
            try { pollAndExecuteJobs(); Thread.sleep(POLL_INTERVAL_MS); }
            catch (InterruptedException e) { running = false; }
            catch (Exception e) { log("ERROR", "Poll error: " + e.getMessage()); }
        }
        heartbeatExecutor.shutdown();
        log("INFO", "Agent stopped.");
    }

    private static void sendHeartbeat() throws Exception {
        String url = SUPABASE_URL + "/functions/v1/agent-api";
        JsonObject body = new JsonObject();
        body.addProperty("action", "heartbeat");
        body.addProperty("apiToken", API_TOKEN);
        JsonObject systemInfo = new JsonObject();
        systemInfo.addProperty("platform", System.getProperty("os.name"));
        systemInfo.addProperty("javaVersion", System.getProperty("java.version"));
        systemInfo.addProperty("agentType", "selenium");
        body.add("systemInfo", systemInfo);
        JsonObject capabilities = new JsonObject();
        JsonArray browsers = new JsonArray();
        browsers.add("chrome");
        capabilities.add("browsers", browsers);
        capabilities.addProperty("max_capacity", 3);
        body.add("capabilities", capabilities);
        postJson(url, body);
        log("DEBUG", "Heartbeat sent successfully");
    }

    private static void pollAndExecuteJobs() throws Exception {
        String url = SUPABASE_URL + "/functions/v1/agent-api";
        JsonObject body = new JsonObject();
        body.addProperty("action", "poll");
        body.addProperty("apiToken", API_TOKEN);
        String response = postJson(url, body);
        JsonObject result = JsonParser.parseString(response).getAsJsonObject();
        if (result.has("jobs") && result.getAsJsonArray("jobs").size() > 0) {
            JsonArray jobs = result.getAsJsonArray("jobs");
            log("INFO", "Found " + jobs.size() + " available job(s)");
            for (JsonElement jobEl : jobs) { executeJob(jobEl.getAsJsonObject()); }
        }
    }

    private static void executeJob(JsonObject job) {
        String jobId = job.get("id").getAsString();
        log("INFO", "Executing job: " + jobId);
        WebDriver driver = null;
        long startTime = System.currentTimeMillis();
        try {
            ChromeOptions options = new ChromeOptions();
            if (HEADLESS) { options.addArguments("--headless=new"); }
            options.addArguments("--no-sandbox", "--disable-dev-shm-usage", "--window-size=1920,1080");
            driver = new ChromeDriver(options);
            driver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
            JsonArray steps = job.has("steps") ? job.getAsJsonArray("steps") : new JsonArray();
            String baseUrl = job.has("base_url") ? job.get("base_url").getAsString() : "";
            JsonArray stepResults = new JsonArray();
            int passed = 0, failed = 0;
            for (int i = 0; i < steps.size(); i++) {
                JsonObject stepResult = executeStep(driver, steps.get(i).getAsJsonObject(), baseUrl);
                stepResults.add(stepResult);
                if ("passed".equals(stepResult.get("status").getAsString())) passed++; else failed++;
            }
            long duration = System.currentTimeMillis() - startTime;
            JsonObject results = new JsonObject();
            JsonObject data = new JsonObject();
            data.addProperty("total_steps", steps.size());
            data.addProperty("passed_steps", passed);
            data.addProperty("failed_steps", failed);
            results.add("data", data);
            results.add("step_results", stepResults);
            submitResults(jobId, passed, failed, steps.size(), duration, results);
            log("INFO", "Job " + jobId + " completed: " + passed + " passed, " + failed + " failed");
        } catch (Exception e) {
            log("ERROR", "Job " + jobId + " error: " + e.getMessage());
            try { submitResults(jobId, 0, 0, 0, System.currentTimeMillis() - startTime, null); } catch (Exception ex) {}
        } finally { if (driver != null) driver.quit(); }
    }

    private static JsonObject executeStep(WebDriver driver, JsonObject step, String baseUrl) {
        JsonObject result = new JsonObject();
        String type = step.has("type") ? step.get("type").getAsString() : "";
        String selector = step.has("selector") ? step.get("selector").getAsString() : "";
        String value = step.has("value") ? step.get("value").getAsString() : "";
        result.addProperty("step_type", type);
        long stepStart = System.currentTimeMillis();
        try {
            switch (type.toLowerCase()) {
                case "navigate": case "goto":
                    driver.get(value.startsWith("http") ? value : baseUrl + value); break;
                case "click": findElement(driver, selector).click(); break;
                case "type": case "fill":
                    WebElement el = findElement(driver, selector); el.clear(); el.sendKeys(value); break;
                case "wait": Thread.sleep(Long.parseLong(value)); break;
                case "waitforselector":
                    new WebDriverWait(driver, Duration.ofSeconds(10))
                        .until(ExpectedConditions.presenceOfElementLocated(parseSelector(selector))); break;
                case "asserttext":
                    if (!findElement(driver, selector).getText().contains(value)) throw new AssertionError("Text mismatch"); break;
                case "assertvisible":
                    if (!findElement(driver, selector).isDisplayed()) throw new AssertionError("Not visible"); break;
                case "hover":
                    new org.openqa.selenium.interactions.Actions(driver).moveToElement(findElement(driver, selector)).perform(); break;
                default: log("WARN", "Unknown step type: " + type);
            }
            result.addProperty("status", "passed");
            result.add("error", JsonNull.INSTANCE);
        } catch (Exception e) { result.addProperty("status", "failed"); result.addProperty("error", e.getMessage()); }
        result.addProperty("duration_ms", System.currentTimeMillis() - stepStart);
        return result;
    }

    private static WebElement findElement(WebDriver driver, String selector) { return driver.findElement(parseSelector(selector)); }

    private static By parseSelector(String selector) {
        if (selector.startsWith("//") || selector.startsWith("(//")) return By.xpath(selector);
        return By.cssSelector(selector);
    }

    private static void submitResults(String jobId, int passed, int failed, int total, long duration, JsonObject results) throws Exception {
        String url = SUPABASE_URL + "/functions/v1/agent-api";
        JsonObject body = new JsonObject();
        body.addProperty("action", "submit");
        body.addProperty("apiToken", API_TOKEN);
        body.addProperty("jobId", jobId);
        body.addProperty("status", failed > 0 ? "failed" : "passed");
        body.addProperty("duration_ms", duration);
        body.addProperty("total_steps", total);
        body.addProperty("passed_steps", passed);
        body.addProperty("failed_steps", failed);
        if (results != null) body.add("results", results);
        postJson(url, body);
    }

    private static String postJson(String urlStr, JsonObject body) throws Exception {
        URL url = new URL(urlStr);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setRequestProperty("Authorization", "Bearer " + SUPABASE_KEY);
        conn.setRequestProperty("apikey", SUPABASE_KEY);
        conn.setDoOutput(true);
        try (OutputStream os = conn.getOutputStream()) { os.write(gson.toJson(body).getBytes(StandardCharsets.UTF_8)); }
        int code = conn.getResponseCode();
        InputStream is = code >= 400 ? conn.getErrorStream() : conn.getInputStream();
        String response = new String(is.readAllBytes(), StandardCharsets.UTF_8);
        if (code >= 400) throw new RuntimeException("HTTP " + code + ": " + response);
        return response;
    }

    private static void log(String level, String message) { System.out.printf("[%s] [%s] %s%n", Instant.now(), level, message); }
}`;
}

export function getSeleniumPom(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    <groupId>com.wispr</groupId>
    <artifactId>wispr-selenium-agent</artifactId>
    <version>1.0.0</version>
    <packaging>jar</packaging>
    <name>WISPR Selenium Agent</name>
    <properties>
        <maven.compiler.source>11</maven.compiler.source>
        <maven.compiler.target>11</maven.compiler.target>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
        <selenium.version>4.18.1</selenium.version>
        <webdrivermanager.version>5.7.0</webdrivermanager.version>
        <gson.version>2.10.1</gson.version>
    </properties>
    <dependencies>
        <dependency>
            <groupId>org.seleniumhq.selenium</groupId>
            <artifactId>selenium-java</artifactId>
            <version>$` + `{selenium.version}</version>
        </dependency>
        <dependency>
            <groupId>io.github.bonigarcia</groupId>
            <artifactId>webdrivermanager</artifactId>
            <version>$` + `{webdrivermanager.version}</version>
        </dependency>
        <dependency>
            <groupId>com.google.code.gson</groupId>
            <artifactId>gson</artifactId>
            <version>$` + `{gson.version}</version>
        </dependency>
    </dependencies>
    <build>
        <plugins>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-jar-plugin</artifactId>
                <version>3.3.0</version>
                <configuration>
                    <archive><manifest><mainClass>com.wispr.agent.SeleniumAgent</mainClass></manifest></archive>
                </configuration>
            </plugin>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-shade-plugin</artifactId>
                <version>3.5.1</version>
                <executions><execution><phase>package</phase><goals><goal>shade</goal></goals></execution></executions>
            </plugin>
        </plugins>
    </build>
</project>`;
}

export function getSeleniumReadme(): string {
  return `# WISPR Selenium Self-Hosted Agent

A Java-based self-hosted agent that connects to WISPR platform and executes Selenium WebDriver tests.

## Prerequisites
- Java 11+ (JDK)
- Maven 3.6+
- Chrome Browser installed

## Quick Start

1. Build: mvn clean package
2. Set token: export WISPR_API_TOKEN="your_token" (or set WISPR_API_TOKEN=your_token on Windows)
3. Run: ./run-agent.sh (Linux/Mac) or run-agent.bat (Windows)

## Configuration
| Variable | Default | Description |
|----------|---------|-------------|
| WISPR_API_TOKEN | (required) | Your agent API token |
| HEADLESS | true | Run browser in headless mode |
`;
}

export function getSeleniumRunSh(): string {
  return `#!/bin/bash
echo "Starting WISPR Selenium Agent..."
if [ -z "$WISPR_API_TOKEN" ]; then
    echo "ERROR: WISPR_API_TOKEN not set."
    exit 1
fi
if [ ! -f "target/wispr-selenium-agent-1.0.0.jar" ]; then
    echo "Building agent..."
    mvn clean package -q
fi
java -jar target/wispr-selenium-agent-1.0.0.jar`;
}

export function getSeleniumRunBat(): string {
  return `@echo off
title WISPR Selenium Agent
echo Starting WISPR Selenium Agent...
if "%WISPR_API_TOKEN%"=="" (
    echo ERROR: WISPR_API_TOKEN not set.
    pause
    exit /b 1
)
if not exist "target\\wispr-selenium-agent-1.0.0.jar" (
    echo Building agent...
    call mvn clean package -q
)
java -jar target\\wispr-selenium-agent-1.0.0.jar
pause`;
}
