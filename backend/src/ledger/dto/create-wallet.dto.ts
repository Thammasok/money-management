import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { LedgerMessage } from '../ledger.messages';
import { IsWithinMinorUnitLimit, MaxCharacters } from '../validation/validators';
import { cleanText } from './clean-text';

/**
 * Body of `POST /api/v1/wallets`. Property order is the order of messages in a multi-field 400, and decorators run
 * bottom-up with validation stopping at the first failure — so each property lists its checks from the last to run
 * (top) to the first (bottom), and every property reports at most one message.
 */
export class CreateWalletDto {
  /** Trimmed; 1–60 characters after trimming (counted as Postgres counts them). Not unique. */
  @Transform(({ value }) => cleanText(value))
  @MaxCharacters(60, { message: LedgerMessage.walletNameLength })
  @IsNotEmpty({ message: LedgerMessage.walletName })
  @IsString({ message: LedgerMessage.walletName })
  name!: string;

  /**
   * Must be a string here; whether it is a *supported* Currency is asked of Exchange Rates by the service
   * (the DTO stays free of dependencies).
   */
  @IsString({ message: LedgerMessage.currency })
  currency!: string;

  /** A JSON string of minor units, `^-?[0-9]+$`, at most 15 significant digits. Zero and negative allowed. */
  @IsWithinMinorUnitLimit({ message: LedgerMessage.openingBalanceTooLarge })
  @Matches(/^-?[0-9]+$/, { message: LedgerMessage.openingBalanceFormat })
  openingBalanceMinor!: string;
}
