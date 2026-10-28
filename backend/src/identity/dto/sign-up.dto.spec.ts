import { BadRequestException } from '@nestjs/common';
import { dtoValidation } from '../../../test/support/dto-validation';
import { SignUpDto } from './sign-up.dto';

// Exact texts: artifacts/F-1/02-flow.md → Error message catalogue.
const INVALID_EMAIL = 'Enter a valid email address.';
const PASSWORD_RULE =
  'Password must be at least 8 characters and include a letter, a number, and a symbol.';

describe('SignUpDto (validated by the global ValidationPipe)', () => {
  const { validate, rejectionMessages } = dtoValidation(SignUpDto);

  describe('accepted bodies', () => {
    it('passes a valid email and password through as a SignUpDto', async () => {
      // Arrange
      const body = { email: 'new@example.test', password: 'Sunny-Day-42' };

      // Act
      const result = await validate(body);

      // Assert
      expect(result).toBeInstanceOf(SignUpDto);
      expect(result).toEqual({ email: 'new@example.test', password: 'Sunny-Day-42' });
    });

    it('trims and lower-cases the email (S-5)', async () => {
      // Arrange
      const body = { email: '  Mixed.Case@Example.TEST  ', password: 'Sunny-Day-42' };

      // Act
      const result = (await validate(body)) as SignUpDto;

      // Assert
      expect(result.email).toBe('mixed.case@example.test');
    });

    it('accepts the shortest valid password: 8 characters, one letter, one number, one symbol (S-7)', async () => {
      // Arrange
      const body = { email: 'short@example.test', password: 'abcdef1!' };

      // Act
      const result = (await validate(body)) as SignUpDto;

      // Assert
      expect(result.password).toBe('abcdef1!');
    });

    it('accepts the longest valid password: 128 characters', async () => {
      // Arrange
      const password = 'Aa1!' + 'x'.repeat(124);
      const body = { email: 'long@example.test', password };

      // Act
      const result = (await validate(body)) as SignUpDto;

      // Assert
      expect(password).toHaveLength(128);
      expect(result.password).toBe(password);
    });

    it('drops properties the DTO does not declare, so a body cannot smuggle extra fields (mass assignment)', async () => {
      // Arrange
      const body = { email: 'new@example.test', password: 'Sunny-Day-42', id: 'x', isAdmin: true };

      // Act
      const result = await validate(body);

      // Assert
      expect(result).toEqual({ email: 'new@example.test', password: 'Sunny-Day-42' });
    });
  });

  describe('password rule', () => {
    it.each([
      ['under 8 characters', 'abc1!'],
      ['no symbol', 'password1'],
      ['no number', 'password!!'],
      ['no letter', '12345678!'],
      ['only a space where the symbol should be (whitespace is not a symbol)', 'abc 1234'],
      ['empty', ''],
      ['129 characters', 'Aa1!' + 'x'.repeat(125)],
      ['not a string (number)', 12345678],
      ['missing', undefined],
    ])(
      'rejects a password that is %s with exactly the password rule message',
      async (_why, password) => {
        // Arrange
        const body = { email: 'weak@example.test', password };

        // Act
        const messages = await rejectionMessages(body);

        // Assert
        expect(messages).toEqual([PASSWORD_RULE]);
      },
    );
  });

  describe('email', () => {
    it.each([
      ['not an email address', 'not-an-email'],
      ['empty', ''],
      ['only spaces', '   '],
      ['not a string (number)', 123],
      ['missing', undefined],
      ['over 254 characters', 'a'.repeat(250) + '@example.test'],
    ])('rejects an email that is %s with exactly the email message', async (_why, email) => {
      // Arrange
      const body = { email, password: 'Sunny-Day-42' };

      // Act
      const messages = await rejectionMessages(body);

      // Assert
      expect(messages).toEqual([INVALID_EMAIL]);
    });
  });

  it('reports both messages when the email and the password are both wrong', async () => {
    // Arrange
    const body = { email: '', password: '' };

    // Act
    const messages = await rejectionMessages(body);

    // Assert
    expect(messages).toHaveLength(2);
    expect(messages).toEqual(expect.arrayContaining([INVALID_EMAIL, PASSWORD_RULE]));
  });

  it('answers a 400 with the default Nest error body', async () => {
    // Arrange
    const body = { email: 'not-an-email', password: 'Sunny-Day-42' };

    // Act
    const error = await validate(body).catch((e: unknown) => e);

    // Assert
    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).getResponse()).toEqual({
      statusCode: 400,
      message: [INVALID_EMAIL],
      error: 'Bad Request',
    });
  });
});
