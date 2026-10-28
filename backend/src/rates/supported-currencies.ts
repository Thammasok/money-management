import type { Currency } from './currency.entity';

/**
 * The supported Currencies: a fixed snapshot of Frankfurter's currency list (`GET /currencies`), verified on
 * 2026-10-29 (artifacts/F-2/01-requirements.md → Supported-Currency snapshot) — Wallet Currencies are limited to
 * what the rate provider covers (Q-22), held here rather than fetched (Q-35). Frankfurter dropped BGN when Bulgaria
 * adopted the euro. If Frankfurter adds or drops a Currency this list is updated by hand.
 *
 * `minorDigits` is ISO-4217, not Frankfurter's: ISK, JPY and KRW have none; no 3-digit Currency (BHD…) is on the list
 * today, but every consumer must still handle 0..3. mocks/ledger-api.inject.js carries the same literal — change both.
 *
 * Sorted by `code`; frozen so nothing can change the list at runtime.
 */
export const SUPPORTED_CURRENCIES: readonly Currency[] = Object.freeze(
  (
    [
      { code: 'AUD', name: 'Australian Dollar', minorDigits: 2 },
      { code: 'BRL', name: 'Brazilian Real', minorDigits: 2 },
      { code: 'CAD', name: 'Canadian Dollar', minorDigits: 2 },
      { code: 'CHF', name: 'Swiss Franc', minorDigits: 2 },
      { code: 'CNY', name: 'Chinese Renminbi Yuan', minorDigits: 2 },
      { code: 'CZK', name: 'Czech Koruna', minorDigits: 2 },
      { code: 'DKK', name: 'Danish Krone', minorDigits: 2 },
      { code: 'EUR', name: 'Euro', minorDigits: 2 },
      { code: 'GBP', name: 'British Pound', minorDigits: 2 },
      { code: 'HKD', name: 'Hong Kong Dollar', minorDigits: 2 },
      { code: 'HUF', name: 'Hungarian Forint', minorDigits: 2 },
      { code: 'IDR', name: 'Indonesian Rupiah', minorDigits: 2 },
      { code: 'ILS', name: 'Israeli New Shekel', minorDigits: 2 },
      { code: 'INR', name: 'Indian Rupee', minorDigits: 2 },
      { code: 'ISK', name: 'Icelandic Króna', minorDigits: 0 },
      { code: 'JPY', name: 'Japanese Yen', minorDigits: 0 },
      { code: 'KRW', name: 'South Korean Won', minorDigits: 0 },
      { code: 'MXN', name: 'Mexican Peso', minorDigits: 2 },
      { code: 'MYR', name: 'Malaysian Ringgit', minorDigits: 2 },
      { code: 'NOK', name: 'Norwegian Krone', minorDigits: 2 },
      { code: 'NZD', name: 'New Zealand Dollar', minorDigits: 2 },
      { code: 'PHP', name: 'Philippine Peso', minorDigits: 2 },
      { code: 'PLN', name: 'Polish Złoty', minorDigits: 2 },
      { code: 'RON', name: 'Romanian Leu', minorDigits: 2 },
      { code: 'SEK', name: 'Swedish Krona', minorDigits: 2 },
      { code: 'SGD', name: 'Singapore Dollar', minorDigits: 2 },
      { code: 'THB', name: 'Thai Baht', minorDigits: 2 },
      { code: 'TRY', name: 'Turkish Lira', minorDigits: 2 },
      { code: 'USD', name: 'United States Dollar', minorDigits: 2 },
      { code: 'ZAR', name: 'South African Rand', minorDigits: 2 },
    ] satisfies Currency[]
  ).map((currency) => Object.freeze(currency)),
);
