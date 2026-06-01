## Goal

Deliver a downloadable **9-slide PowerPoint (.pptx)** pitching WISPR and a new 1Rivet QA engagement model to **James, Antares Head**, directly addressing the 4 focus areas Eric captured and the underlying frustration in Vikrant's first email.

Tone: executive, outcome-led, confident. Light on tooling jargon, heavy on business value (cost-center → value-center, AI leverage, fewer-but-better people, outcome-based pricing).

## Deck outline (9 slides)

1. **Cover** — "Reimagining Antares QA: From Cost Center to Value Engine" · 1Rivet × WISPR · prepared for James.
2. **Where we are today** — Honest snapshot: 14 QA resources across 8+ apps (Odyssey, Polaris, CRM, BMS, D365 F&O, WSO Hosted, Loan IQ Desktop, CMS, IAT, Monthly Statement), siloed knowledge, onboarding gaps, hour-based billing. Frames the problem James already feels.
3. **What James asked for** — The 4 pillars restated in his words: Player-Coach model · Cross-system flexibility · Platform stability · Investment in automation. Plus: "QA as value, not cost" and flex-up capacity.
4. **Our answer in one line** — A **smaller, AI-augmented 1Rivet pod** running on **WISPR**, our AI testing platform — same coverage, fewer people, faster cycles, outcomes-based pricing.
5. **WISPR — the AI testing platform** — 6 capability tiles: AI test generation from user stories, No-code automation + self-healing, Desktop (Loan IQ) + Web + API + Performance + Security in one platform, Governance & human-in-the-loop, Self-hosted agents inside Antares network, Test Pilot agentic workflows. Anchors why this is *different* from buying another framework.
6. **Proposed team model** — Side-by-side: **Today (14)** vs **Proposed 1Rivet pod (8-9)** organized as 1 Player-Coach + app leads + shared automation/AI engineers + flex bench. Shows cross-app coverage matrix.
7. **Stability + cross-system flexibility** — How WISPR's shared object repository, reusable test assets, and pattern library let one engineer move across Odyssey / Polaris / BMS / Loan IQ without months of ramp. Auto-heal keeps suites green → platform stability.
8. **Commercial model — value, not hours** — Move from T&M to **outcome-based**: fixed monthly platform + pod fee, SLAs on coverage / defect leakage / cycle time, flex-up capacity on demand. Illustrative savings vs current run-rate.
9. **Next steps** — 30-60-90 day plan: discovery & app prioritization → WISPR pilot on Odyssey + Loan IQ → rollout & team transition. CTA + contact.

## How it will be built

- Use the bundled **pptx skill** with `pptxgenjs` to generate `WISPR_Antares_Pitch.pptx` in `/mnt/documents/`.
- Visual direction: dark "Midnight Executive" palette (navy `#1E2761`, ice `#CADCFC`, white accent) with one accent gold for stat callouts. Georgia headers + Calibri body. Consistent slide chrome: small WISPR · 1Rivet lockup top-left, page number bottom-right.
- Each slide carries a visual element (icon row, comparison table, capability grid, simple bar) — no plain bullet walls.
- Embed any imagery as base64 so LibreOffice PDF conversion works for QA.

## Mandatory QA pass

After generation:
1. Convert to PDF with `run_libreoffice.py`, then `pdftoppm` to JPGs.
2. Visually inspect **every slide** for overflow, overlap, low contrast, leftover placeholder text, and consistency.
3. Fix → re-render → re-verify until a clean pass.
4. Report what was checked.

## Deliverable

`<presentation-artifact path="WISPR_Antares_Pitch.pptx" mime_type="application/vnd.openxmlformats-officedocument.presentationml.presentation"></presentation-artifact>` once QA passes.

Approve to build, or tell me what to change (slide order, palette, add a case-study slide, soften any messaging, etc.).