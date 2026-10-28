import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { IdentityMessage } from '../identity.messages';
import { normaliseEmail } from './normalise-email';

/** Body of `POST /api/v1/sessions`. Sign-in applies no password rule — only "a non-empty string". */
export class SignInDto {
  /**
   * Trimmed and lower-cased before validation; a non-empty string of at most 254 characters (no User can have a
   * longer email, so a longer one is refused up front rather than stored as a failed guess).
   * Decorators run bottom-up and validation stops at the first failure, so the length check stays on top: it must
   * only be reached by a non-empty string.
   */
  @Transform(({ value }) => normaliseEmail(value))
  @MaxLength(254, { message: IdentityMessage.invalidEmail })
  @IsString({ message: IdentityMessage.emailRequired })
  @IsNotEmpty({ message: IdentityMessage.emailRequired })
  email!: string;

  /** A non-empty string, checked against the stored hash. */
  @IsString({ message: IdentityMessage.passwordRequired })
  @IsNotEmpty({ message: IdentityMessage.passwordRequired })
  password!: string;
}
