import { BadRequestException } from '@nestjs/common';
import { createValidationPipe } from '../../src/validation-pipe';

/** Runs bodies through the production ValidationPipe for one DTO class — nothing mocked. */
export function dtoValidation(metatype: new () => object) {
  const pipe = createValidationPipe();

  /** The DTO instance a valid body becomes; rejects with a BadRequestException for an invalid one. */
  const validate = (body: unknown) => pipe.transform(body, { type: 'body', metatype });

  /** The `message[]` of the 400 an invalid body is answered with. */
  const rejectionMessages = async (body: unknown): Promise<string[]> => {
    try {
      await validate(body);
    } catch (error) {
      if (error instanceof BadRequestException) {
        return (error.getResponse() as { message: string[] }).message;
      }
      throw error;
    }
    throw new Error('expected the body to be rejected');
  };

  return { validate, rejectionMessages };
}
