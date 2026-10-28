import { formatMinor } from '../money/format-minor';
import type { WalletBalanceProps } from './component-props';

/**
 * Humble: a Wallet's Balance, formatted in the Wallet's own Currency, next to the Currency code. A negative Balance is
 * marked (`data-negative`) so the screen can style it apart; the minus sign in the figure says it in words.
 */
export function WalletBalance({ currency, balanceMinor, minorDigits }: WalletBalanceProps) {
  const isNegative = balanceMinor.startsWith('-');
  return (
    <dl className="flex flex-col gap-3 rounded-box bg-base-200 p-4">
      <div className="flex flex-col gap-1">
        <dt className="text-sm font-semibold text-base-content/70">Balance</dt>
        <dd
          id="wallet-balance"
          data-negative={isNegative ? '' : undefined}
          className="font-display text-4xl font-medium tabular-nums wrap-anywhere data-negative:text-error"
        >
          {formatMinor(balanceMinor, currency, minorDigits)}
        </dd>
      </div>
      <div className="flex items-baseline gap-2">
        <dt className="text-sm font-semibold text-base-content/70">Currency</dt>
        <dd id="wallet-currency" className="text-sm font-semibold tracking-wide">
          {currency}
        </dd>
      </div>
    </dl>
  );
}
