// The Web App's contract with the Ledger and Exchange Rates (artifacts/F-2/02-flow.md → API Endpoint Map and
// artifacts/F-2/01-requirements.md → Error message catalogue). Shapes mirror the backend exactly
// (backend/src/ledger/dto/ledger-response.dto.ts, backend/src/rates/dto/currency-list-response.dto.ts): JSON in
// camelCase, money as a decimal-integer STRING of minor units (never a number), dates as `YYYY-MM-DD` strings with no
// time and no timezone (AD-1), audit timestamps as ISO-8601 UTC strings.

/** Whether a Transaction brings money into its Wallet or takes it out. */
export type TransactionKind = 'income' | 'expense';

/** One Currency a Wallet may hold, as `GET /currencies` lists it. `minorDigits` is its ISO-4217 decimals (0, 2 or 3). */
export interface Currency {
  code: string;
  name: string;
  minorDigits: number;
}

/** A Wallet as Home lists it (`GET /wallets`). No Balance: Balances join this list with F-3. */
export interface WalletSummary {
  id: string;
  name: string;
  currency: string;
  createdAt: string;
}

/** A Wallet with its Balance, as `POST /wallets` returns it. Both amounts are minor units of `currency`. */
export interface Wallet {
  id: string;
  name: string;
  currency: string;
  openingBalanceMinor: string;
  /** Opening Balance + Income − Expense, derived by the backend on every read; may be negative. */
  balanceMinor: string;
  createdAt: string;
  updatedAt: string;
}

/** One Income or Expense in a Wallet. `amountMinor` is always positive; `kind` says whether money came in or went out. */
export interface Transaction {
  id: string;
  walletId: string;
  kind: TransactionKind;
  amountMinor: string;
  /** The calendar date the person gave, `YYYY-MM-DD`: shown as it is, never turned into a `Date`. */
  occurredOn: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A Wallet with all its Transactions, newest `occurredOn` first, ties by the one recorded later (`GET /wallets/:id`). */
export interface WalletDetail extends Wallet {
  transactions: Transaction[];
}

/** Body of `POST /wallets`. The backend trims and checks the name and asks Exchange Rates about the Currency. */
export interface CreateWalletRequest {
  name: string;
  currency: string;
  /** Minor units of `currency`, a decimal-integer string; zero and negative are allowed (it is not Income). */
  openingBalanceMinor: string;
}

/** Body of `POST /wallets/:walletId/transactions`. */
export interface RecordTransactionRequest {
  kind: TransactionKind;
  /** Minor units of the Wallet's Currency, a positive decimal-integer string. */
  amountMinor: string;
  occurredOn: string;
  /** Optional; the backend trims it and turns a blank one into `null`. */
  note?: string | null;
  /** The browser's local date, sent with every Transaction so the backend can refuse a later `occurredOn` (Q-45). */
  today: string;
}

/**
 * Everything the screens need from the Ledger and Exchange Rates. The only implementation that talks to the network is
 * `HttpWalletService`; tests inject a mock. The Web App holds no money rules beyond turning typed text into minor
 * units and back — it shows what the backend says.
 *
 * Rejections: a non-2xx answer rejects with `ApiError` (400 `messages` one per broken rule, 401, 404 for a Wallet that
 * is not the person's, does not exist, or whose id is not an id); a transport failure rejects with whatever `fetch`
 * rejected with. Callers treat anything that is not an `ApiError` as "something went wrong".
 */
export interface IWalletService {
  /** The supported Currencies with their digits (`GET /currencies`), sorted by code. */
  listCurrencies(): Promise<Currency[]>;
  /** The signed-in User's Wallets, newest-created first (`GET /wallets`). */
  listWallets(): Promise<WalletSummary[]>;
  /** Creates a Wallet (`POST /wallets`). Rejects with `ApiError` 400 when a rule is broken. */
  createWallet(request: CreateWalletRequest): Promise<Wallet>;
  /** One Wallet with its Balance and Transactions (`GET /wallets/:walletId`). Rejects with `ApiError` 404 when not found. */
  getWallet(walletId: string): Promise<WalletDetail>;
  /** Records a Transaction (`POST /wallets/:walletId/transactions`); the answer is the Transaction, not the new Balance. */
  recordTransaction(walletId: string, request: RecordTransactionRequest): Promise<Transaction>;
}

/** What the person typed on Create Wallet, exactly as typed. */
export interface TypedWallet {
  name: string;
  /** The chosen Currency code, or `''` when none is chosen. */
  currency: string;
  openingBalance: string;
}

/** What the person entered on the record form, exactly as entered. */
export interface TypedTransaction {
  kind: TransactionKind;
  amount: string;
  date: string;
  note: string;
}
