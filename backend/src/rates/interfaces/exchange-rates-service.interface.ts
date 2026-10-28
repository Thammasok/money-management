import type { Currency } from '../currency.entity';

/**
 * Business Logic of the Exchange Rates module — what other modules may ask of it. F-2 introduces it with the
 * Currency list only (Q-35): a fixed snapshot of Frankfurter's list, no Gateway, no live call. F-10 adds rate
 * fetching behind the same module.
 */
export interface IExchangeRatesService {
  /** Every supported Currency, sorted by `code`. */
  listCurrencies(): readonly Currency[];
  /** Whether `code` is exactly (upper-case, untrimmed) the code of a supported Currency. */
  isSupportedCurrency(code: string): boolean;
}
