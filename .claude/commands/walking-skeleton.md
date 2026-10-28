---
description: Consideration skill — build the thinnest end-to-end slice for the most important scenario first.
user-invocable: false
---
# /walking-skeleton

Read `.claude/guidelines/walking-skeleton.md` — the single source for this practice — and apply it to the current task.

Key reminders:
- Pick the ONE scenario that touches the most layers, delivers the most value, and exposes integration risk earliest.
- Horizontal first (one scenario through every layer), then vertical (more scenarios, same layers).
- Set up backing services and every integration before development — the skeleton must prove the real architecture.
- The skeleton is permanent, production-quality, fully tested code — never a throwaway spike.
- Don't add a second scenario until the skeleton is proven working end-to-end (API integration + Playwright E2E).
