import type { CreateWalletDto } from '../dto/create-wallet.dto';
import type {
  TransactionResponseDto,
  WalletDetailResponseDto,
  WalletListResponseDto,
  WalletResponseDto,
} from '../dto/ledger-response.dto';
import type { RecordTransactionDto } from '../dto/record-transaction.dto';

/**
 * Business Logic for Wallets and Transactions. Every method acts for the signed-in User (`userId`, from the global
 * guard) and only on Wallets that User owns (F-4 widens this to Members). Errors are Nest HttpExceptions in the
 * default `{ statusCode, message, error }` body:
 * - 400 unsupported Currency (`message: string[]`, like a DTO failure);
 * - 404 "Wallet not found." for a Wallet that is missing, another User's, or whose id is not a UUID — identical in
 *   all three cases, so nothing reveals that a Wallet exists.
 */
export interface ILedgerService {
  /** Creates a Wallet; the Currency must be on Exchange Rates' list. A new Wallet's Balance is its Opening Balance. */
  createWallet(userId: string, input: CreateWalletDto): Promise<WalletResponseDto>;

  /** The User's Wallets, newest first. */
  listWallets(userId: string): Promise<WalletListResponseDto>;

  /** One Wallet with its derived Balance and its Transactions, newest first. */
  getWallet(userId: string, walletId: string): Promise<WalletDetailResponseDto>;

  /** Records an Income or an Expense in the Wallet. The request shape was validated before the Wallet is looked up. */
  recordTransaction(
    userId: string,
    walletId: string,
    input: RecordTransactionDto,
  ): Promise<TransactionResponseDto>;
}
