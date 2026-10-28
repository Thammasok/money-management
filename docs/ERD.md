# Money Management — Entity Relationship Diagram

> Static structure of the epic in `epic.md`. Canonical names come from its Shared Domain Entities and
> Domain Language sections. Drafted 2026-10-28 by plan-epic — **not yet confirmed by the user**.
> Period Summary is computed on read and is deliberately not a table, so it is not drawn here.

```mermaid
erDiagram
    WALLET ||--o{ TRANSACTION : "holds"
    CATEGORY |o--o{ TRANSACTION : "classifies (optional)"
    WALLET ||--o{ TRANSFER : "sends (fromWalletId)"
    WALLET ||--o{ TRANSFER : "receives (toWalletId)"

    %% owned by F-1; archivedAt added by F-2
    WALLET {
        uuid id PK
        string name
        bigint openingBalanceMinor "minor units of APP_CURRENCY"
        timestamptz archivedAt "nullable - null means active (F-2)"
        timestamptz createdAt
        timestamptz updatedAt
    }

    %% owned by F-1; edited/deleted by F-3; categoryId added by F-6
    TRANSACTION {
        uuid id PK
        uuid walletId FK
        string kind "income or expense"
        bigint amountMinor "always greater than 0"
        date occurredOn "calendar date, no time (AD-1)"
        string note "nullable"
        uuid categoryId FK "nullable (F-6)"
        timestamptz createdAt
        timestamptz updatedAt
    }

    %% owned by F-6
    CATEGORY {
        uuid id PK
        string name
        string kind "income or expense - TODO: unclear from requirements (Q-5)"
        timestamptz createdAt
        timestamptz updatedAt
    }

    %% owned by F-7
    TRANSFER {
        uuid id PK
        uuid fromWalletId FK
        uuid toWalletId FK "must differ from fromWalletId"
        bigint amountMinor "always greater than 0"
        date occurredOn
        string note "nullable"
        timestamptz createdAt
        timestamptz updatedAt
    }
```

## Notes

- **Balance is not a column.** A Wallet's Balance = `openingBalanceMinor` + Σ income − Σ expense +
  Σ transfers received − Σ transfers sent, computed on read (Project Conventions).
- **Category scope** — `{TODO: unclear from requirements}`: whether a Category belongs to a Kind
  (income vs expense), whether names are unique, and whether any Categories are pre-seeded (Q-5).
  Drawn as global (not per Wallet), optional on a Transaction.
- **Deleting a Category that Transactions use** — `{TODO: unclear from requirements}`: block the
  delete, or set those Transactions' `categoryId` to null. Settled with Q-5.
- **Wallets are never deleted** (archived instead), so no Transaction or Transfer can lose its Wallet.
- Physical names follow the conventions: tables `wallets`, `transactions`, `categories`, `transfers`;
  columns snake_case (`wallet_id`, `amount_minor`, `occurred_on`, …).
