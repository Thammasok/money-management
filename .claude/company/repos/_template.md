# {repo-name}

> Copy this template to create a new repo description.
> File name should match the repo name: `{repo-name}.md`

## Purpose
What this repo does in one sentence.

## Tech Stack
- **Language**: e.g., TypeScript, Java, Go
- **Framework**: e.g., Express, Spring Boot, Gin
- **Database**: e.g., PostgreSQL, MongoDB
- **Message Queue**: e.g., RabbitMQ, Kafka
- **Cache**: e.g., Redis

## Architecture
Internal layer structure:
```
Resources (Controller) → Service → Domain → Repository → Gateway
```

> Describe which layers this repo uses and any deviations from the standard.

## APIs Exposed

| Method | Endpoint | Description | Auth | Request Body | Response Body |
|--------|----------|-------------|------|-------------|--------------|
| GET | /api/v1/users | List users | Bearer | — | `{ users: User[] }` |
| POST | /api/v1/users | Create user | Bearer | `CreateUserRequest` | `User` |
| GET | /api/v1/users/:id | Get user by ID | Bearer | — | `User` |

> List all endpoints this repo exposes that other repos consume.

## APIs Consumed

| Source Repo | Method | Endpoint | Purpose |
|-------------|--------|----------|---------|
| payment-service | POST | /api/v1/charges | Process payment |
| notification-service | POST | /api/v1/emails | Send email |

> List all external APIs this repo calls.

## Events Published

| Event Name | Channel/Topic | Payload Schema | Triggered By |
|------------|--------------|----------------|-------------|
| UserCreated | user.events | `{ id, email, name }` | POST /api/v1/users |
| OrderPlaced | order.events | `{ orderId, userId, total }` | POST /api/v1/orders |

> List all events/messages this repo publishes.

## Events Subscribed

| Event Name | Source | Handler | Action |
|------------|--------|---------|--------|
| PaymentCompleted | payment.events | OrderService | Update order status |
| UserDeleted | user.events | CleanupService | Remove user data |

> List all events/messages this repo listens to.

## Dependencies
### Internal (other company repos)
- **api**: Calls for user data via REST
- **jobs**: Publishes tasks via message queue

### External (3rd party services)
- **Stripe**: Payment processing
- **SendGrid**: Email delivery
- **FeatBit**: Feature flags

> List all dependencies with brief purpose.

## Data Ownership
This repo is the **source of truth** for:
- Users (user table)
- User preferences (preferences table)

> List the data/entities this repo owns. Other repos should not write to these directly.

## Environment Variables
| Variable | Description | Example |
|----------|-------------|---------|
| DATABASE_URL | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/db` |
| REDIS_URL | Redis connection string | `redis://localhost:6379` |
| STRIPE_API_KEY | Stripe secret key | `sk_test_...` |

> List key environment variables (no actual secrets!).

## Team
- **Owner**: Backend Team
- **Contact**: #backend-team (Slack)
- **On-call**: PagerDuty rotation

## Notes
Any additional context, known issues, migration plans, or historical decisions.
