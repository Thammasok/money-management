// Canonical F-2 test data (artifacts/F-2/03-scenarios.md → Test Data).
// Message texts are the catalogue in artifacts/F-2/01-requirements.md — shared with the backend, the
// Mountebank impostor (mocks/ledger-api.inject.js) and the Bruno collection (collection/F-2): change all or none.
export { uniqueEmail } from '../../F-1/fixtures/test-data';
export { Passwords } from '../../F-1/fixtures/test-data';

export const Messages = {
  noWallets: 'No wallets yet.',
  noTransactions: 'No transactions yet.',
  walletName: 'Enter a wallet name.',
  walletNameLength: 'Wallet name must be at most 60 characters.',
  currency: 'Choose a supported currency.',
  invalidAmount: 'Enter a valid amount.', // Web App only — nothing is sent
  amountPositive: 'Amount must be greater than 0.',
  futureDate: "Date can't be in the future.",
  walletNotFound: 'Wallet not found.',
} as const;

/** Currencies the specs use, with their ISO-4217 minor digits (the snapshot holds 30). */
export const Currencies = {
  THB: { code: 'THB', minorDigits: 2 },
  USD: { code: 'USD', minorDigits: 2 },
  EUR: { code: 'EUR', minorDigits: 2 },
  JPY: { code: 'JPY', minorDigits: 0 },
} as const;

/** A past leap day — the fixed date that proves the DATE round-trip never shifts (AD-1). */
export const LEAP_DAY = '2024-02-29';

/**
 * The runner's LOCAL calendar date `offsetDays` from today, as `YYYY-MM-DD` — the same clock and the same
 * construction the Web App uses for its pre-filled date and for `today` (never `toISOString()`, which is UTC).
 */
export function localDate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
