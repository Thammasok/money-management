import { Transform } from 'class-transformer';
import { Equals, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { LedgerMessage } from '../ledger.messages';
import { MaxCharacters } from '../validation/validators';
import { cleanText } from './clean-text';

/**
 * Body of `PATCH /api/v1/wallets/:walletId`: rename and/or archive. Property order is the order of messages in a
 * multi-field 400 (`name`, then `archived`), and decorators run bottom-up with validation stopping at the first
 * failure — so each property lists its checks from the last to run (top) to the first (bottom), and every property
 * reports at most one message.
 *
 * Absent and `null` both mean "not changing" (`@IsOptional` skips the checks for both) — so `{ "name": null }` on its
 * own is "Nothing to change.", which the service answers (a 400, judged after the shape and before the Wallet is
 * looked up). Properties not declared here (`currency`, `openingBalanceMinor`, `archivedAt`, …) are dropped by the
 * whitelist: a PATCH can never change what it does not own.
 */
export class UpdateWalletDto {
  /** The new name: trimmed, 1–60 characters (counted as Postgres counts them), exactly the rules of creating a Wallet. */
  @IsOptional()
  @Transform(({ value }) => cleanText(value))
  @MaxCharacters(60, { message: LedgerMessage.walletNameLength })
  @IsNotEmpty({ message: LedgerMessage.walletName })
  @IsString({ message: LedgerMessage.walletName })
  name?: string | null;

  /** Only `true` — a Wallet can be archived, never made active again. */
  @IsOptional()
  @Equals(true, { message: LedgerMessage.archivedValue })
  archived?: true | null;
}
