import { postgresTypes } from './create-pool';

const DATE_OID = 1082;
const INT4_OID = 23;
const INT8_OID = 20;
const NUMERIC_OID = 1700;
const TIMESTAMPTZ_OID = 1184;

// The Pool's type parsers, tested as plain functions (nothing connects). The same configuration is proven end to end
// against real Postgres, under two process timezones, in test/ledger.repository.int-spec.ts (IT-01).
describe('postgresTypes (how the shared Pool reads Postgres values)', () => {
  describe('DATE', () => {
    it.each(['2024-02-29', '2024-12-31', '0001-01-01', '9999-12-31'])(
      'hands back %s as the exact string — never a JS Date, which would shift the day by the timezone (AD-1)',
      (value) => {
        // Arrange
        const parse = postgresTypes.getTypeParser(DATE_OID, 'text');

        // Act
        const parsed = parse(value);

        // Assert
        expect(parsed).toBe(value);
      },
    );
  });

  describe('every other type keeps pg’s defaults', () => {
    it('reads INT8 (BIGINT) as a string, so a minor-unit amount never loses precision', () => {
      // Arrange
      const parse = postgresTypes.getTypeParser(INT8_OID, 'text');

      // Act
      const parsed = parse('999999999999999');

      // Assert
      expect(parsed).toBe('999999999999999');
    });

    it('reads NUMERIC as a string, so a derived Balance never loses precision', () => {
      // Arrange
      const parse = postgresTypes.getTypeParser(NUMERIC_OID, 'text');

      // Act
      const parsed = parse('-2999999999999997');

      // Assert
      expect(parsed).toBe('-2999999999999997');
    });

    it('reads INT4 as a number', () => {
      // Arrange
      const parse = postgresTypes.getTypeParser(INT4_OID, 'text');

      // Act
      const parsed = parse('42');

      // Assert
      expect(parsed).toBe(42);
    });

    it('reads TIMESTAMPTZ as a Date, which JSON turns into ISO-8601 UTC', () => {
      // Arrange
      const parse = postgresTypes.getTypeParser(TIMESTAMPTZ_OID, 'text');

      // Act
      const parsed = parse('2026-10-29 10:11:12.123+00');

      // Assert
      expect(parsed).toBeInstanceOf(Date);
      expect((parsed as Date).toISOString()).toBe('2026-10-29T10:11:12.123Z');
    });
  });
});
