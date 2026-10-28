# Money Management — Entity Relationship Diagram

> Static structure of the epic in `epic.md`. Canonical names come from its Shared Domain Entities and
> Domain Language sections. Drafted 2026-10-28 by plan-epic; updated after grilling rounds 1–4 and the
> recheck rounds 5–7 (Sign-in Attempt, rate-cache rule, no future dates, Exchange Rate publication date, from/to Currency names,
> nullable Home Currency, fixed sign-in pause).
> Period Summary is computed on read and is deliberately not a table, so it is not drawn here.

```mermaid
erDiagram
    USER ||--o{ SESSION : "signs in with (F-1)"
    USER ||--o{ WALLET : "owns"

    %% owned by F-1 (Identity-internal); 30-day sliding expiry, deleted on sign-out (Q-28)
    SESSION {
        string id PK "random token, not a UUID; the cookie value"
        uuid userId FK
        timestamptz expiresAt
        timestamptz createdAt
    }

    %% owned by F-1 (Identity-internal) - one row per failed sign-in (Q-32); no id, no FK to USER
    %% (unknown emails are counted too); the 10th failure in 15 min pauses the email for a fixed 15 min (429, Q-42);
    %% attempts refused during the pause are not stored; a successful sign-in deletes the email's rows
    SIGN_IN_ATTEMPT {
        string email "lower-cased as typed"
        timestamptz attemptedAt
    }
    USER ||--o{ CATEGORY : "owns"
    WALLET ||--o{ TRANSACTION : "holds"
    CATEGORY |o--o{ TRANSACTION : "classifies (optional)"
    WALLET ||--o{ TRANSFER : "sends (fromWalletId)"
    WALLET ||--o{ TRANSFER : "receives (toWalletId)"
    WALLET ||--o{ WALLET_SHARE : "shared via (F-4)"
    USER ||--o{ WALLET_SHARE : "is a Member via (F-4)"
    USER ||--o{ TRANSACTION : "recorded (F-4)"

    %% owned by F-4 - per-Wallet sharing with individual Users, one Member role (Q-15 to Q-17); no id, key (walletId, userId)
    WALLET_SHARE {
        uuid walletId PK, FK
        uuid userId PK, FK "the Member"
        timestamptz createdAt
    }

    %% owned by F-10 - cached Frankfurter rates (Q-22, Q-38); no id, key (fromCurrency, toCurrency, rateOn); AD-3
    %% rateOn is the requested date; the rate is the latest published on or before it;
    %% a row is stored only when publishedOn = rateOn or rateOn is more than 1 day before the server date (Q-44)
    EXCHANGE_RATE {
        string fromCurrency PK "ISO-4217"
        string toCurrency PK "ISO-4217"
        date rateOn PK "requested date - the cache key"
        date publishedOn "ECB working day of publication, on or before rateOn"
        string rate "decimal, never float"
        timestamptz fetchedAt
    }

    %% owned by F-1 (Sign Up and Sign In); homeCurrency added by F-10
    USER {
        uuid id PK
        string email "unique, case-insensitive"
        string passwordHash "slow hash; never leaves Identity"
        string homeCurrency "ISO-4217 (F-10); nullable until chosen (Q-41); changeable"
        timestamptz createdAt
        timestamptz updatedAt
    }

    %% owned by F-2; archivedAt added by F-3
    WALLET {
        uuid id PK
        uuid userId FK
        string name
        string currency "ISO-4217 code, fixed at creation (AD-2, Q-11)"
        bigint openingBalanceMinor "minor units of this Wallet's currency"
        timestamptz archivedAt "nullable - null means active (F-3)"
        timestamptz createdAt
        timestamptz updatedAt
    }

    %% owned by F-2; edited/deleted by F-5; categoryId added by F-8
    TRANSACTION {
        uuid id PK
        uuid walletId FK
        string kind "income or expense"
        bigint amountMinor "always greater than 0"
        date occurredOn "calendar date, no time (AD-1); not after today (Q-45)"
        string note "nullable"
        uuid categoryId FK "nullable (F-8); set null when its category is deleted"
        uuid recordedByUserId FK "who recorded it (F-4)"
        timestamptz createdAt
        timestamptz updatedAt
    }

    %% owned by F-8
    CATEGORY {
        uuid id PK
        uuid userId FK
        string name
        string kind "income or expense"
        timestamptz createdAt
        timestamptz updatedAt
    }

    %% owned by F-9
    TRANSFER {
        uuid id PK
        uuid fromWalletId FK
        uuid toWalletId FK "must differ from fromWalletId"
        bigint amountMinor "always greater than 0; both wallets share one currency (Q-9)"
        date occurredOn
        string note "nullable"
        timestamptz createdAt
        timestamptz updatedAt
    }
```

## Notes

- **Balance is not a column.** A Wallet's Balance = `openingBalanceMinor` + Σ income − Σ expense +
  Σ transfers received − Σ transfers sent, computed on read (Project Conventions).
- **Category scope** (round 2, Q-5): per User, belongs to one Kind, optional on a Transaction
  ("Uncategorized"), none pre-loaded. Deleting a Category sets its Transactions' `categoryId` to null.
- **Wallets are never deleted** (archived instead), so no Transaction or Transfer can lose its Wallet.
- **Ownership** (round 1, A-1): Transactions and Transfers reach their User through their Wallet(s);
  Categories carry their own `userId`. A Transfer joins two Wallets both owned by the same User (Q-19).
- **Sharing** (round 3): a WALLET_SHARE row makes a User a Member of one Wallet. Members see it and
  record/edit/delete its Transactions (`recordedByUserId`); removing a Member keeps their Transactions.
- **Currency** (AD-2): every amount is in minor units of its Wallet's Currency. Amounts of different
  Currencies are never summed natively; F-10 converts through a cached EXCHANGE_RATE, never stored as
  an amount. A Transfer's two Wallets share one Currency (Q-9).
- **Sharing and edits** (Q-33, Q-34): Members record Transactions from F-4 and edit/delete them from
  F-5. An edit may change a Transaction's Wallet only to a Wallet the editor can see, of the same
  Currency, not archived (Q-34).
- **Keys** (Identity-key convention exceptions): SESSION has a random-token id, WALLET_SHARE and
  EXCHANGE_RATE have composite keys, SIGN_IN_ATTEMPT has no key (counted and deleted by `email`).
- Physical names follow the conventions: tables `users`, `sessions`, `sign_in_attempts`, `wallets`,
  `wallet_shares`, `transactions`, `categories`, `transfers`, `exchange_rates`; columns snake_case
  (`wallet_id`, `amount_minor`, `occurred_on`, …).

## Deferred Relationships

> Relationships the diagram shows whose target entity did not exist yet when the owning feature built its
> table. Maintained by `/project:create-seed-data` (Stage 9): a feature adds the missing foreign key in a
> NEW changeset once it creates the target, then removes the entry here.

_None pending._ F-1 created `users`, `sessions` and `sign_in_attempts` together, so `sessions.user_id -> users.id`
was completed in the same changeset set. Later features' references to `users` are created with their own tables
(the target already exists).
