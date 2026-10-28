---
description: Consideration skill — explore how company repos relate before making integration decisions.
user-invocable: false
---
# /project:company-architecture

## Type
Consideration Skill — invoke anytime during development for guidance.

## Purpose
Explore the company's system architecture: how all repositories relate, what APIs they expose/consume, and how data flows between them. Use this to understand context before making integration decisions.

## When to Invoke
- During requirements gathering — to understand affected systems
- During design — to understand integration points
- During interface definition — to align with existing API contracts
- During deployment planning — to understand deployment order

## Instructions

Read `guidelines/company-architecture.md` for context.

### Step 1: Read the Master Architecture Map
```bash
# Read the system overview
Read: .claude/company/architecture.md
```
This shows:
- All repos and their purposes
- How they connect (HTTP, events, shared DB)
- Integration patterns used
- Shared infrastructure

### Step 2: Fetch Relevant Repo Details
For any repo involved in your feature:
```bash
# Read specific repo details
Read: .claude/company/repos/{repo-name}.md
```
Each repo file contains:
- Purpose and tech stack
- APIs exposed (endpoints, methods, payloads)
- APIs consumed (which other repos it calls)
- Events published and subscribed
- Data ownership
- Team contact

### Step 3: Map Your Feature's Integration Points
For your current feature, answer:
1. Which repos will this feature touch?
2. What existing APIs will it consume?
3. Will it need to expose new APIs for other repos?
4. What events should it publish/subscribe to?
5. Does it affect shared data that other repos read?

### Step 4: Verify Contracts
Before implementing integrations:
- Read the source repo's API definition — don't assume
- Check if the API has changed recently
- Verify authentication/authorization requirements
- Understand rate limits and error responses

### Maintaining the Architecture Map
When your feature adds or changes integrations:
- Update `.claude/company/repos/{repo-name}.md` for affected repos
- Update `.claude/company/architecture.md` if new connections are created
- Communicate changes to affected teams
