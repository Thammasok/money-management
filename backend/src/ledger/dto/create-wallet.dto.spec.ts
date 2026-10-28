import { dtoValidation } from '../../../test/support/dto-validation';
import { CreateWalletDto } from './create-wallet.dto';

// Exact texts: artifacts/F-2/01-requirements.md → Error message catalogue.
const NAME_REQUIRED = 'Enter a wallet name.';
const NAME_TOO_LONG = 'Wallet name must be at most 60 characters.';
const CURRENCY = 'Choose a supported currency.';
const OPENING_FORMAT = 'Opening balance must be a whole number of minor units.';
const OPENING_TOO_LARGE = 'Opening balance is too large.';

describe('CreateWalletDto (validated by the global ValidationPipe)', () => {
  const { validate, rejectionMessages } = dtoValidation(CreateWalletDto);

  const aBody = (overrides: object = {}) => ({
    name: 'Cash',
    currency: 'THB',
    openingBalanceMinor: '100000',
    ...overrides,
  });

  describe('accepted bodies', () => {
    it('passes a name, a Currency and an Opening Balance through as a CreateWalletDto', async () => {
      // Arrange
      const body = aBody();

      // Act
      const result = await validate(body);

      // Assert
      expect(result).toBeInstanceOf(CreateWalletDto);
      expect(result).toEqual({ name: 'Cash', currency: 'THB', openingBalanceMinor: '100000' });
    });

    it('trims the name (S-12)', async () => {
      // Arrange
      const body = aBody({ name: '  Savings  ' });

      // Act
      const result = (await validate(body)) as CreateWalletDto;

      // Assert
      expect(result.name).toBe('Savings');
    });

    it('keeps spaces inside the name', async () => {
      // Arrange
      const body = aBody({ name: 'Rainy  day 2' });

      // Act
      const result = (await validate(body)) as CreateWalletDto;

      // Assert
      expect(result.name).toBe('Rainy  day 2');
    });

    it('accepts a name of exactly 60 characters (S-14)', async () => {
      // Arrange
      const body = aBody({ name: 'W'.repeat(60) });

      // Act
      const result = (await validate(body)) as CreateWalletDto;

      // Assert
      expect(result.name).toHaveLength(60);
    });

    it('counts characters, not UTF-16 code units: 60 emoji are 60 characters', async () => {
      // Arrange — each is two code units; Postgres `char_length` counts it once, and so does the rule
      const body = aBody({ name: '😀'.repeat(60) });

      // Act
      const result = (await validate(body)) as CreateWalletDto;

      // Assert
      expect(Array.from(result.name)).toHaveLength(60);
    });

    it('counts characters as Postgres does: 30 heart emoji (each a heart plus a variation selector) are 60 characters', async () => {
      // Arrange
      const body = aBody({ name: '❤️'.repeat(30) });

      // Act
      const result = (await validate(body)) as CreateWalletDto;

      // Assert
      expect(Array.from(result.name)).toHaveLength(60);
    });

    it('measures the 60 characters after trimming', async () => {
      // Arrange
      const body = aBody({ name: `  ${'W'.repeat(60)}  ` });

      // Act
      const result = (await validate(body)) as CreateWalletDto;

      // Assert
      expect(result.name).toBe('W'.repeat(60));
    });

    it('drops a NUL character, which Postgres cannot store, instead of letting it become a 500', async () => {
      // Arrange
      const body = aBody({ name: 'Ca\u0000sh' });

      // Act
      const result = (await validate(body)) as CreateWalletDto;

      // Assert
      expect(result.name).toBe('Cash');
    });

    it.each([
      ['any string for the Currency — whether it is supported is asked of Exchange Rates', 'XYZ'],
      ['a lower-case Currency code', 'thb'],
    ])('accepts %s', async (_why, currency) => {
      // Arrange
      const body = aBody({ currency });

      // Act
      const result = (await validate(body)) as CreateWalletDto;

      // Assert
      expect(result.currency).toBe(currency);
    });

    it.each([
      ['zero', '0'],
      ['a negative Opening Balance — the Wallet may start in debt (S-8)', '-250075'],
      ['negative zero (the service stores it as 0)', '-0'],
      ['leading zeros', '000150'],
      ['the largest 15-digit value (S-16)', '999999999999999'],
      ['the smallest 15-digit negative value', '-999999999999999'],
      ['more than 15 characters that are mostly leading zeros', '0000000000000000001'],
    ])('accepts an Opening Balance of %s', async (_why, openingBalanceMinor) => {
      // Arrange
      const body = aBody({ openingBalanceMinor });

      // Act
      const result = (await validate(body)) as CreateWalletDto;

      // Assert
      expect(result.openingBalanceMinor).toBe(openingBalanceMinor);
    });

    it('drops properties the DTO does not declare, so a body cannot choose its id, owner or Balance (whitelist)', async () => {
      // Arrange
      const body = aBody({ id: 'smuggled', userId: 'smuggled', balanceMinor: '999' });

      // Act
      const result = await validate(body);

      // Assert
      expect(result).toEqual({ name: 'Cash', currency: 'THB', openingBalanceMinor: '100000' });
    });
  });

  describe('rejected bodies', () => {
    it.each([
      ['empty', ''],
      ['only spaces', '   '],
      ['only a NUL character', '\u0000'],
      ['not a string (number)', 42],
      ['not a string (array)', ['Cash']],
      ['not a string (object)', { value: 'Cash' }],
      ['null', null],
      ['missing', undefined],
    ])('rejects a name that is %s with exactly "Enter a wallet name."', async (_why, name) => {
      // Arrange
      const body = aBody({ name });

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
    ])('rejects a name of %s with exactly the length message (S-14)', async (_why, name) => {
      // Arrange
      const body = aBody({ name });

      // Act
      const messages = await rejectionMessages(body);

      // Assert
      expect(messages).toEqual([NAME_TOO_LONG]);
    });

    it.each([
      ['a number', 764],
      ['null', null],
      ['missing', undefined],
      ['an object', { code: 'THB' }],
    ])(
      'rejects a Currency that is %s with exactly "Choose a supported currency."',
      async (_why, currency) => {
        // Arrange
        const body = aBody({ currency });

        // Act
        const messages = await rejectionMessages(body);

        // Assert
        expect(messages).toEqual([CURRENCY]);
      },
    );

    it.each([
      ['a JSON number (S-16)', 1000],
      ['decimals', '12.50'],
      ['letters', 'abc'],
      ['empty', ''],
      ['a leading space', ' 5'],
      ['a trailing space', '5 '],
      ['a trailing newline', '5\n'],
      ['exponent notation', '1e3'],
      ['an explicit leading plus', '+5'],
      ['two leading minus characters', '--5'],
      ['a lone minus character', '-'],
      ['non-ASCII digits', '١٢٣'],
      ['null', null],
      ['missing', undefined],
    ])(
      'rejects an Opening Balance that is %s with exactly the whole-number message',
      async (_why, openingBalanceMinor) => {
        // Arrange
        const body = aBody({ openingBalanceMinor });

        // Act
        const messages = await rejectionMessages(body);

        // Assert
        expect(messages).toEqual([OPENING_FORMAT]);
      },
    );

    it.each([
      ['16 digits (S-16)', '1234567890123456'],
      ['16 digits, negative', '-1234567890123456'],
      ['a very long number', '9'.repeat(5000)],
    ])(
      'rejects an Opening Balance of %s with exactly "Opening balance is too large."',
      async (_why, openingBalanceMinor) => {
        // Arrange
        const body = aBody({ openingBalanceMinor });

        // Act
        const messages = await rejectionMessages(body);

        // Assert
        expect(messages).toEqual([OPENING_TOO_LARGE]);
      },
    );

    it('reports one message per failing field, in the order name, currency, Opening Balance', async () => {
      // Arrange
      const body = { name: '', currency: 5, openingBalanceMinor: 'abc' };

      // Act
      const messages = await rejectionMessages(body);

      // Assert
      expect(messages).toEqual([NAME_REQUIRED, CURRENCY, OPENING_FORMAT]);
    });

    it('reports a blank name and a bad Opening Balance together when the Currency is fine (AT-04-15)', async () => {
      // Arrange
      const body = aBody({ name: '', openingBalanceMinor: 'abc' });

      // Act
      const messages = await rejectionMessages(body);

      // Assert
      expect(messages).toEqual([NAME_REQUIRED, OPENING_FORMAT]);
    });
  });
});
