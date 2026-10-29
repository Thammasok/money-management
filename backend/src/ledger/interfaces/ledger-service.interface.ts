import type { CreateWalletDto } from '../dto/create-wallet.dto';
import type {
  TransactionResponseDto,
  WalletDetailResponseDto,
  WalletOverviewResponseDto,
  WalletResponseDto,
} from '../dto/ledger-response.dto';
import type { RecordTransactionDto } from '../dto/record-transaction.dto';
import type { UpdateWalletDto } from '../dto/update-wallet.dto';

/**
 * Business Logic for Wallets and Transactions. Every method acts for the signed-in User (`userId`, from the global
 * guard) and only on Wallets that User owns (F-4 widens this to Members). Errors are Nest HttpExceptions in the
 * default `{ statusCode, message, error }` body:
 * - 400 unsupported Currency, or a PATCH that changes nothing (`message: string[]`, like a DTO failure);
 * - 404 "Wallet not found." for a Wallet that is missing, another User's, or whose id is not a UUID — identical in
 *   all three cases, so nothing reveals that a Wallet exists;
 * - 409 (a string `message`) for a state conflict: archiving an Archived Wallet, recording into one.
 * Where several apply the order is: request shape (400) → not visible (404) → archived (409).
 */
export interface ILedgerService {
  /** Creates a Wallet; the Currency must be on Exchange Rates' list. A new Wallet is active and its Balance is its Opening Balance. */
  createWallet(userId: string, input: CreateWalletDto): Promise<WalletResponseDto>;

  /**
   * The Wallet Overview: the User's Wallets with their Balances, newest first (Archived Wallets in place), and one
   * Currency Total per Currency (Archived Wallets count).
   */
  listWallets(userId: string): Promise<WalletOverviewResponseDto>;

  /** One Wallet with its derived Balance and its Transactions, newest first. */
  getWallet(userId: string, walletId: string): Promise<WalletDetailResponseDto>;

  /**
   * Renames and/or archives the Wallet, and answers it with its Balance. The Currency can never change. A request
   * that names neither is a 400 "Nothing to change." (before the Wallet is looked up); archiving an Archived Wallet
   * is a 409 that refuses the whole request, so a name sent with it is not applied; a rename alone is always allowed.
   */
  updateWallet(
    userId: string,
    walletId: string,
    input: UpdateWalletDto,
  ): Promise<WalletResponseDto>;

  /**
   * Records an Income or an Expense in the Wallet. The request shape was validated before the Wallet is looked up;
   * an Archived Wallet accepts nothing (409), even when it was archived an instant after the lookup.
   */
  recordTransaction(
    userId: string,
    walletId: string,
    input: RecordTransactionDto,
  ): Promise<TransactionResponseDto>;
}
