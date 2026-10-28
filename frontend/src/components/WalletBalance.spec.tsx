import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { WalletBalanceProps } from './component-props';
import { WalletBalance } from './WalletBalance';

// Boundary under test: WalletBalance's props — a Wallet's Currency and its Balance, formatted in that Currency.

const NBSP = ' ';

function renderBalance(props: Partial<WalletBalanceProps> = {}) {
  render(<WalletBalance currency="THB" balanceMinor="87450" minorDigits={2} {...props} />);
}

describe('WalletBalance', () => {
  it('shows the Currency code and the Balance formatted in that Currency', () => {
    // Arrange & Act
    renderBalance({ currency: 'THB', balanceMinor: '87450', minorDigits: 2 });

    // Assert
    expect(screen.getByTestId('wallet-currency').textContent).toBe('THB');
    expect(screen.getByTestId('wallet-balance').textContent).toBe(`THB${NBSP}874.50`);
  });

  it('shows a negative Balance with its minus sign before the code', () => {
    // Arrange & Act
    renderBalance({ currency: 'JPY', balanceMinor: '-1500', minorDigits: 0 });

    // Assert
    expect(screen.getByTestId('wallet-balance').textContent).toBe(`-JPY${NBSP}1,500`);
  });

  it('marks a negative Balance, so the screen can style it apart (the minus sign still says it in words)', () => {
    // Arrange & Act
    renderBalance({ balanceMinor: '-250075' });

    // Assert
    expect(screen.getByTestId('wallet-balance')).toHaveAttribute('data-negative');
  });

  it.each(['0', '87450'])('does not mark a Balance of %s as negative', (balanceMinor) => {
    // Arrange & Act
    renderBalance({ balanceMinor });

    // Assert
    expect(screen.getByTestId('wallet-balance')).not.toHaveAttribute('data-negative');
  });

  it('labels both figures', () => {
    // Arrange & Act
    renderBalance();

    // Assert
    expect(screen.getByText('Balance')).toBeInTheDocument();
    expect(screen.getByText('Currency')).toBeInTheDocument();
  });
});
