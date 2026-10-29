import type { CurrencyTotal } from './currency-total';
import type {
  CurrencyTotalResponseDto,
  TransactionResponseDto,
  WalletDetailResponseDto,
  WalletOverviewItemResponseDto,
  WalletResponseDto,
} from './dto/ledger-response.dto';
import type { Transaction } from './transaction.entity';
import type { Wallet, WalletDetail, WalletWithBalance } from './wallet.entity';

// Entity → API shape: `bigint` money becomes a decimal-integer string (JSON numbers cannot carry a bigint), audit
// timestamps and `archivedAt` become ISO-8601 UTC strings (`archivedAt` null while the Wallet is active),
// `occurredOn` is passed through untouched, and `userId` never leaves.

export function toWalletOverviewItemResponse({
  wallet,
  balanceMinor,
}: WalletWithBalance): WalletOverviewItemResponseDto {
  return {
    id: wallet.id,
    name: wallet.name,
    currency: wallet.currency,
    balanceMinor: balanceMinor.toString(),
    archivedAt: toIsoInstantOrNull(wallet.archivedAt),
    createdAt: wallet.createdAt.toISOString(),
  };
}

export function toCurrencyTotalResponse(currencyTotal: CurrencyTotal): CurrencyTotalResponseDto {
  return {
    currency: currencyTotal.currency,
    balanceMinor: currencyTotal.balanceMinor.toString(),
  };
}

export function toWalletResponse(wallet: Wallet, balanceMinor: bigint): WalletResponseDto {
  return {
    id: wallet.id,
    name: wallet.name,
    currency: wallet.currency,
    openingBalanceMinor: wallet.openingBalanceMinor.toString(),
    balanceMinor: balanceMinor.toString(),
    archivedAt: toIsoInstantOrNull(wallet.archivedAt),
    createdAt: wallet.createdAt.toISOString(),
    updatedAt: wallet.updatedAt.toISOString(),
  };
}

export function toTransactionResponse(transaction: Transaction): TransactionResponseDto {
  return {
    id: transaction.id,
    walletId: transaction.walletId,
    kind: transaction.kind,
    amountMinor: transaction.amountMinor.toString(),
    occurredOn: transaction.occurredOn,
    note: transaction.note,
    createdAt: transaction.createdAt.toISOString(),
    updatedAt: transaction.updatedAt.toISOString(),
  };
}

export function toWalletDetailResponse(detail: WalletDetail): WalletDetailResponseDto {
  return {
    ...toWalletResponse(detail.wallet, detail.balanceMinor),
    transactions: detail.transactions.map(toTransactionResponse),
  };
}

function toIsoInstantOrNull(instant: Date | null): string | null {
  return instant === null ? null : instant.toISOString();
}
