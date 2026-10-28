import { Transform } from 'class-transformer';
import { IsEmail, Matches } from 'class-validator';
import { IdentityMessage } from '../identity.messages';
import { normaliseEmail } from './normalise-email';

/**
 * 8–128 characters with at least one letter ([A-Za-z]), one digit and one symbol (anything that is not a
 * letter, digit or whitespace). One pattern, so a bad password yields the one rule message exactly once.
 */
const PASSWORD_RULE = /^(?=[\s\S]*[A-Za-z])(?=[\s\S]*[0-9])(?=[\s\S]*[^A-Za-z0-9\s])[\s\S]{8,128}$/;

/** Body of `POST /api/v1/users`. */
export class SignUpDto {
  /** Trimmed and lower-cased before validation; must be a valid email address (≤ 254 characters). */
  @Transform(({ value }) => normaliseEmail(value))
  @IsEmail({}, { message: IdentityMessage.invalidEmail })
  email!: string;

  /** 8–128 characters with at least one letter, one number and one symbol. */
  @Matches(PASSWORD_RULE, { message: IdentityMessage.passwordRule })
  password!: string;
}
