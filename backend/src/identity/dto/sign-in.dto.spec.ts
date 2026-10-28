import { dtoValidation } from '../../../test/support/dto-validation';
import { SignInDto } from './sign-in.dto';

// Exact texts: artifacts/F-1/02-flow.md → Error message catalogue.
const EMAIL_REQUIRED = 'Enter your email.';
const PASSWORD_REQUIRED = 'Enter your password.';

describe('SignInDto (validated by the global ValidationPipe)', () => {
  const { validate, rejectionMessages } = dtoValidation(SignInDto);

  describe('accepted bodies', () => {
    it('passes an email and a password through as a SignInDto', async () => {
      // Arrange
      const body = { email: 'me@example.test', password: 'Sunny-Day-42' };

      // Act
      const result = await validate(body);

      // Assert
      expect(result).toBeInstanceOf(SignInDto);
      expect(result).toEqual({ email: 'me@example.test', password: 'Sunny-Day-42' });
    });

    it('trims and lower-cases the email, so sign-in ignores letter case (S-6)', async () => {
      // Arrange
      const body = { email: ' CASE-X@EXAMPLE.test ', password: 'Sunny-Day-42' };

      // Act
      const result = (await validate(body)) as SignInDto;

      // Assert
      expect(result.email).toBe('case-x@example.test');
    });

    it.each([
      ['a weak password (sign-in applies no password rule)', 'a'],
      ['a password of only spaces (it is non-empty)', '   '],
    ])('accepts %s', async (_why, password) => {
      // Arrange
      const body = { email: 'me@example.test', password };

      // Act
      const result = (await validate(body)) as SignInDto;

      // Assert
      expect(result.password).toBe(password);
    });

    it('accepts an email of exactly 254 characters, the longest sign-up allows', async () => {
      // Arrange
      const email = 'a'.repeat(241) + '@example.test';
      const body = { email, password: 'Sunny-Day-42' };

      // Act
      const result = (await validate(body)) as SignInDto;

      // Assert
      expect(email).toHaveLength(254);
      expect(result.email).toBe(email);
    });

    it('drops properties the DTO does not declare', async () => {
      // Arrange
      const body = { email: 'me@example.test', password: 'Sunny-Day-42', role: 'admin' };

      // Act
      const result = await validate(body);

      // Assert
      expect(result).toEqual({ email: 'me@example.test', password: 'Sunny-Day-42' });
    });
  });

  describe('rejected bodies', () => {
    it.each([
      ['empty', ''],
      ['only spaces', '   '],
      ['not a string (number)', 42],
      ['missing', undefined],
    ])('rejects an email that is %s with exactly "Enter your email."', async (_why, email) => {
      // Arrange
      const body = { email, password: 'Sunny-Day-42' };

      // Act
      const messages = await rejectionMessages(body);

      // Assert
      expect(messages).toEqual([EMAIL_REQUIRED]);
    });

    it('rejects an email over 254 characters — no User can have one — so a failed guess cannot store an unbounded value', async () => {
      // Arrange
      const email = 'a'.repeat(242) + '@example.test';
      const body = { email, password: 'Sunny-Day-42' };

      // Act
      const messages = await rejectionMessages(body);

      // Assert
      expect(email).toHaveLength(255);
      expect(messages).toEqual(['Enter a valid email address.']);
    });

    it.each([
      ['empty', ''],
      ['not a string (number)', 42],
      ['missing', undefined],
    ])(
      'rejects a password that is %s with exactly "Enter your password."',
      async (_why, password) => {
        // Arrange
        const body = { email: 'me@example.test', password };

        // Act
        const messages = await rejectionMessages(body);

        // Assert
        expect(messages).toEqual([PASSWORD_REQUIRED]);
      },
    );

    it('reports both messages when the email and the password are both missing', async () => {
      // Arrange
      const body = { email: '', password: '' };

      // Act
      const messages = await rejectionMessages(body);

      // Assert
      expect(messages).toHaveLength(2);
      expect(messages).toEqual(expect.arrayContaining([EMAIL_REQUIRED, PASSWORD_REQUIRED]));
    });
  });
});
