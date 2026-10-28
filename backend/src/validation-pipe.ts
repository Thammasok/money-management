import { BadRequestException, ValidationPipe } from '@nestjs/common';
import type { ArgumentMetadata } from '@nestjs/common';

/**
 * Nest's ValidationPipe walks the whole request body recursively (it strips `__proto__` keys, then transforms and
 * validates). A body nested thousands of levels deep — which fits easily inside the 100 KB body limit — overflows the
 * stack and would be answered with a 500. A body that deep is not a valid request, so it is a 400.
 * Only the stack overflow is translated; every other failure passes through untouched.
 */
class BoundedValidationPipe extends ValidationPipe {
  override async transform(value: unknown, metadata: ArgumentMetadata): Promise<unknown> {
    try {
      return await super.transform(value, metadata);
    } catch (error) {
      if (error instanceof RangeError) {
        throw new BadRequestException('Request body is nested too deeply.');
      }
      throw error;
    }
  }
}

/**
 * The one ValidationPipe the whole API uses (`configureApp` registers it globally; DTO specs exercise it directly).
 * - `whitelist`: properties a DTO does not declare are dropped — a body cannot smuggle extra fields in.
 * - `transform`: bodies become DTO instances, so `@Transform` (email normalisation) runs before validation.
 * - `stopAtFirstError`: one message per field, so the Web App shows each message once.
 * A failure is a 400 with the default `{ statusCode, message: string[], error: 'Bad Request' }` body.
 */
export function createValidationPipe(): ValidationPipe {
  return new BoundedValidationPipe({ whitelist: true, transform: true, stopAtFirstError: true });
}
