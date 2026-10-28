import { describe, expect, it } from 'vitest';
import { formatMinor } from './format-minor';

// Boundary under test: minor units → the text a Balance or an amount is shown as (artifacts/F-2/01-requirements.md →
// UI Components → Money display): `en-US`, the Currency CODE, exactly the Currency's minor digits, a no-break space
// after the code. The input is the backend's decimal-integer string and must never pass through a float.

const NBSP = ' ';

describe('formatMinor', () => {
  it.each([
    ['100000', 'THB', 2, `THB${NBSP}1,000.00`],
    ['87450', 'THB', 2, `THB${NBSP}874.50`],
    ['12550', 'THB', 2, `THB${NBSP}125.50`],
    ['1', 'THB', 2, `THB${NBSP}0.01`],
    ['11', 'THB', 2, `THB${NBSP}0.11`],
    ['0', 'THB', 2, `THB${NBSP}0.00`],
    ['1230', 'EUR', 2, `EUR${NBSP}12.30`],
    ['0', 'JPY', 0, `JPY${NBSP}0`],
    ['1500', 'JPY', 0, `JPY${NBSP}1,500`],
    ['1', 'BHD', 3, `BHD${NBSP}0.001`],
    ['1234567', 'BHD', 3, `BHD${NBSP}1,234.567`],
  ])('shows %j minor units of %s (%i digits) as %j', (minor, currency, digits, expected) => {
    // Arrange & Act
    const text = formatMinor(minor, currency, digits);

    // Assert
    expect(text).toBe(expected);
  });

  it.each([
    ['-250075', 'THB', 2, `-THB${NBSP}2,500.75`],
    ['-1500', 'JPY', 0, `-JPY${NBSP}1,500`],
    ['-1', 'USD', 2, `-USD${NBSP}0.01`],
  ])('puts the minus sign of %j before the code: %j', (minor, currency, digits, expected) => {
    // Arrange & Act
    const text = formatMinor(minor, currency, digits);

    // Assert
    expect(text).toBe(expected);
  });

  it('is exact beyond 2^53, where a float would round', () => {
    // Arrange: 10999999999999989 minor units is not a safe integer.
    const minor = '10999999999999989';

    // Act
    const text = formatMinor(minor, 'THB', 2);

    // Assert
    expect(text).toBe(`THB${NBSP}109,999,999,999,999.89`);
  });

  it('is the same in every browser locale (fixed en-US, not the browser default)', () => {
    // Arrange & Act
    const text = formatMinor('123456789', 'EUR', 2);

    // Assert
    expect(text).toBe(`EUR${NBSP}1,234,567.89`);
  });
});
