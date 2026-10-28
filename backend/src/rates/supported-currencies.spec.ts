import { SUPPORTED_CURRENCIES } from './supported-currencies';

// The snapshot of Frankfurter's currency list verified at F-2 Stage 1 on 2026-10-29
// (artifacts/F-2/01-requirements.md → Supported-Currency snapshot). The Mountebank impostor
// (mocks/ledger-api.inject.js) holds the same literal list — change both or neither.
const EXPECTED_CODES = [
  'AUD',
  'BRL',
  'CAD',
  'CHF',
  'CNY',
  'CZK',
  'DKK',
  'EUR',
  'GBP',
  'HKD',
  'HUF',
  'IDR',
  'ILS',
  'INR',
  'ISK',
  'JPY',
  'KRW',
  'MXN',
  'MYR',
  'NOK',
  'NZD',
  'PHP',
  'PLN',
  'RON',
  'SEK',
  'SGD',
  'THB',
  'TRY',
  'USD',
  'ZAR',
];

describe('SUPPORTED_CURRENCIES (the Frankfurter snapshot)', () => {
  it('holds exactly the 30 verified codes, sorted by code', () => {
    // Arrange / Act
    const codes = SUPPORTED_CURRENCIES.map((currency) => currency.code);

    // Assert
    expect(codes).toEqual(EXPECTED_CODES);
  });

  it('no longer lists BGN — Frankfurter dropped it when Bulgaria adopted the euro', () => {
    // Arrange / Act
    const codes = SUPPORTED_CURRENCIES.map((currency) => currency.code);

    // Assert
    expect(codes).not.toContain('BGN');
  });

  it.each(['ISK', 'JPY', 'KRW'])('gives %s zero minor-unit digits (ISO-4217)', (code) => {
    // Arrange / Act
    const currency = SUPPORTED_CURRENCIES.find((candidate) => candidate.code === code);

    // Assert
    expect(currency?.minorDigits).toBe(0);
  });

  it('gives every other Currency two minor-unit digits', () => {
    // Arrange
    const zeroDigit = ['ISK', 'JPY', 'KRW'];

    // Act
    const others = SUPPORTED_CURRENCIES.filter((currency) => !zeroDigit.includes(currency.code));

    // Assert
    expect(others).toHaveLength(27);
    expect(others.every((currency) => currency.minorDigits === 2)).toBe(true);
  });

  it.each([
    ['THB', 'Thai Baht'],
    ['USD', 'United States Dollar'],
    ['JPY', 'Japanese Yen'],
    ['EUR', 'Euro'],
    ['ISK', 'Icelandic Króna'],
    ['PLN', 'Polish Złoty'],
  ])("names %s with Frankfurter's name %s", (code, name) => {
    // Arrange / Act
    const currency = SUPPORTED_CURRENCIES.find((candidate) => candidate.code === code);

    // Assert
    expect(currency).toEqual({ code, name, minorDigits: code === 'JPY' || code === 'ISK' ? 0 : 2 });
  });

  it('is frozen, so no caller can change the supported list at runtime', () => {
    // Arrange / Act / Assert
    expect(Object.isFrozen(SUPPORTED_CURRENCIES)).toBe(true);
    expect(SUPPORTED_CURRENCIES.every((currency) => Object.isFrozen(currency))).toBe(true);
  });
});
