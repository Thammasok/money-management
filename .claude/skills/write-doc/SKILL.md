---
name: write-doc
description: Write a Markdown doc that persists to the Outline wiki. Use when the user wants to capture a design note, guide, meeting note, decision, or any ad-hoc document outside the pipelines' numbered artifact sets — task/feature docs go via artifacts/ + the sync hooks, repo-level docs via the Outline MCP.
---

Author an ad-hoc `.md` document and land it in the Outline wiki under the repo's `long-horizon-agent` hierarchy. For documents that are NOT a pipeline's numbered artifacts (those are owned by their pipelines and sync automatically).

The user provides a purpose (and optionally a topic/doc-name). Derive a kebab-case doc name if not given.

## Where a doc lands (decide placement FIRST)

| You write locally | Outline location | Mechanism |
|---|---|---|
| `artifacts/{topic}/{doc-name}.md` — {topic} is NOT an epic feature | `long-horizon-agent/non-epic/{topic}/{doc-name}` | **sync hooks** (`outline-sync.py` on Stop) — nothing manual |
| `artifacts/{feature-dir}/{doc-name}.md` — {feature-dir} matches a feature in `epic.md`/`checklist.md` | `long-horizon-agent/epic/epic-{name}/F-{n}-{feature}/{doc-name}` | **sync hooks** — nothing manual |
| Repo-level doc (belongs beside `epic`/`non-epic`, like `tech-stack-profile`) | `long-horizon-agent/{doc-name}` | **Outline MCP** (`create_document`/`update_document`) — the hooks only sync `tech-stack-profile` at repo level |

Default to the first row: pick (or reuse) a kebab-case topic dir that groups related docs (`notes`, `design`, `onboarding`, …). Use repo-level placement only when the doc genuinely describes the whole repo.

## Steps

1. **Check for an existing doc first.** Look in `artifacts/{topic}/` locally; if the Outline MCP is connected, also `search_documents` in the `{repo-name}` collection. Update the existing doc rather than minting a near-duplicate.
2. **Draft the doc.** Conventions: one `#` H1 title; a one-paragraph purpose right under it; sections with `##`; tables for enumerable facts; link related pipeline artifacts by their Outline path (e.g. `non-epic/{task}/01-change-plan`), not by gitignored local paths. Keep the body plain Markdown — **no `<!-- lha-artifact -->` marker** (the sync layer adds/owns markers).
3. **Persist.**
   - Hook path (rows 1–2): Write the file under `artifacts/…`; it syncs on the next Stop automatically. Never sync manually, never commit it (`artifacts/` is gitignored — Outline is the canonical record).
   - MCP path (row 3): create the doc via the Outline MCP under the `long-horizon-agent` document of the `{repo-name}` collection, and prepend the marker `<!-- lha-artifact: scope=repo epic=- item=- artifact={doc-name} -->` yourself (the hook isn't in this path). If the Outline MCP is not connected, fall back to the hook path under `artifacts/{topic}/` and say so.
4. **Report** the doc's Outline location (and that sync happens on Stop for the hook path).

## Rules

- Never write a doc into another pipeline's numbered artifact set (`01-…`–`11-…` files) — those belong to their pipelines.
- Never hand-edit `.outline-sync.json` (the manifest is owned by the hook).
- Outline is canonical: after the first sync, treat the wiki copy as the record; local files are working copies.
- Reading/searching the wiki anytime: use the Outline MCP tools (`search_documents`, `read_document`) when connected.
