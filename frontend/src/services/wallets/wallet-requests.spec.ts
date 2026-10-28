import { describe, expect, it } from 'vitest';
import { CHOOSE_CURRENCY_TEXT, INVALID_AMOUNT_TEXT } from './wallet-messages';
import { toCreateWalletRequest, toRecordTransactionRequest } from './wallet-requests';
import type { Currency, TypedTransaction, TypedWallet } from './wallet.types';

// Boundary under test: what the person typed → the request body, or the Web App's own refusal (nothing is sent). The
// Web App holds no money rules beyond reading typed text as minor units of the Wallet's Currency; every other rule
// (name length, amount > 0, date not in the future) is the backend's and is shown as it answers.

const CURRENCIES: Currency[] = [
  { code: 'THB', name: 'Thai Baht', minorDigits: 2 },
  { code: 'JPY', name: 'Japanese Yen', minorDigits: 0 },
];

function typedWallet(overrides: Partial<TypedWallet> = {}): TypedWallet {
  return { name: 'Cash', currency: 'THB', openingBalance: '1000', ...overrides };
}

function typedTransaction(overrides: Partial<TypedTransaction> = {}): TypedTransaction {
  return { kind: 'expense', amount: '125.50', date: '2026-10-29', note: 'Lunch', ...overrides };
}

describe('toCreateWalletRequest', () => {
  it('turns what was typed into the request body, the Opening Balance in minor units', () => {
    // Arrange
    const typed = typedWallet({ name: 'Cash', currency: 'THB', openingBalance: '1000' });

    // Act
    const parsed = toCreateWalletRequest(typed, CURRENCIES);

    // Assert
    expect(parsed).toEqual({
      ok: true,
      request: { name: 'Cash', currency: 'THB', openingBalanceMinor: '100000' },
    });
  });

  it('reads a negative Opening Balance (it is not Income)', () => {
    // Arrange
    const typed = typedWallet({ openingBalance: '-2500.75' });

    // Act
    const parsed = toCreateWalletRequest(typed, CURRENCIES);

    // Assert
    expect(parsed).toEqual({
      ok: true,
      request: { name: 'Cash', currency: 'THB', openingBalanceMinor: '-250075' },
    });
  });

  it('uses the digits of the chosen Currency', () => {
    // Arrange
    const typed = typedWallet({ currency: 'JPY', openingBalance: '1500' });

    // Act
    const parsed = toCreateWalletRequest(typed, CURRENCIES);

    // Assert
    expect(parsed).toEqual({
      ok: true,
      request: { name: 'Cash', currency: 'JPY', openingBalanceMinor: '1500' },
    });
  });

  it.each(['', '   ', 'W'.repeat(61)])(
    'sends the name %j as typed — the backend owns that rule',
    (name) => {
      // Arrange
      const typed = typedWallet({ name });

      // Act
      const parsed = toCreateWalletRequest(typed, CURRENCIES);

      // Assert
      expect(parsed).toEqual({ ok: true, request: expect.objectContaining({ name }) });
    },
  );

  it('refuses when no Currency is chosen', () => {
    // Arrange
    const typed = typedWallet({ currency: '' });

    // Act
    const parsed = toCreateWalletRequest(typed, CURRENCIES);

    // Assert
    expect(parsed).toEqual({ ok: false, error: CHOOSE_CURRENCY_TEXT });
  });

  it('refuses a code that is not one of the Currencies', () => {
    // Arrange
    const typed = typedWallet({ currency: 'XYZ' });

    // Act
    const parsed = toCreateWalletRequest(typed, CURRENCIES);

    // Assert
    expect(parsed).toEqual({ ok: false, error: CHOOSE_CURRENCY_TEXT });
  });

  it.each([
    ['THB', '12.345'],
    ['THB', 'abc'],
    ['THB', ''],
    ['JPY', '15.5'],
  ])('refuses the Opening Balance %s %j before anything is sent', (currency, openingBalance) => {
    // Arrange
    const typed = typedWallet({ currency, openingBalance });

    // Act
    const parsed = toCreateWalletRequest(typed, CURRENCIES);

    // Assert
    expect(parsed).toEqual({ ok: false, error: INVALID_AMOUNT_TEXT });
  });

  it('gives only the first refusal, the Currency before the amount', () => {
    // Arrange
    const typed = typedWallet({ currency: '', openingBalance: 'abc' });

    // Act
    const parsed = toCreateWalletRequest(typed, CURRENCIES);

    // Assert
    expect(parsed).toEqual({ ok: false, error: CHOOSE_CURRENCY_TEXT });
  });
});

describe('toRecordTransactionRequest', () => {
  it('turns what was entered into the request body, with the amount in minor units and today', () => {
    // Arrange
    const typed = typedTransaction({
      kind: 'income',
      amount: '2000',
      date: '2026-10-28',
      note: 'Salary',
    });

    // Act
    const parsed = toRecordTransactionRequest(typed, 2, '2026-10-29');

    // Assert
    expect(parsed).toEqual({
      ok: true,
      request: {
        kind: 'income',
        amountMinor: '200000',
        occurredOn: '2026-10-28',
        note: 'Salary',
        today: '2026-10-29',
      },
    });
  });

  it('is exact to the minor unit', () => {
    // Arrange
    const typed = typedTransaction({ amount: '0.1' });

    // Act
    const parsed = toRecordTransactionRequest(typed, 2, '2026-10-29');

    // Assert
    expect(parsed).toEqual({ ok: true, request: expect.objectContaining({ amountMinor: '10' }) });
  });

  it('uses the digits of the Wallet’s Currency', () => {
    // Arrange
    const typed = typedTransaction({ amount: '1500' });

    // Act
    const parsed = toRecordTransactionRequest(typed, 0, '2026-10-29');

    // Assert
    expect(parsed).toEqual({ ok: true, request: expect.objectContaining({ amountMinor: '1500' }) });
  });

  it.each([
    ['abc', 2],
    ['-5', 2],
    ['1.234', 2],
    ['15.5', 0],
    ['', 2],
  ])('refuses the amount %j for %i digits before anything is sent', (amount, minorDigits) => {
    // Arrange
    const typed = typedTransaction({ amount });

    // Act
    const parsed = toRecordTransactionRequest(typed, minorDigits, '2026-10-29');

    // Assert
    expect(parsed).toEqual({ ok: false, error: INVALID_AMOUNT_TEXT });
  });

  it('sends an amount of 0 on — the backend says it must be greater than 0', () => {
    // Arrange
    const typed = typedTransaction({ amount: '0' });

    // Act
    const parsed = toRecordTransactionRequest(typed, 2, '2026-10-29');

    // Assert
    expect(parsed).toEqual({ ok: true, request: expect.objectContaining({ amountMinor: '0' }) });
  });

  it('sends a date after today on too — the backend refuses it, the Web App does not second-guess', () => {
    // Arrange
    const typed = typedTransaction({ date: '2026-10-30' });

    // Act
    const parsed = toRecordTransactionRequest(typed, 2, '2026-10-29');

    // Assert
    expect(parsed).toEqual({
      ok: true,
      request: expect.objectContaining({ occurredOn: '2026-10-30' }),
    });
  });
});
