import { Inject, Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { PG_POOL } from '../database/database.tokens';
import type { ILedgerRepository } from './interfaces/ledger-repository.interface';
import type { NewTransaction, Transaction, TransactionKind } from './transaction.entity';
import type { NewWallet, Wallet, WalletDetail } from './wallet.entity';

// BIGINT comes back from `pg` as a string and `occurred_on` (DATE) as the exact 'YYYY-MM-DD' string — the Pool is
// created by `createPool` (database/create-pool.ts), which is what guarantees both.
interface WalletRow {
  id: string;
  user_id: string;
  name: string;
  currency: string;
  opening_balance_minor: string;
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
  'w.id, w.user_id, w.name, w.currency, w.opening_balance_minor, w.created_at, w.updated_at';
const TRANSACTION_COLUMNS =
  't.id, t.wallet_id, t.kind, t.amount_minor, t.occurred_on, t.note, t.created_at, t.updated_at';

/**
 * The visibility rule, written once, for a Wallet aliased `w` with `$1` = the Wallet id and `$2` = the User id: a
 * Wallet is visible to the User who owns it. F-4 widens this one condition to "owns it or is a Member of it".
 */
const WALLET_IS_VISIBLE = 'w.id = $1 AND w.user_id = $2';

/**
 * A visible Wallet with its Balance (`$1` = Wallet id, `$2` = User id). Opening Balance + Σ income − Σ expense, summed
 * in NUMERIC so it cannot overflow, and read as text so it never becomes a JS number. A Wallet with no Transactions
 * sums NULL, hence the COALESCE: its Balance is its Opening Balance.
 */
const SELECT_WALLET_WITH_BALANCE = `
  SELECT ${WALLET_COLUMNS},
         (w.opening_balance_minor
           + COALESCE(SUM(CASE t.kind WHEN 'income' THEN t.amount_minor
                                      WHEN 'expense' THEN -t.amount_minor END), 0))::text AS balance_minor
  FROM wallets w
  LEFT JOIN transactions t ON t.wallet_id = w.id
  WHERE ${WALLET_IS_VISIBLE}
  GROUP BY w.id`;

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

  async listWalletsOwnedBy(userId: string): Promise<Wallet[]> {
    const { rows } = await this.pool.query<WalletRow>(
      `SELECT ${WALLET_COLUMNS} FROM wallets w
       WHERE w.user_id = $1
       ORDER BY w.created_at DESC, w.id DESC`,
      [userId],
    );
    return rows.map(toWallet);
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
        wallet: toWallet(walletRows[0]),
        balanceMinor: BigInt(walletRows[0].balance_minor),
        transactions: transactionRows.map(toTransaction),
      };
    });
  }

  async insertTransaction(newTransaction: NewTransaction): Promise<Transaction> {
    const { rows } = await this.pool.query<TransactionRow>(
      `INSERT INTO transactions AS t (wallet_id, kind, amount_minor, occurred_on, note)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${TRANSACTION_COLUMNS}`,
      [
        newTransaction.walletId,
        newTransaction.kind,
        newTransaction.amountMinor.toString(),
        newTransaction.occurredOn,
        newTransaction.note,
      ],
    );
    return toTransaction(rows[0]);
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
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
