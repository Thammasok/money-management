import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Matches } from 'class-validator';
import { LedgerMessage } from '../ledger.messages';
import type { TransactionKind } from '../transaction.entity';
import {
  IsCalendarDate,
  IsNotAfter,
  IsPositiveMinorUnits,
  IsWithinMinorUnitLimit,
  MaxCharacters,
} from '../validation/validators';
import { textOrNull } from './clean-text';

/**
 * Body of `POST /api/v1/wallets/:walletId/transactions`. Property order is the order of messages in a multi-field
 * 400, and decorators run bottom-up with validation stopping at the first failure — so each property lists its checks
 * from the last to run (top) to the first (bottom), and every property reports at most one message.
 */
export class RecordTransactionDto {
  @IsIn(['income', 'expense'], { message: LedgerMessage.kind })
  kind!: TransactionKind;

  /** A JSON string of minor units, `^[0-9]+$`, greater than 0, at most 15 significant digits. */
  @IsWithinMinorUnitLimit({ message: LedgerMessage.amountTooLarge })
  @IsPositiveMinorUnits({ message: LedgerMessage.amountPositive })
  @Matches(/^[0-9]+$/, { message: LedgerMessage.amountFormat })
  amountMinor!: string;

  /** A real calendar date `YYYY-MM-DD`, not after `today`. */
  @IsNotAfter('today', { message: LedgerMessage.futureDate })
  @IsCalendarDate({ message: LedgerMessage.occurredOn })
  occurredOn!: string;

  /** Optional; trimmed; blank means no note; at most 200 characters (counted as Postgres counts them). */
  @IsOptional()
  @Transform(({ value }) => textOrNull(value))
  @MaxCharacters(200, { message: LedgerMessage.note })
  @IsString({ message: LedgerMessage.note })
  note?: string | null;

  /** The browser's local date (Q-45). Only used for the future-date check — never stored. */
  @IsCalendarDate({ message: LedgerMessage.today })
  today!: string;
}
