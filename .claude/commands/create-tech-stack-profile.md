---
description: Scan the project and generate .claude/tech-stack-profile.md mapping generic layer names to concrete tech — run once per project before the first pipeline.
---
# /project:create-tech-stack-profile

## Type
Utility — scan a project and generate its tech-stack-profile. Run once per project, before the first feature pipeline.

## Usage
```
/project:create-tech-stack-profile
```

## Purpose
Scan the current project's codebase and generate `.claude/tech-stack-profile.md` — the single configuration file that maps generic pipeline concepts to concrete implementations. All pipeline skills read this file to know how to write code for this specific project.

## When to Run
- **New project onboarding**: When setting up the Saas Factory framework for a new project
- **Stack change**: When the project changes frameworks, test runners, or architecture pattern
- **Never copy from another project** — always generate fresh by scanning

## Task

### Step 1: Scan the Project
Read the codebase to discover:

1. **Languages & Frameworks**: Inspect `package.json`, `pom.xml`, `build.gradle`, `Cargo.toml`, `go.mod`, `requirements.txt`, or equivalent. Identify language, framework, and version.

2. **Architecture Pattern**: Scan the source directory structure and identify the layer architecture:
   - What serves as Entry Points? (Controllers, Resolvers, Handlers, etc.)
   - What serves as Business Logic? (Services, Processors, UseCases, etc.)
   - What serves as Data Access? (Repositories, Stores, DAOs, etc.)
   - What serves as External Integration? (Gateways, Clients, Publishers, etc.)
   - Is there a Real-Time layer? (WebSocket, SSE, streaming, etc.)
   - Is there a Validation layer? (Validators, Pipes, Schemas, etc.)
   - Map each to the generic role names used by pipeline skills.

3. **Testing Tools**: Inspect test config files (`jest.config.*`, `vitest.config.*`, `playwright.config.*`, `pytest.ini`, etc.) and test files to identify:
   - Test runner and version
   - Mock function pattern (e.g., `jest.fn()`, `vi.fn()`, `unittest.mock`)
   - File naming patterns
   - Test utility files and helpers

4. **Dependency Injection**: Inspect how dependencies are wired:
   - Backend DI mechanism (NestJS modules, Spring beans, Go interfaces, etc.)
   - Frontend DI mechanism (React Context, Vue provide/inject, Angular services, etc.)
   - List existing DI tokens/providers

5. **State Management**: Inspect frontend state approach:
   - Hooks, stores, reducers, signals, etc.

6. **Database**: Inspect docker-compose, config files, and data access code:
   - Database type and version
   - Driver/ORM
   - Migration tool
   - Test database credentials

7. **Build & Run Commands**: Inspect `package.json` scripts, `Makefile`, or equivalent:
   - Dev, test, build, lint, format, prod start commands

8. **Infrastructure**: Inspect docker-compose files:
   - Backing services (DB, cache, message queue, mock servers)
   - Ports and images

9. **Code Quality**: Inspect linter/formatter configs:
   - ESLint, Prettier, rustfmt, gofmt, etc.

10. **Playwright/E2E Config**: Inspect E2E test configuration.

11. **Best-Practice Skills**: Match the detected stack against the stack-specific skills present in `.claude/skills/`, and record the matches in the profile's **Best-Practice Skills** table. Detection signals:
    - `rust-best-practices` ← `Cargo.toml` present
    - `vercel-react-best-practices` ← `next.config.*` or `react`/`next` in `package.json`
    - `supabase-postgres-best-practices` ← `supabase/` dir, or Postgres plus `@supabase/supabase-js`
    Only list a skill if BOTH its stack is present AND the skill exists in `.claude/skills/` (run `ls .claude/skills`). Skip any whose stack is absent — never list a skill for a stack this project doesn't use. Leave the table empty if none match. Do NOT list the stack-agnostic design skills here.

### Step 2: Generate the Profile
Use the template at `templates/tech-stack-profile.md`. Fill every section with concrete values discovered in Step 1. Replace all `{placeholder}` values.

### Step 3: Verify
1. Check that every `{placeholder}` has been replaced
2. Verify Architecture Pattern roles match the actual directory structure
3. Verify test commands actually work: run a quick `{test-command}` to confirm
4. Verify DI tokens/services lists are complete

### Step 4: Present for Review
Show the generated profile. Ask the user to verify:
- Is the architecture pattern correct?
- Are there DI tokens or services the scan missed?
- Are the build/test commands accurate?
- Any framework-specific patterns not captured?

## Constraints
- Do NOT guess — if something is unclear, leave `{TODO: describe what goes here}` and flag it
- Do NOT include secrets — only variable names and descriptions
- If the project has both backend and frontend, profile BOTH
- If a section doesn't apply (e.g., no frontend), note `> Not applicable` in that section
- The Architecture Pattern section is **critical** — all pipeline skills depend on it

## Output
Write: `.claude/tech-stack-profile.md`

## Done
Summarize:
- Architecture pattern identified (list roles → concrete layers)
- Testing tools identified
- DI mechanism identified
- Build commands verified
- Any TODOs that need user input

Ask: "Review `.claude/tech-stack-profile.md` — edit if needed. This file drives all pipeline skills."
