import type { NewTransaction, Transaction } from '../transaction.entity';
import type {
  NewWallet,
  Wallet,
  WalletChange,
  WalletDetail,
  WalletWithBalance,
} from '../wallet.entity';

/**
 * Data Access for Wallets and Transactions — the only code that reads or writes these tables. Every read and write is
 * scoped to the Wallets a User owns in ONE place (F-4 widens "owns" to "can see"), so no query can forget the rule.
 * Money comes back as `bigint`, `occurredOn` as the exact `YYYY-MM-DD` string.
 */
export interface ILedgerRepository {
  /** Stores a Wallet and returns it with its generated id and timestamps. */
  insertWallet(newWallet: NewWallet): Promise<Wallet>;

  /**
   * The Wallets `userId` owns — Archived ones included — each with its Balance (derived by the database), newest
   * `createdAt` first (ties by `id` descending).
   */
  listWalletsOwnedBy(userId: string): Promise<WalletWithBalance[]>;

  /** The Wallet when `userId` owns it; null when it does not exist and when it is another User's, alike. */
  findOwnedWallet(userId: string, walletId: string): Promise<Wallet | null>;

  /**
   * The owned Wallet with its Balance (derived by the database) and its Transactions, read from one snapshot so the
   * Balance always agrees with the list. Null when `userId` does not own it.
   */
  findOwnedWalletDetail(userId: string, walletId: string): Promise<WalletDetail | null>;

  /**
   * Applies `change` to the Wallet `userId` owns, in ONE statement: the name and the archive take effect together
   * (both bump `updatedAt`, and an archive stamps `archivedAt` with the same Postgres time) or not at all. Returns the
   * Wallet with its Balance, or null when nothing was applied — the Wallet is not owned by `userId`, or the archive
   * was asked for on a Wallet that is already Archived (which refuses the whole change, a rename included).
   */
  updateOwnedWallet(
    userId: string,
    walletId: string,
    change: WalletChange,
  ): Promise<WalletWithBalance | null>;

  /**
   * Stores a Transaction in a Wallet the caller already established is visible, and returns it with its id and
   * timestamps — or null, storing nothing, when the Wallet is Archived. The archived check and the insert are one
   * statement and the Wallet row stays locked until the insert commits, so an archive can neither slip in between
   * them nor commit while the insert is in flight: every Transaction that is stored commits before the archive does.
   */
  insertTransaction(newTransaction: NewTransaction): Promise<Transaction | null>;
}
