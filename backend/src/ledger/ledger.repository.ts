import { Inject, Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { PG_POOL } from '../database/database.tokens';
import type { ILedgerRepository } from './interfaces/ledger-repository.interface';
import type { NewTransaction, Transaction, TransactionKind } from './transaction.entity';
import type {
  NewWallet,
  Wallet,
  WalletChange,
  WalletDetail,
  WalletWithBalance,
} from './wallet.entity';

// BIGINT comes back from `pg` as a string and `occurred_on` (DATE) as the exact 'YYYY-MM-DD' string — the Pool is
// created by `createPool` (database/create-pool.ts), which is what guarantees both.
interface WalletRow {
  id: string;
  user_id: string;
  name: string;
  currency: string;
  opening_balance_minor: string;
  archived_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface WalletBalanceRow extends WalletRow {
  balance_minor: string;
}

interface TransactionRow {
  id: string;
  wallet_id: string;
  kind: TransactionKind;
  amount_minor: string;
  occurred_on: string;
  note: string | null;
  created_at: Date;
  updated_at: Date;
}

const WALLET_COLUMNS =
  'w.id, w.user_id, w.name, w.currency, w.opening_balance_minor, w.archived_at, w.created_at, w.updated_at';
const TRANSACTION_COLUMNS =
  't.id, t.wallet_id, t.kind, t.amount_minor, t.occurred_on, t.note, t.created_at, t.updated_at';

/**
 * The visibility rule, written once, for a Wallet aliased `w` with `$1` = the Wallet id and `$2` = the User id: a
 * Wallet is visible to the User who owns it. F-4 widens this one condition to "owns it or is a Member of it".
 */
const WALLET_IS_VISIBLE = 'w.id = $1 AND w.user_id = $2';

/**
 * The rule for the owner-only actions (rename, archive), written once for a Wallet aliased `w` with `$1` = the Wallet
 * id and `$2` = the User id. It is deliberately NOT `WALLET_IS_VISIBLE`: when F-4 widens visibility to Members, a
 * Member must still be unable to rename or archive (the Member gets a 403 there, not a change).
 */
const WALLET_IS_OWNED = 'w.id = $1 AND w.user_id = $2';

/**
 * Wallets with their Balances — the ONE place a Balance is derived. Opening Balance + Σ income − Σ expense, summed in
 * NUMERIC so it cannot overflow, and read as text so it never becomes a JS number. A Wallet with no Transactions sums
 * NULL, hence the COALESCE: its Balance is its Opening Balance. Complete it with a WHERE and `GROUP BY w.id`.
 */
const SELECT_WALLETS_WITH_BALANCE = `
  SELECT ${WALLET_COLUMNS},
         (w.opening_balance_minor
           + COALESCE(SUM(CASE t.kind WHEN 'income' THEN t.amount_minor
                                      WHEN 'expense' THEN -t.amount_minor END), 0))::text AS balance_minor
  FROM wallets w
  LEFT JOIN transactions t ON t.wallet_id = w.id`;

/** A visible Wallet with its Balance (`$1` = Wallet id, `$2` = User id). */
const SELECT_WALLET_WITH_BALANCE = `${SELECT_WALLETS_WITH_BALANCE}
  WHERE ${WALLET_IS_VISIBLE}
  GROUP BY w.id`;

/** The Wallets a User owns, Archived ones included, with their Balances, newest first (`$1` = User id). */
const SELECT_OWNED_WALLETS_WITH_BALANCE = `${SELECT_WALLETS_WITH_BALANCE}
  WHERE w.user_id = $1
  GROUP BY w.id
  ORDER BY w.created_at DESC, w.id DESC`;

/**
 * Renames and/or archives an owned Wallet in ONE statement (`$1` = Wallet id, `$2` = User id, `$3` = the new name or
 * NULL to keep it, `$4` = whether to archive). An archive stamps `archived_at` and `updated_at` with the same Postgres
 * `now()` and matches only a Wallet that is not archived yet — so archiving an Archived Wallet matches nothing, and
 * with it the whole change is refused (a name sent along is not applied). Two archives at the same moment are
 * serialised by the row lock: the second waits, re-checks the row once the first committed, and matches nothing.
 */
const UPDATE_OWNED_WALLET = `
  UPDATE wallets w
  SET name = COALESCE($3::text, w.name),
      archived_at = CASE WHEN $4::boolean THEN now() ELSE w.archived_at END,
      updated_at = now()
  WHERE ${WALLET_IS_OWNED} AND (NOT $4::boolean OR w.archived_at IS NULL)
  RETURNING w.id`;

/**
 * Stores a Transaction (`$1` = Wallet id, `$2` = Kind, `$3` = amount, `$4` = date, `$5` = note) only in a Wallet that is
 * not archived. The check and the insert are ONE statement, and `FOR SHARE` keeps the Wallet's row locked until the
 * insert commits: an archive (which needs the row to update it) can neither slip in between a check and an insert, nor
 * commit while the insert is in flight. Every Transaction that is stored therefore commits before the archive does; an
 * insert that meets an archive in flight waits for it, re-checks the row once the archive committed, finds it
 * archived, and stores nothing. A missing Wallet stores nothing either.
 */
const INSERT_TRANSACTION_INTO_ACTIVE_WALLET = `
  INSERT INTO transactions AS t (wallet_id, kind, amount_minor, occurred_on, note)
  SELECT w.id, $2::text, $3::bigint, $4::date, $5::text
  FROM wallets w
  WHERE w.id = $1 AND w.archived_at IS NULL
  FOR SHARE OF w
  RETURNING ${TRANSACTION_COLUMNS}`;

/** A Wallet's Transactions, newest `occurred_on` first, ties by newest `created_at`, then `id` descending (`$1` = Wallet id). */
const SELECT_TRANSACTIONS_NEWEST_FIRST = `
  SELECT ${TRANSACTION_COLUMNS} FROM transactions t
  WHERE t.wallet_id = $1
  ORDER BY t.occurred_on DESC, t.created_at DESC, t.id DESC`;

/**
 * Data Access for Wallets and Transactions. Parameterised SQL only. A Balance is never stored: it is derived in SQL
 * (Opening Balance + Σ income − Σ expense, in NUMERIC so it cannot overflow) on every read of a Wallet.
 */
@Injectable()
export class LedgerRepository implements ILedgerRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async insertWallet(newWallet: NewWallet): Promise<Wallet> {
    const { rows } = await this.pool.query<WalletRow>(
      `INSERT INTO wallets AS w (user_id, name, currency, opening_balance_minor)
       VALUES ($1, $2, $3, $4)
       RETURNING ${WALLET_COLUMNS}`,
      [
        newWallet.userId,
        newWallet.name,
        newWallet.currency,
        newWallet.openingBalanceMinor.toString(),
      ],
    );
    return toWallet(rows[0]);
  }

  async listWalletsOwnedBy(userId: string): Promise<WalletWithBalance[]> {
    const { rows } = await this.pool.query<WalletBalanceRow>(SELECT_OWNED_WALLETS_WITH_BALANCE, [
      userId,
    ]);
    return rows.map(toWalletWithBalance);
  }

  async findOwnedWallet(userId: string, walletId: string): Promise<Wallet | null> {
    const { rows } = await this.pool.query<WalletRow>(
      `SELECT ${WALLET_COLUMNS} FROM wallets w WHERE ${WALLET_IS_VISIBLE}`,
      [walletId, userId],
    );
    return rows.length === 0 ? null : toWallet(rows[0]);
  }

  findOwnedWalletDetail(userId: string, walletId: string): Promise<WalletDetail | null> {
    // The Wallet's Balance and its list are two statements; one snapshot keeps them in agreement even when a
    // Transaction is recorded (say, from a second tab) between the two reads.
    return this.readSnapshot(async (client) => {
      const { rows: walletRows } = await client.query<WalletBalanceRow>(
        SELECT_WALLET_WITH_BALANCE,
        [walletId, userId],
      );
      if (walletRows.length === 0) {
        return null;
      }

      const { rows: transactionRows } = await client.query<TransactionRow>(
        SELECT_TRANSACTIONS_NEWEST_FIRST,
        [walletId],
      );
      return {
        ...toWalletWithBalance(walletRows[0]),
        transactions: transactionRows.map(toTransaction),
      };
    });
  }

  async updateOwnedWallet(
    userId: string,
    walletId: string,
    change: WalletChange,
  ): Promise<WalletWithBalance | null> {
    const { rows: updated } = await this.pool.query<{ id: string }>(UPDATE_OWNED_WALLET, [
      walletId,
      userId,
      change.name,
      change.archive,
    ]);
    if (updated.length === 0) {
      return null;
    }
    // A second statement: the Balance comes from the one place it is derived. The Wallet read back is the Wallet as it
    // is now (a later change by someone else would show — and that is the truth to answer with).
    const { rows } = await this.pool.query<WalletBalanceRow>(SELECT_WALLET_WITH_BALANCE, [
      walletId,
      userId,
    ]);
    return rows.length === 0 ? null : toWalletWithBalance(rows[0]);
  }

  async insertTransaction(newTransaction: NewTransaction): Promise<Transaction | null> {
    const { rows } = await this.pool.query<TransactionRow>(INSERT_TRANSACTION_INTO_ACTIVE_WALLET, [
      newTransaction.walletId,
      newTransaction.kind,
      newTransaction.amountMinor.toString(),
      newTransaction.occurredOn,
      newTransaction.note,
    ]);
    return rows.length === 0 ? null : toTransaction(rows[0]);
  }

  /** Runs `work` on one connection inside a read-only REPEATABLE READ transaction, so every statement sees one snapshot. */
  private async readSnapshot<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    let connectionBroken = false;
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      // If even the ROLLBACK fails the connection is unusable: release it as broken so the pool discards it.
      connectionBroken = await client.query('ROLLBACK').then(
        () => false,
        () => true,
      );
      throw error;
    } finally {
      client.release(connectionBroken);
    }
  }
}

function toWallet(row: WalletRow): Wallet {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    currency: row.currency,
    openingBalanceMinor: BigInt(row.opening_balance_minor),
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toWalletWithBalance(row: WalletBalanceRow): WalletWithBalance {
  return { wallet: toWallet(row), balanceMinor: BigInt(row.balance_minor) };
}

function toTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    walletId: row.wallet_id,
    kind: row.kind,
    amountMinor: BigInt(row.amount_minor),
    occurredOn: row.occurred_on,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
