---
description: Stage 9 of 28 — create Liquibase seed data. Invoked by the backend track agent.
user-invocable: false
---
# /project:create-seed-data

## Stage
9 of 28 — Create Seed Data (Backend)

## Setup
**Role**: `roles/backend-dev.md`
**Guidelines**:
- `guidelines/walking-skeleton.md`
- `guidelines/simple-design.md`
- `guidelines/ubiquitous-language.md`
- `guidelines/sequential-test-data.md`

## Consideration Skills
Invoke these during this stage if guidance is needed:
- `/project:walking-skeleton` — when identifying or implementing the skeleton scenario
- `/project:simple-design` — when tempted to add speculative functionality
- `/project:ubiquitous-language` — when naming classes, methods, or variables
- `/project:validate-test-sequencing` — when seed data supports sequential integration tests

## Input
Read:
- `artifacts/{feature}/07-development-plan.md` — current task
- `artifacts/{feature}/03-scenarios.md` — scenarios requiring data (includes Test Data section)
- `artifacts/{feature}/01-requirements.md` — entity definitions
- `docs/ERD.md` (project root, if it exists) — planned entity relationships; check this feature's entities against it before writing foreign keys (see Step 3)

## Task
Create Liquibase migration and seed data scripts for the feature.

1. **Read** the scenarios and test data to understand what database structures and seed data are needed.

2. **Create Liquibase changelog files** following naming convention:
   ```
   db/changelog/
   ├── db.changelog-master.yaml          # Master changelog
   └── changes/
       ├── YYYYMMDD-001-{description}.yaml   # Schema changes
       └── YYYYMMDD-002-{description}-seed.yaml  # Seed data
   ```

3. **For schema changes** (migration):
   - Create tables, columns, indexes, constraints
   - Use ubiquitous language for table and column names
   - Include rollback instructions for every changeset
   - Each changeset must be atomic and independently executable
   - **If `docs/ERD.md` exists**, honor its relationships in both directions — the diagram is drafted upfront for the WHOLE epic, so most of it will point at entities that don't exist yet when any single feature is being built. That's the normal state, not an error:
     - **(a) Complete deferred relationships first.** Before finalizing this feature's tables, check the `## Deferred Relationships` section at the bottom of `docs/ERD.md` (create it, empty, if it doesn't exist yet) for any entry whose target entity is one THIS feature is about to create. If found, add the missing `foreignKeyConstraint` via a **new** changeset (never edit the changeset that originally created the referencing column — changesets are immutable, per the Constraints below) and remove that entry from `## Deferred Relationships`.
     - **(b) Defer what you can't complete yet.** For each of this feature's own entities, if `docs/ERD.md` shows a relationship to an entity that does NOT exist yet (owned by a feature later in Build Order), create the column WITHOUT a `foreignKeyConstraint` — Postgres/Liquibase will reject a FK to a nonexistent table outright, so this isn't optional. Add a row to `## Deferred Relationships`: `{this table}.{column} -> {target entity} : pending (deferred by {this feature}, awaiting whichever feature creates {target entity})`.
     - **(c) Note real deviations.** If you deliberately build a relationship differently from what `docs/ERD.md` shows (different cardinality, an unanticipated junction table), that's a valid design call, not an error — but flag it for the backend agent's track-handoffs summary as an `ERD Deviation` so it's visible at review, not silently divergent.
     - None of (a)/(b)/(c) is a Stop-on-Blocker — a pending or just-completed relationship is expected, incremental progress against the plan, not a failure.
   ```yaml
   databaseChangeLog:
     - changeSet:
         id: YYYYMMDD-001-create-{entity}-table
         author: {developer}
         changes:
           - createTable:
               tableName: {entity_name}
               columns:
                 - column:
                     name: id
                     type: uuid
                     constraints:
                       primaryKey: true
                       nullable: false
                 - column:
                     name: {field}
                     type: {type}
                     constraints:
                       nullable: {true/false}
         rollback:
           - dropTable:
               tableName: {entity_name}
   ```

4. **For seed data**:
   - Insert test data needed for scenarios
   - Use contexts to separate test data from production data
   - Reference test data definitions from the Test Data section in `03-scenarios.md`
   ```yaml
   databaseChangeLog:
     - changeSet:
         id: YYYYMMDD-002-seed-{entity}
         author: {developer}
         context: test
         changes:
           - insert:
               tableName: {entity_name}
               columns:
                 - column:
                     name: id
                     value: {uuid}
                 - column:
                     name: {field}
                     value: {value}
   ```

5. **Validate**:
   - Start backing services to test migrations: `docker compose -f docker-compose.backing-service.yml up -d`
   - The `migrations` service runs Liquibase automatically — check it exits with code 0
   - Verify seed data was inserted: `docker exec -i <db-container> psql -U test -d <db> -c "SELECT * FROM <table>"`
   - Tear down and re-run to verify idempotency: `docker compose -f docker-compose.backing-service.yml down -v && docker compose -f docker-compose.backing-service.yml up -d`
   - Ensure rollback works for every changeset

### Constraints
- Walking skeleton scenario data FIRST
- Use Liquibase contexts (`test`, `dev`, `prod`) to separate environments
- Every changeset MUST have a rollback
- Use ubiquitous language for all naming
- No speculative tables/columns — only what current scenarios need
- **NEVER modify already-applied changesets** — Liquibase checksums make applied changesets immutable. To fix or update seed data, create a NEW changeset with UPDATE/DELETE/INSERT statements. This applies to both schema and seed data changesets.

### Sequential Test Isolation (for integration/E2E seed data)
When seed data supports sequential tests sharing a database:
- **CASCADE analysis**: Before seeding child records, trace all CASCADE DELETE foreign keys from parent tables. Never place test-critical child records under a parent that any test deletes.
- **Dedicated resources**: Each test group gets its own non-overlapping records. No two test groups depend on the same mutable record.
- **Disposable resources**: Destructive tests (DELETE) must target records created solely to be destroyed — not records needed by other tests.
- **Safe parents**: All test-critical records live under parents that no test deletes. Disposable parents contain only disposable children.
- **No seed conflicts with mutations**: If a test creates a record (e.g., reservation on table-001), do NOT seed data that would conflict (e.g., overlapping reservation on table-001).

## Output
- Liquibase changelog files
- Update `artifacts/{feature}/07-development-plan.md` — mark this task done
- Update `docs/ERD.md`'s `## Deferred Relationships` section if this run added or completed any entry (leave the diagram itself untouched — that's `plan-epic`'s only)

## Done
Summarize:
- Tables created/modified
- Seed data records inserted
- Liquibase validation result
- Deferred relationships completed this run (if any)
- Deferred relationships newly added this run (if any)
- Any `ERD Deviation` from `docs/ERD.md` (none, if none occurred)

After summary, **reviewer reviews** this task. Ask developer to double-check and open PR if approved.
