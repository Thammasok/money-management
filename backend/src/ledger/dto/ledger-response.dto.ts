import type { TransactionKind } from '../transaction.entity';

// What the API shows of Wallets and Transactions: money is a decimal-integer string (JSON numbers cannot carry a
// bigint), `occurredOn` is the stored `YYYY-MM-DD` string, audit timestamps are ISO-8601 UTC strings.

/** One Wallet in a list — enough to navigate to it and to default a new Wallet's Currency (Q-11). */
export interface WalletSummaryResponseDto {
  id: string;
  name: string;
  currency: string;
  createdAt: string;
}

/** Body of `GET /api/v1/wallets`: the Wallets the User owns, newest first. */
export interface WalletListResponseDto {
  wallets: WalletSummaryResponseDto[];
}

/** A Wallet with its derived Balance. Exactly these keys — never `userId`. */
export interface WalletResponseDto {
  id: string;
  name: string;
  currency: string;
  openingBalanceMinor: string;
  balanceMinor: string;
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
