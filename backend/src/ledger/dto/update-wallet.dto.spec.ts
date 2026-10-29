import { dtoValidation } from '../../../test/support/dto-validation';
import { UpdateWalletDto } from './update-wallet.dto';

// Exact texts: artifacts/F-3/01-requirements.md → Error message catalogue (the name texts are F-2's).
const NAME_REQUIRED = 'Enter a wallet name.';
const NAME_TOO_LONG = 'Wallet name must be at most 60 characters.';
const ARCHIVED_ONLY_TRUE = 'Archived can only be set to true.';

describe('UpdateWalletDto (validated by the global ValidationPipe)', () => {
  const { validate, rejectionMessages } = dtoValidation(UpdateWalletDto);

  describe('accepted bodies', () => {
    it('passes a new name through as an UpdateWalletDto (S-3)', async () => {
      // Arrange
      const body = { name: 'Daily Cash' };

      // Act
      const result = await validate(body);

      // Assert
      expect(result).toBeInstanceOf(UpdateWalletDto);
      expect(result).toEqual({ name: 'Daily Cash' });
    });

    it('passes archived: true through (S-4)', async () => {
      // Arrange
      const body = { archived: true };

      // Act
      const result = await validate(body);

      // Assert
      expect(result).toEqual({ archived: true });
    });

    it('passes a rename and an archive together', async () => {
      // Arrange
      const body = { name: 'Both Done', archived: true };

      // Act
      const result = await validate(body);

      // Assert
      expect(result).toEqual({ name: 'Both Done', archived: true });
    });

    it('trims the name, as creating a Wallet does (S-10)', async () => {
      // Arrange
      const body = { name: '  Bank Savings  ' };

      // Act
      const result = (await validate(body)) as UpdateWalletDto;

      // Assert
      expect(result.name).toBe('Bank Savings');
    });

    it('keeps spaces inside the name', async () => {
      // Arrange
      const body = { name: 'Rainy  day 2' };

      // Act
      const result = (await validate(body)) as UpdateWalletDto;

      // Assert
      expect(result.name).toBe('Rainy  day 2');
    });

    it('accepts a name of exactly 60 characters, measured after trimming (S-11)', async () => {
      // Arrange
      const body = { name: `  ${'W'.repeat(60)}  ` };

      // Act
      const result = (await validate(body)) as UpdateWalletDto;

      // Assert
      expect(result.name).toBe('W'.repeat(60));
    });

    it('counts characters, not UTF-16 code units: 60 emoji are 60 characters (AT-04-12)', async () => {
      // Arrange — each is two code units; Postgres `char_length` counts it once, and so does the rule
      const body = { name: '😀'.repeat(60) };

      // Act
      const result = (await validate(body)) as UpdateWalletDto;

      // Assert
      expect(Array.from(result.name ?? '')).toHaveLength(60);
    });

    it('counts characters as Postgres does: 30 heart emoji (each a heart plus a variation selector) are 60 characters', async () => {
      // Arrange
      const body = { name: '❤️'.repeat(30) };

      // Act
      const result = (await validate(body)) as UpdateWalletDto;

      // Assert
      expect(Array.from(result.name ?? '')).toHaveLength(60);
    });

    it('drops a NUL character, which Postgres cannot store, instead of letting it become a 500', async () => {
      // Arrange
      const body = { name: 'Ca\u0000sh' };

      // Act
      const result = (await validate(body)) as UpdateWalletDto;

      // Assert
      expect(result.name).toBe('Cash');
    });

    it.each([
      ['an empty body', {}],
      ['a null name', { name: null }],
      ['a null archived', { archived: null }],
      ['both null', { name: null, archived: null }],
    ])(
      'accepts %s: absent and null both mean "not changing" (the service answers "Nothing to change.")',
      async (_why, body) => {
        // Arrange / Act
        const result = (await validate(body)) as UpdateWalletDto;

        // Assert
        expect(result).toBeInstanceOf(UpdateWalletDto);
        expect(result.name ?? null).toBeNull();
        expect(result.archived ?? null).toBeNull();
      },
    );

    it('drops properties the DTO does not declare, so a rename cannot change the Currency, the money, the owner or the archived state (whitelist, AC-2.4)', async () => {
      // Arrange
      const body = {
        name: 'Cash',
        currency: 'USD',
        openingBalanceMinor: '1',
        balanceMinor: '9',
        archivedAt: '2020-01-01T00:00:00.000Z',
        id: '00000000-0000-4000-8000-000000000000',
        userId: '00000000-0000-4000-8000-000000000000',
      };

      // Act
      const result = await validate(body);

      // Assert
      expect(result).toEqual({ name: 'Cash' });
    });

    it('leaves no value of a body that only carries undeclared properties', async () => {
      // Arrange
      const body = { currency: 'USD', archivedAt: '2020-01-01T00:00:00.000Z' };

      // Act
      const result = await validate(body);

      // Assert: `toEqual` ignores properties that are undefined, so any surviving value would fail it
      expect(result).toEqual({});
    });
  });

  describe('rejected bodies', () => {
    it.each([
      ['empty', ''],
      ['only spaces', '   '],
      ['only a NUL character', '\u0000'],
      ['not a string (number)', 42],
      ['not a string (boolean)', true],
      ['not a string (array)', ['Cash']],
      ['not a string (object)', { value: 'Cash' }],
    ])('rejects a name that is %s with exactly "Enter a wallet name."', async (_why, name) => {
      // Arrange
      const body = { name };

      // Act
      const messages = await rejectionMessages(body);

      // Assert
      expect(messages).toEqual([NAME_REQUIRED]);
    });

    it.each([
      ['61 characters', 'W'.repeat(61)],
      ['61 characters inside padding', `  ${'W'.repeat(61)}  `],
      ['61 emoji', '😀'.repeat(61)],
      [
        '62 characters made of heart emoji with variation selectors (more than the database allows)',
        '❤️'.repeat(31),
      ],
    ])('rejects a name of %s with exactly the length message (S-11)', async (_why, name) => {
      // Arrange
      const body = { name };

      // Act
      const messages = await rejectionMessages(body);

      // Assert
      expect(messages).toEqual([NAME_TOO_LONG]);
    });

    it.each([
      ['false', false],
      ['the text "true"', 'true'],
      ['the number 1', 1],
      ['the number 0', 0],
      ['an empty string', ''],
      ['an array holding true', [true]],
      ['an object', { value: true }],
    ])(
      'rejects archived being %s with exactly "Archived can only be set to true." (S-13)',
      async (_why, archived) => {
        // Arrange
        const body = { archived };

        // Act
        const messages = await rejectionMessages(body);

        // Assert
        expect(messages).toEqual([ARCHIVED_ONLY_TRUE]);
      },
    );

    it('reports one message per failing field, in the order name, archived (AT-05-07)', async () => {
      // Arrange
      const body = { name: '', archived: false };

      // Act
      const messages = await rejectionMessages(body);

      // Assert
      expect(messages).toEqual([NAME_REQUIRED, ARCHIVED_ONLY_TRUE]);
    });

    it('reports the name message alone when archived is fine', async () => {
      // Arrange
      const body = { name: '   ', archived: true };

      // Act
      const messages = await rejectionMessages(body);

      // Assert
      expect(messages).toEqual([NAME_REQUIRED]);
    });

    it('reports the archived message alone when the name is fine', async () => {
      // Arrange
      const body = { name: 'Cash', archived: 'yes' };

      // Act
      const messages = await rejectionMessages(body);

      // Assert
      expect(messages).toEqual([ARCHIVED_ONLY_TRUE]);
    });
  });
});
