import { dtoValidation } from '../../../test/support/dto-validation';
import { RecordTransactionDto } from './record-transaction.dto';

// Exact texts: artifacts/F-2/01-requirements.md → Error message catalogue.
const KIND = 'Choose income or expense.';
const AMOUNT_FORMAT = 'Amount must be a whole number of minor units.';
const AMOUNT_POSITIVE = 'Amount must be greater than 0.';
const AMOUNT_TOO_LARGE = 'Amount is too large.';
const OCCURRED_ON = 'Enter a valid date.';
const FUTURE_DATE = "Date can't be in the future.";
const NOTE = 'Note must be at most 200 characters.';
const TODAY = 'today must be a valid date (YYYY-MM-DD).';

describe('RecordTransactionDto (validated by the global ValidationPipe)', () => {
  const { validate, rejectionMessages } = dtoValidation(RecordTransactionDto);

  const aBody = (overrides: object = {}) => ({
    kind: 'expense',
    amountMinor: '12550',
    occurredOn: '2026-10-29',
    note: 'Lunch',
    today: '2026-10-29',
    ...overrides,
  });

  describe('accepted bodies', () => {
    it('passes a Kind, an amount, a date, a note and today through as a RecordTransactionDto', async () => {
      // Arrange
      const body = aBody();

      // Act
      const result = await validate(body);

      // Assert
      expect(result).toBeInstanceOf(RecordTransactionDto);
      expect(result).toEqual(aBody());
    });

    it.each(['income', 'expense'])('accepts the Kind %s', async (kind) => {
      // Arrange
      const body = aBody({ kind });

      // Act
      const result = (await validate(body)) as RecordTransactionDto;

      // Assert
      expect(result.kind).toBe(kind);
    });

    it.each([
      ['the smallest amount', '1'],
      ['the largest 15-digit amount', '999999999999999'],
      ['leading zeros (the service stores 7)', '007'],
      ['more than 15 characters that are mostly leading zeros', '0000000000000000007'],
    ])('accepts an amount of %s', async (_why, amountMinor) => {
      // Arrange
      const body = aBody({ amountMinor });

      // Act
      const result = (await validate(body)) as RecordTransactionDto;

      // Assert
      expect(result.amountMinor).toBe(amountMinor);
    });

    it.each([
      ['exactly today (S-10)', '2026-10-29'],
      ['yesterday', '2026-10-28'],
      ['a past leap day (S-10)', '2024-02-29'],
      ['the first day of the calendar', '0001-01-01'],
    ])('accepts a date of %s', async (_why, occurredOn) => {
      // Arrange
      const body = aBody({ occurredOn, today: '2026-10-29' });

      // Act
      const result = (await validate(body)) as RecordTransactionDto;

      // Assert
      expect(result.occurredOn).toBe(occurredOn);
    });

    it('trims the note (S-12)', async () => {
      // Arrange
      const body = aBody({ note: '  Coffee  ' });

      // Act
      const result = (await validate(body)) as RecordTransactionDto;

      // Assert
      expect(result.note).toBe('Coffee');
    });

    it.each([
      ['only spaces', '   '],
      ['empty', ''],
      ['only a NUL character', '\u0000'],
    ])('turns a note that is %s into no note (null) (S-12)', async (_why, note) => {
      // Arrange
      const body = aBody({ note });

      // Act
      const result = (await validate(body)) as RecordTransactionDto;

      // Assert
      expect(result.note).toBeNull();
    });

    it('accepts an explicit null note and leaves an absent note absent (the service stores both as null)', async () => {
      // Arrange
      const withNull = aBody({ note: null });
      const withoutNote = {
        kind: 'expense',
        amountMinor: '12550',
        occurredOn: '2026-10-29',
        today: '2026-10-29',
      };

      // Act
      const nullResult = (await validate(withNull)) as RecordTransactionDto;
      const absentResult = (await validate(withoutNote)) as RecordTransactionDto;

      // Assert
      expect(nullResult.note).toBeNull();
      expect(absentResult.note).toBeUndefined();
    });

    it('drops a NUL character from a note, which Postgres cannot store', async () => {
      // Arrange
      const body = aBody({ note: 'Lun\u0000ch' });

      // Act
      const result = (await validate(body)) as RecordTransactionDto;

      // Assert
      expect(result.note).toBe('Lunch');
    });

    it('accepts a note of exactly 200 characters, measured after trimming', async () => {
      // Arrange
      const body = aBody({ note: `  ${'n'.repeat(200)}  ` });

      // Act
      const result = (await validate(body)) as RecordTransactionDto;

      // Assert
      expect(result.note).toBe('n'.repeat(200));
    });

    it('counts characters as Postgres does: 100 heart emoji (each a heart plus a variation selector) are 200 characters', async () => {
      // Arrange
      const body = aBody({ note: '❤️'.repeat(100) });

      // Act
      const result = (await validate(body)) as RecordTransactionDto;

      // Assert
      expect(Array.from(result.note ?? '')).toHaveLength(200);
    });

    it('drops properties the DTO does not declare, so a body cannot choose its id or its Wallet (whitelist)', async () => {
      // Arrange
      const body = aBody({ id: 'smuggled', walletId: '00000000-0000-4000-8000-000000000000' });

      // Act
      const result = await validate(body);

      // Assert
      expect(result).toEqual(aBody());
    });
  });

  describe('rejected bodies', () => {
    it.each([
      ['an unknown Kind', 'transfer'],
      ['a different letter case', 'Income'],
      ['a number', 1],
      ['null', null],
      ['missing', undefined],
    ])('rejects a Kind that is %s with exactly "Choose income or expense."', async (_why, kind) => {
      // Arrange
      const body = aBody({ kind });

      // Act
      const messages = await rejectionMessages(body);

      // Assert
      expect(messages).toEqual([KIND]);
    });

    it.each([
      ['a JSON number (S-19)', 12550],
      ['decimals', '12.5'],
      ['a negative amount', '-5'],
      ['letters', 'abc'],
      ['empty', ''],
      ['a leading space', ' 5'],
      ['a trailing newline', '5\n'],
      ['exponent notation', '1e3'],
      ['null', null],
      ['missing', undefined],
    ])(
      'rejects an amount that is %s with exactly the whole-number message',
      async (_why, amountMinor) => {
        // Arrange
        const body = aBody({ amountMinor });

        // Act
        const messages = await rejectionMessages(body);

        // Assert
        expect(messages).toEqual([AMOUNT_FORMAT]);
      },
    );

    it.each([
      ['zero (S-18)', '0'],
      ['several zeros', '000'],
    ])(
      'rejects an amount of %s with exactly "Amount must be greater than 0."',
      async (_why, amountMinor) => {
        // Arrange
        const body = aBody({ amountMinor });

        // Act
        const messages = await rejectionMessages(body);

        // Assert
        expect(messages).toEqual([AMOUNT_POSITIVE]);
      },
    );

    it.each([
      ['16 digits (S-19)', '1234567890123456'],
      ['a very long number', '9'.repeat(5000)],
    ])('rejects an amount of %s with exactly "Amount is too large."', async (_why, amountMinor) => {
      // Arrange
      const body = aBody({ amountMinor });

      // Act
      const messages = await rejectionMessages(body);

      // Assert
      expect(messages).toEqual([AMOUNT_TOO_LARGE]);
    });

    it.each([
      ['a day that does not exist (S-19)', '2026-02-30'],
      ['a day/month/year date (S-19)', '29/02/2024'],
      ['29 February in a common year', '2023-02-29'],
      ['month 13', '2026-13-01'],
      ['year 0000 — Postgres has no year 0 (IT-05)', '0000-01-01'],
      ['single-digit month and day', '2026-2-3'],
      ['a timestamp', '2026-10-29T10:00:00Z'],
      ['a number', 20261029],
      ['null', null],
      ['missing', undefined],
    ])('rejects a date that is %s with exactly "Enter a valid date."', async (_why, occurredOn) => {
      // Arrange
      const body = aBody({ occurredOn });

      // Act
      const messages = await rejectionMessages(body);

      // Assert
      expect(messages).toEqual([OCCURRED_ON]);
    });

    it.each([
      ['tomorrow (S-17)', '2026-10-30'],
      ['next year', '2027-10-29'],
      ['the last day the format can hold', '9999-12-31'],
    ])(
      'rejects a date of %s with exactly "Date can\'t be in the future."',
      async (_why, occurredOn) => {
        // Arrange
        const body = aBody({ occurredOn, today: '2026-10-29' });

        // Act
        const messages = await rejectionMessages(body);

        // Assert
        expect(messages).toEqual([FUTURE_DATE]);
      },
    );

    it('compares dates, not times: the day after today is refused on the last day of a month and of a year', async () => {
      // Arrange
      const body = aBody({ occurredOn: '2027-01-01', today: '2026-12-31' });

      // Act
      const messages = await rejectionMessages(body);

      // Assert
      expect(messages).toEqual([FUTURE_DATE]);
    });

    it.each([
      ['201 characters', 'n'.repeat(201)],
      [
        '201 characters even though they are all that is left after trimming',
        `  ${'n'.repeat(201)}  `,
      ],
      ['101 heart emoji (202 characters — more than the database allows)', '❤️'.repeat(101)],
      ['a JSON number', 5],
      ['an object', { text: 'Lunch' }],
      ['an array', ['Lunch']],
      ['true', true],
    ])('rejects a note that is %s with exactly the note message', async (_why, note) => {
      // Arrange
      const body = aBody({ note });

      // Act
      const messages = await rejectionMessages(body);

      // Assert
      expect(messages).toEqual([NOTE]);
    });

    it.each([
      ['missing', undefined],
      ['the word tomorrow', 'tomorrow'],
      ['a day that does not exist', '2026-02-30'],
      ['a number', 20261029],
      ['null', null],
    ])(
      'rejects a today that is %s with only the today message — the future-date check is skipped (S-19)',
      async (_why, today) => {
        // Arrange
        const body = aBody({ today });

        // Act
        const messages = await rejectionMessages(body);

        // Assert
        expect(messages).toEqual([TODAY]);
      },
    );

    it('does not compare the date with a today that is not a date, even for a date far in the future', async () => {
      // Arrange
      const body = aBody({ occurredOn: '9999-12-31', today: 'tomorrow' });

      // Act
      const messages = await rejectionMessages(body);

      // Assert
      expect(messages).toEqual([TODAY]);
    });

    it('reports the date and today messages together when neither is a date', async () => {
      // Arrange
      const body = aBody({ occurredOn: 'soon', today: 'now' });

      // Act
      const messages = await rejectionMessages(body);

      // Assert
      expect(messages).toEqual([OCCURRED_ON, TODAY]);
    });

    it('reports exactly the two messages of two failing fields (AT-06-21)', async () => {
      // Arrange
      const body = aBody({ kind: 'gift', amountMinor: '0' });

      // Act
      const messages = await rejectionMessages(body);

      // Assert
      expect(messages).toEqual([KIND, AMOUNT_POSITIVE]);
    });

    it('reports one message per failing field, in the order Kind, amount, date, note, today', async () => {
      // Arrange
      const body = { kind: 'x', amountMinor: 'x', occurredOn: 'x', note: 5, today: 'x' };

      // Act
      const messages = await rejectionMessages(body);

      // Assert
      expect(messages).toEqual([KIND, AMOUNT_FORMAT, OCCURRED_ON, NOTE, TODAY]);
    });
  });
});
