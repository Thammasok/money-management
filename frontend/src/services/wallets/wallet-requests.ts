import { toMinorUnits } from '../../money/to-minor-units';
import { CHOOSE_CURRENCY_TEXT, INVALID_AMOUNT_TEXT } from './wallet-messages';
import type {
  CreateWalletRequest,
  Currency,
  RecordTransactionRequest,
  TypedTransaction,
  TypedWallet,
} from './wallet.types';

/** Either the request to send, or the Web App's own refusal — nothing is sent for a refusal. */
type Parsed<Request> = { ok: true; request: Request } | { ok: false; error: string };

/**
 * Create Wallet's typed values → the request body (artifacts/F-2/02-flow.md → Flow Step 3). Refuses, in this order and
 * with one message, a Currency that is not picked and an Opening Balance that cannot be read as minor units of it. The
 * name goes as typed: the backend trims and checks it.
 */
export function toCreateWalletRequest(
  typed: TypedWallet,
  currencies: readonly Currency[],
): Parsed<CreateWalletRequest> {
  const currency = currencies.find((candidate) => candidate.code === typed.currency);
  if (currency === undefined) return { ok: false, error: CHOOSE_CURRENCY_TEXT };

  const openingBalanceMinor = toMinorUnits(typed.openingBalance, currency.minorDigits, {
    allowNegative: true,
  });
  if (openingBalanceMinor === null) return { ok: false, error: INVALID_AMOUNT_TEXT };

  return { ok: true, request: { name: typed.name, currency: currency.code, openingBalanceMinor } };
}

/**
 * The record form's entered values → the request body (artifacts/F-2/02-flow.md → Flow Step 5). Refuses an amount that
 * cannot be read as minor units of the Wallet's Currency. An amount of 0 and a date after `today` go on to the
 * backend, whose rules they are; `today` is the browser's local date, which the backend compares the date with.
 */
export function toRecordTransactionRequest(
  typed: TypedTransaction,
  minorDigits: number,
  today: string,
): Parsed<RecordTransactionRequest> {
  const amountMinor = toMinorUnits(typed.amount, minorDigits, { allowNegative: false });
  if (amountMinor === null) return { ok: false, error: INVALID_AMOUNT_TEXT };

  return {
    ok: true,
    request: { kind: typed.kind, amountMinor, occurredOn: typed.date, note: typed.note, today },
  };
}
