---
description: Stage 10 of 28 — stand up backing services via docker-compose. Invoked by the backend track agent.
user-invocable: false
---
# /project:create-backing-service

## Stage
10 of 28 — Create Backing Service (Backend)

## Setup
**Role**: `roles/backend-dev.md`
**Guidelines**:
- `guidelines/walking-skeleton.md`
- `guidelines/mockist-testing.md`
- `guidelines/simple-design.md`

## Consideration Skills
Invoke these during this stage if guidance is needed:
- `/project:walking-skeleton` — when identifying or implementing the skeleton scenario
- `/project:mockist-testing` — when deciding what to mock vs keep real
- `/project:simple-design` — when tempted to add speculative functionality

## Input
Read:
- `artifacts/{feature}/07-development-plan.md` — current task
- `artifacts/{feature}/01-requirements.md` — dependencies identified
- `artifacts/{feature}/06-api-test-plan.md` — external dependencies to mock
- Company architecture: `.claude/company/architecture.md` (if exists)

## Task
Create or update `docker-compose.backing-service.yml` to provide all infrastructure dependencies needed for testing.

1. **Identify all backing services needed**:
   - Database (PostgreSQL, MySQL, etc.)
   - Cache (Redis, Memcached, etc.)
   - Message queue (RabbitMQ, Kafka, etc.)
   - Mock 3rd party services (Mountebank impostors)
   - Any other infrastructure dependencies

2. **Create/update docker-compose.backing-service.yml**:
   ```yaml
   services:
     db:
       image: postgres:16-alpine
       environment:
         POSTGRES_DB: {feature}_test
         POSTGRES_USER: test
         POSTGRES_PASSWORD: test
       ports:
         - "5432:5432"
       volumes:
         - db-data:/var/lib/postgresql/data
       healthcheck:
         test: ["CMD-SHELL", "pg_isready -U test"]
         interval: 5s
         timeout: 5s
         retries: 5

     migrations:
       image: liquibase/liquibase:4.31
       depends_on:
         db:
           condition: service_healthy
       volumes:
         - ./db/changelog:/liquibase/changelog
       command: >
         --url=jdbc:postgresql://db:5432/{feature}_test
         --username=test
         --password=test
         --changelog-file=changelog/db.changelog-master.yaml
         --contexts=test
         update

     mock-3rd-party:
       image: bbyars/mountebank:2.9.1
       ports:
         - "2525:2525"
         - "4545:4545"
       volumes:
         - ./imposters:/imposters
       command: --configfile /imposters/imposters.json --allowInjection

   volumes:
     db-data:
   ```
   
   The `migrations` service runs Liquibase with `--contexts=test` to apply schema + seed data, then exits. No manual Liquibase CLI needed.

3. **Create impostor files** from the API test plan:
   - Each external dependency gets its own impostor
   - Impostors match the contracts defined in `06-api-test-plan.md`

4. **Verify** all services start and are healthy:
   ```bash
   docker compose -f docker-compose.backing-service.yml up -d
   docker compose -f docker-compose.backing-service.yml ps
   # migrations service should show "exited (0)" — meaning it ran successfully
   ```

### Constraints
- Only add services needed for current scenarios
- Use health checks for all services
- Use Alpine images where possible (smaller, faster)
- Mock 3rd party services with Mountebank, not real services
- Liquibase runs as a Docker service (not CLI) — it applies migrations and exits
- Use `--contexts=test` to include seed data in dev/test environments
- No `db/init.sql` — Liquibase is the single source of truth for schema and seed

## Output
- `docker-compose.backing-service.yml`
- Mountebank impostor files
- Startup/teardown scripts
- Update `artifacts/{feature}/07-development-plan.md` — mark this task done

## Done
Summarize:
- Services configured (DB, cache, mock 3rd party, etc.)
- Ports mapped
- Health check status

After summary, **reviewer reviews** this task. Ask developer to double-check and open PR if approved.
