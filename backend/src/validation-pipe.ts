import { ValidationPipe } from '@nestjs/common';

/**
 * The one ValidationPipe the whole API uses (`configureApp` registers it globally; DTO specs exercise it directly).
 * - `whitelist`: properties a DTO does not declare are dropped — a body cannot smuggle extra fields in.
 * - `transform`: bodies become DTO instances, so `@Transform` (email normalisation) runs before validation.
 * - `stopAtFirstError`: one message per field, so the Web App shows each message once.
 * A failure is a 400 with the default `{ statusCode, message: string[], error: 'Bad Request' }` body.
 */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({ whitelist: true, transform: true, stopAtFirstError: true });
}
