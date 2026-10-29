import type { TransactionKind } from '../transaction.entity';

// What the API shows of Wallets and Transactions: money is a decimal-integer string (JSON numbers cannot carry a
// bigint), `occurredOn` is the stored `YYYY-MM-DD` string, audit timestamps are ISO-8601 UTC strings.

/**
 * One Wallet in the Wallet Overview — its Balance, whether it is Archived, and enough to navigate to it and to default
 * a new Wallet's Currency (Q-11). Exactly these keys.
 */
export interface WalletOverviewItemResponseDto {
  id: string;
  name: string;
  currency: string;
  balanceMinor: string;
  /** ISO-8601 UTC instant the Wallet was archived; null while it is active. */
  archivedAt: string | null;
  createdAt: string;
}

/** One Currency Total line: the exact sum of the Balances of the owned Wallets in one Currency. Exactly these keys. */
export interface CurrencyTotalResponseDto {
  currency: string;
  balanceMinor: string;
}

/**
 * Body of `GET /api/v1/wallets`: the Wallets the User owns, newest first (archived ones in place), and one Currency
 * Total per Currency ordered by code — `[]` when the User has no Wallets.
 */
export interface WalletOverviewResponseDto {
  wallets: WalletOverviewItemResponseDto[];
  currencyTotals: CurrencyTotalResponseDto[];
}

/** A Wallet with its derived Balance. Exactly these keys — never `userId`. */
export interface WalletResponseDto {
  id: string;
  name: string;
  currency: string;
  openingBalanceMinor: string;
  balanceMinor: string;
  /** ISO-8601 UTC instant the Wallet was archived; null while it is active. */
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** One Transaction. Exactly these keys. */
export interface TransactionResponseDto {
  id: string;
  walletId: string;
  kind: TransactionKind;
  amountMinor: string;
  occurredOn: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Body of `GET /api/v1/wallets/:walletId`: the Wallet plus its Transactions, newest first. */
export interface WalletDetailResponseDto extends WalletResponseDto {
  transactions: TransactionResponseDto[];
}
