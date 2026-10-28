import type { NewTransaction, Transaction } from '../transaction.entity';
import type { NewWallet, Wallet, WalletDetail } from '../wallet.entity';

/**
 * Data Access for Wallets and Transactions — the only code that reads or writes these tables. Every read and write is
 * scoped to the Wallets a User owns in ONE place (F-4 widens "owns" to "can see"), so no query can forget the rule.
 * Money comes back as `bigint`, `occurredOn` as the exact `YYYY-MM-DD` string.
 */
export interface ILedgerRepository {
  /** Stores a Wallet and returns it with its generated id and timestamps. */
  insertWallet(newWallet: NewWallet): Promise<Wallet>;

  /** The Wallets `userId` owns, newest `createdAt` first (ties by `id` descending). */
  listWalletsOwnedBy(userId: string): Promise<Wallet[]>;

  /** The Wallet when `userId` owns it; null when it does not exist and when it is another User's, alike. */
  findOwnedWallet(userId: string, walletId: string): Promise<Wallet | null>;

  /**
   * The owned Wallet with its Balance (derived by the database) and its Transactions, read from one snapshot so the
   * Balance always agrees with the list. Null when `userId` does not own it.
   */
  findOwnedWalletDetail(userId: string, walletId: string): Promise<WalletDetail | null>;

  /** Stores a Transaction in a Wallet the caller already established is visible; returns it with its id and timestamps. */
  insertTransaction(newTransaction: NewTransaction): Promise<Transaction>;
}
