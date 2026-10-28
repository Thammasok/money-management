import type { Currency, WalletSummary } from './wallet.types';

/**
 * The Currency Create Wallet starts with (Q-11): that of the User's last-created Wallet — the first of the list, which
 * comes newest first — as long as it is still one a Wallet may hold; otherwise none (`''`).
 */
export function defaultCurrencyFor(
  wallets: readonly WalletSummary[],
  currencies: readonly Currency[],
): string {
  const newest = wallets[0]?.currency ?? '';
  return currencies.some((candidate) => candidate.code === newest) ? newest : '';
}
