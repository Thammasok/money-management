---
description: Scan a single company repo and generate its description file under .claude/company/repos/.
argument-hint: "[repo path]"
disable-model-invocation: true
---
# /project:scan-repo

## Type
Utility — scan a single repo and generate its description file.

## Usage
```
/project:scan-repo {repo-path} "{repo-name}"
```

- `{repo-path}` — absolute or relative path to the repo root
- `{repo-name}` — name for the output file (e.g., `api`, `web-app`, `jobs`)

## Purpose
Read a company repo's codebase and produce a structured `.md` description file following the repo template. This makes the repo's architecture, APIs, events, and dependencies visible to the rest of the framework.

## Task

### Step 1: Scan the Repo
Read the repo at `{repo-path}` and extract:

1. **Purpose** — Identify from README, package.json/pom.xml/build.gradle, or top-level code.
2. **Tech Stack** — Language, framework, database, message queue, cache from dependencies.
3. **Architecture** — Identify internal layers (Entry Point → Business Logic → Domain → Data Access → External Integration). Map to concrete names using the project's tech-stack-profile if available. Note deviations.
4. **APIs Exposed** — Scan route definitions, controllers, and OpenAPI/Swagger specs. For each endpoint capture:
   - Method, path, description, auth type
   - Request body / query params (with types)
   - Response body (with types)
5. **APIs Consumed** — Scan HTTP clients, service calls, gateway classes for external API calls. Identify which repo/service each calls.
6. **Events Published** — Scan event emitters, message producers, Kafka/RabbitMQ publishers. Capture event name, channel/topic, payload schema, trigger.
7. **Events Subscribed** — Scan event listeners, message consumers, subscribers. Capture event name, source, handler, action.
8. **Dependencies**:
   - Internal: other company repos this repo calls or depends on
   - External: 3rd party services (payment, email, feature flags, etc.)
9. **Data Ownership** — Identify tables/entities this repo owns (migration files, entity definitions, models).
10. **Environment Variables** — Scan .env.example, config files, docker-compose. List key variables (no actual secrets).
11. **Team** — From CODEOWNERS, README, or package.json author.

### Step 2: Generate the Description
Use the template at `.claude/company/repos/_template.md` to produce the output. Fill every section with what was found. Leave sections empty with a `> None found` note if not applicable.

### Step 3: Present for Review
Show the generated content to the user. Ask them to verify:
- Are the APIs complete and accurate?
- Are there integrations the scan missed?
- Is the data ownership correct?
- Any corrections to tech stack or architecture?

### Constraints
- Do NOT guess — if something is unclear, flag it in a `## Open Questions` section at the bottom.
- Do NOT include actual secret values — only variable names and descriptions.
- If the repo has an OpenAPI/Swagger spec, prefer it as the source of truth for APIs.
- Scan test files and docker-compose for additional integration clues.

## Output
Write: `.claude/company/repos/{repo-name}.md`

## Done
Summarize:
- APIs exposed (count)
- APIs consumed (count)
- Events published/subscribed (count)
- Dependencies found (internal + external)
- Open questions

Ask: "Review `.claude/company/repos/{repo-name}.md` — edit if needed."
