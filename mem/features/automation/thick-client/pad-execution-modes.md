---
name: PAD execution dual-mode dispatch
description: Desktop Automation supports two PAD execution targets — Cloud Flow URL (web) or PAD Environment+Workflow ID (local agent) — with the latter as fallback when the URL is empty.
type: feature
---
For PAD engine_mode tests, the user can provide EITHER:
1. **Cloud Flow HTTP Trigger URL** → runs via web API (priority 1, fires fetch directly from browser).
2. **PAD Environment ID + PAD Workflow ID** → fallback when no Cloud URL is set. Stored on `desktop_job_queue` (`pad_environment_id`, `pad_workflow_id`, `cloud_flow_trigger_url` columns) and surfaced to the Desktop Agent via the `desktop-agent-api` poll response so it can launch the flow locally in PAD.

Run is blocked only when BOTH targets are missing. UI inputs live in the PAD settings card on the test detail view.
