import { describe, expect, it } from 'vitest';
import { defaultCurrencyFor } from './default-currency';
import type { Currency, WalletSummary } from './wallet.types';

// Boundary under test: which Currency Create Wallet starts with (Q-11) — that of the User's last-created Wallet.

const CURRENCIES: Currency[] = [
  { code: 'THB', name: 'Thai Baht', minorDigits: 2 },
  { code: 'USD', name: 'United States Dollar', minorDigits: 2 },
];

function aWallet(id: string, currency: string): WalletSummary {
  return { id, name: id, currency, createdAt: '2026-10-29T03:00:00.000Z' };
}

describe('defaultCurrencyFor', () => {
  it('is the Currency of the newest Wallet, which the list puts first', () => {
    // Arrange
    const wallets = [aWallet('card', 'USD'), aWallet('bank', 'THB')];

    // Act
    const currency = defaultCurrencyFor(wallets, CURRENCIES);

    // Assert
    expect(currency).toBe('USD');
  });

  it('is none when there are no Wallets yet', () => {
    // Arrange & Act
    const currency = defaultCurrencyFor([], CURRENCIES);

    // Assert
    expect(currency).toBe('');
  });

  it('is none when the newest Wallet’s Currency is no longer one a Wallet may hold', () => {
    // Arrange
    const wallets = [aWallet('old', 'BGN')];

    // Act
    const currency = defaultCurrencyFor(wallets, CURRENCIES);

    // Assert
    expect(currency).toBe('');
  });
});
