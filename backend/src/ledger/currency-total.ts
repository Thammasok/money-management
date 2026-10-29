import type { WalletWithBalance } from './wallet.entity';

/**
 * The exact sum of the Balances of the Wallets that share one Currency (epic: Domain Language → Currency Total).
 * Never mixes Currencies; may be zero or negative, and may exceed 15 digits (and 2^53).
 */
export interface CurrencyTotal {
  /** ISO-4217 code. */
  currency: string;
  /** In minor units of `currency`. */
  balanceMinor: bigint;
}

/**
 * One Currency Total per Currency held by at least one of the Wallets, ordered by Currency code. Archived Wallets
 * count like any other (their Balance is still money the User holds); a Currency whose Balances add up to zero still
 * has its line. No Wallets, no lines. Every addition is a `bigint`, so nothing is ever rounded.
 */
export function currencyTotalsOf(wallets: readonly WalletWithBalance[]): CurrencyTotal[] {
  const balanceByCurrency = new Map<string, bigint>();
  for (const { wallet, balanceMinor } of wallets) {
    balanceByCurrency.set(
      wallet.currency,
      (balanceByCurrency.get(wallet.currency) ?? 0n) + balanceMinor,
    );
  }
  return (
    [...balanceByCurrency]
      .map(([currency, balanceMinor]) => ({ currency, balanceMinor }))
      // Currency codes are upper-case ASCII, so code-unit order is alphabetical; the keys are unique, so there are no ties.
      .sort((a, b) => (a.currency < b.currency ? -1 : 1))
  );
}
