import { BadRequestException } from '@nestjs/common';
import { IsString } from 'class-validator';
import { createValidationPipe } from './validation-pipe';

class SampleDto {
  @IsString({ message: 'Enter a name.' })
  name!: string;
}

/** `[[[…['bottom']…]]]`, `depth` levels deep, built without recursion. */
function nestedArrays(depth: number): unknown {
  let value: unknown = 'bottom';
  for (let level = 0; level < depth; level++) {
    value = [value];
  }
  return value;
}

describe('createValidationPipe', () => {
  const pipe = createValidationPipe();
  const transform = (body: unknown) => pipe.transform(body, { type: 'body', metatype: SampleDto });

  it('passes a valid body through as a DTO instance', async () => {
    // Arrange
    const body = { name: 'Cash' };

    // Act
    const result = await transform(body);

    // Assert
    expect(result).toBeInstanceOf(SampleDto);
    expect(result).toEqual({ name: 'Cash' });
  });

  it('answers 400 with the field’s message for an invalid body', async () => {
    // Arrange
    const body = { name: 42 };

    // Act
    const outcome = transform(body);

    // Assert
    await expect(outcome).rejects.toMatchObject({
      response: { statusCode: 400, message: ['Enter a name.'], error: 'Bad Request' },
    });
  });

  it('answers 400, not a stack overflow (a 500), for a body nested thousands of levels deep', async () => {
    // Arrange: Nest's own pipe recurses over the whole body, so a crafted body would otherwise overflow the stack
    const body = { name: nestedArrays(20000) };

    // Act
    const outcome = transform(body);

    // Assert
    await expect(outcome).rejects.toBeInstanceOf(BadRequestException);
    await expect(outcome).rejects.toMatchObject({
      response: {
        statusCode: 400,
        message: 'Request body is nested too deeply.',
        error: 'Bad Request',
      },
    });
  });

  it('does not hide other failures: an error that is not a stack overflow is rethrown unchanged', async () => {
    // Arrange: a metatype whose reflection blows up in a different way
    const failure = new TypeError('something else broke');
    const body = {
      get name(): string {
        throw failure;
      },
    };

    // Act
    const outcome = transform(body);

    // Assert
    await expect(outcome).rejects.toBe(failure);
  });
});
