import { describe, expect, it } from 'vitest';
import { toMinorUnits } from './to-minor-units';

// Boundary under test: typed text → minor units (artifacts/F-2/02-flow.md → Money and dates in the Web App). Pure: no
// network, no float arithmetic — the answers are exact decimal-integer strings or `null` for "cannot be read".

const AMOUNT = { allowNegative: false };
const OPENING_BALANCE = { allowNegative: true };

describe('toMinorUnits for a Currency with 2 minor digits', () => {
  it.each([
    ['125.50', '12550'],
    ['125.5', '12550'],
    ['1000', '100000'],
    ['0.01', '1'],
    ['0.1', '10'],
    ['0', '0'],
    ['0.00', '0'],
    ['007', '700'],
    ['  12.30  ', '1230'],
    ['999999999999999.99', '99999999999999999'],
  ])('reads %j as %j', (typed, expected) => {
    // Arrange & Act
    const minor = toMinorUnits(typed, 2, AMOUNT);

    // Assert
    expect(minor).toBe(expected);
  });

  it.each([
    '',
    '   ',
    'abc',
    '12.345',
    '1,000',
    '1 000',
    '+5',
    '.5',
    '5.',
    '1e3',
    '0x10',
    '12.3.4',
    '๑๒',
  ])('cannot read %j', (typed) => {
    // Arrange & Act
    const minor = toMinorUnits(typed, 2, OPENING_BALANCE);

    // Assert
    expect(minor).toBeNull();
  });
});

describe('toMinorUnits for a Currency with no minor digits', () => {
  it('reads a whole number as it is', () => {
    // Arrange & Act
    const minor = toMinorUnits('1500', 0, AMOUNT);

    // Assert
    expect(minor).toBe('1500');
  });

  it.each(['15.5', '15.0', '15.'])(
    'cannot read %j, which has decimals the Currency lacks',
    (typed) => {
      // Arrange & Act
      const minor = toMinorUnits(typed, 0, AMOUNT);

      // Assert
      expect(minor).toBeNull();
    },
  );
});

describe('toMinorUnits for a Currency with 3 minor digits', () => {
  it.each([
    ['1.5', '1500'],
    ['1.234', '1234'],
    ['0.001', '1'],
  ])('reads %j as %j', (typed, expected) => {
    // Arrange & Act
    const minor = toMinorUnits(typed, 3, AMOUNT);

    // Assert
    expect(minor).toBe(expected);
  });

  it('cannot read a fourth decimal', () => {
    // Arrange & Act
    const minor = toMinorUnits('1.2345', 3, AMOUNT);

    // Assert
    expect(minor).toBeNull();
  });
});

describe('toMinorUnits and negative numbers', () => {
  it.each([
    ['-2500.75', '-250075'],
    ['-5', '-500'],
    ['-0.01', '-1'],
    ['-0', '0'],
    ['-0.00', '0'],
  ])('reads %j as %j when negatives are allowed (an Opening Balance)', (typed, expected) => {
    // Arrange & Act
    const minor = toMinorUnits(typed, 2, OPENING_BALANCE);

    // Assert
    expect(minor).toBe(expected);
  });

  it.each(['-5', '-0', '-0.01'])(
    'cannot read %j when negatives are not allowed (an amount)',
    (typed) => {
      // Arrange & Act
      const minor = toMinorUnits(typed, 2, AMOUNT);

      // Assert
      expect(minor).toBeNull();
    },
  );

  it.each(['-', '--5', '- 5', '-.5', '-5.'])(
    'cannot read %j even when negatives are allowed',
    (typed) => {
      // Arrange & Act
      const minor = toMinorUnits(typed, 2, OPENING_BALANCE);

      // Assert
      expect(minor).toBeNull();
    },
  );
});
