import { ApiError } from '../http/api-error';
import { GENERIC_FAILURE_TEXT } from '../http/failure-messages';

// Everything the person reads about Wallets and Transactions. The Web App holds no Ledger rules: for a 400, 401 and
// 404 it shows the backend's own sentence (artifacts/F-2/01-requirements.md → Error message catalogue); only what the
// backend cannot know is written here — the empty states, the two checks the Web App makes before sending anything,
// the 404 screen's text, and the fallback.

export const NO_WALLETS_TEXT = 'No wallets yet.';
export const NO_TRANSACTIONS_TEXT = 'No transactions yet.';
/** The text of the Wallet screen for a Wallet that is not the person's, does not exist, or whose id is not an id. */
export const WALLET_NOT_FOUND_TEXT = 'Wallet not found.';
/** No Currency picked on Create Wallet: refused before anything is sent. */
export const CHOOSE_CURRENCY_TEXT = 'Choose a supported currency.';
/** Typed text that cannot be read as an amount of the Wallet's Currency: refused before anything is sent. */
export const INVALID_AMOUNT_TEXT = 'Enter a valid amount.';
/**
 * The Transaction was saved but the Wallet could not be read again, so the Balance on screen would be out of date.
 * Said plainly — never as "something went wrong" — so the person does not record it a second time.
 */
export const SAVED_BUT_NOT_REFRESHED_TEXT =
  'Saved, but this page could not be refreshed. Reload it to see the new Balance.';

/** Statuses whose backend message is written for the person to read. */
const SHOWN_AS_SENT = new Set([400, 401, 404]);

/** One line per message to show after a failed Wallet request: the backend's own, or the generic sentence. */
export function describeWalletFailure(error: unknown): string[] {
  if (error instanceof ApiError && SHOWN_AS_SENT.has(error.status) && error.messages.length > 0) {
    return error.messages;
  }
  return [GENERIC_FAILURE_TEXT];
}
