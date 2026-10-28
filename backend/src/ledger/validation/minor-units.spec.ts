import { isPositiveMinorUnits, isWithinMinorUnitLimit } from './minor-units';

// Minor-unit amounts arrive as decimal-integer strings (JSON numbers cannot carry a bigint). Both helpers only ever
// see strings that already matched the format rule (`^-?[0-9]+$` / `^[0-9]+$`).
describe('isWithinMinorUnitLimit (at most 15 significant digits)', () => {
  it.each([
    ['one digit', '5'],
    ['zero', '0'],
    ['negative zero', '-0'],
    ['the largest 15-digit value', '999999999999999'],
    ['the smallest 15-digit negative value', '-999999999999999'],
    ['leading zeros, which are not significant', '0000000000000000001'],
    ['negative with leading zeros', '-0000000000000000001'],
    ['only zeros, however many', '0'.repeat(500)],
  ])('accepts %s', (_why, value) => {
    // Arrange / Act
    const within = isWithinMinorUnitLimit(value);

    // Assert
    expect(within).toBe(true);
  });

  it.each([
    ['16 digits', '1000000000000000'],
    ['16 digits, negative', '-1000000000000000'],
    ['16 digits behind leading zeros', '000001234567890123456'],
    ['a very long number', '9'.repeat(5000)],
  ])('refuses %s', (_why, value) => {
    // Arrange / Act
    const within = isWithinMinorUnitLimit(value);

    // Assert
    expect(within).toBe(false);
  });
});

describe('isPositiveMinorUnits (greater than 0)', () => {
  it.each([
    ['1', '1'],
    ['a large amount', '999999999999999'],
    ['leading zeros before a non-zero digit', '0007'],
    ['a zero inside', '1000'],
  ])('accepts %s', (_why, value) => {
    // Arrange / Act
    const positive = isPositiveMinorUnits(value);

    // Assert
    expect(positive).toBe(true);
  });

  it.each([
    ['zero', '0'],
    ['several zeros', '000'],
    ['a negative amount', '-5'],
  ])('refuses %s', (_why, value) => {
    // Arrange / Act
    const positive = isPositiveMinorUnits(value);

    // Assert
    expect(positive).toBe(false);
  });
});
