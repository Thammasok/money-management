import type {
  TransactionResponseDto,
  WalletDetailResponseDto,
  WalletResponseDto,
  WalletSummaryResponseDto,
} from './dto/ledger-response.dto';
import type { Transaction } from './transaction.entity';
import type { Wallet, WalletDetail } from './wallet.entity';

// Entity → API shape: `bigint` money becomes a decimal-integer string (JSON numbers cannot carry a bigint), audit
// timestamps become ISO-8601 UTC strings, `occurredOn` is passed through untouched, and `userId` never leaves.

export function toWalletSummaryResponse(wallet: Wallet): WalletSummaryResponseDto {
  return {
    id: wallet.id,
    name: wallet.name,
    currency: wallet.currency,
    createdAt: wallet.createdAt.toISOString(),
  };
}

export function toWalletResponse(wallet: Wallet, balanceMinor: bigint): WalletResponseDto {
  return {
    id: wallet.id,
    name: wallet.name,
    currency: wallet.currency,
    openingBalanceMinor: wallet.openingBalanceMinor.toString(),
    balanceMinor: balanceMinor.toString(),
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
