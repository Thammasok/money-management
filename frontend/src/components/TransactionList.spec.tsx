import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Transaction } from '../services/wallets/wallet.types';
import type { TransactionListProps } from './component-props';
import { TransactionList } from './TransactionList';

// Boundary under test: TransactionList's props — a Wallet's Transactions as rows (Kind, amount in the Wallet's Currency,
// date, note), or the empty text. The order is the one given: the backend sorts newest first.

const NBSP = ' ';

function aTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 't1',
    walletId: 'w1',
    kind: 'expense',
    amountMinor: '12550',
    occurredOn: '2026-10-29',
    note: 'Lunch',
    createdAt: '2026-10-29T03:05:00.000Z',
    updatedAt: '2026-10-29T03:05:00.000Z',
    ...overrides,
  };
}

function renderList(props: Partial<TransactionListProps> = {}) {
  render(<TransactionList transactions={[]} currency="THB" minorDigits={2} {...props} />);
}

function column(field: string): (string | null | undefined)[] {
  return Array.from(
    screen.getByTestId('transaction-list').querySelectorAll('[data-transaction-row]'),
    (row) => row.querySelector(`[data-field="${field}"]`)?.textContent,
  );
}

describe('TransactionList', () => {
  it('says there are no Transactions yet, and shows no list', () => {
    // Arrange & Act
    renderList({ transactions: [] });

    // Assert
    expect(screen.getByTestId('transaction-list-empty')).toHaveTextContent(
      /^No transactions yet\.$/,
    );
    expect(screen.queryByTestId('transaction-list')).not.toBeInTheDocument();
  });

  it('shows a row per Transaction, in the order given, each with the id the Playwright contract finds it by', () => {
    // Arrange
    const transactions = [
      aTransaction({ id: 'c', note: 'C' }),
      aTransaction({ id: 'a', note: 'A' }),
    ];

    // Act
    renderList({ transactions });

    // Assert
    expect(screen.queryByTestId('transaction-list-empty')).not.toBeInTheDocument();
    expect(column('note')).toEqual(['C', 'A']);
    expect(screen.getByTestId('transaction-row-c')).toHaveAttribute('data-transaction-row');
    expect(screen.getByTestId('transaction-row-a')).toHaveAttribute('data-transaction-row');
  });

  it('marks each row with its Kind, so the screen can style Income and Expense apart without relying on colour alone', () => {
    // Arrange
    const transactions = [
      aTransaction({ id: 'i', kind: 'income' }),
      aTransaction({ id: 'e', kind: 'expense' }),
    ];

    // Act
    renderList({ transactions });

    // Assert
    expect(screen.getByTestId('transaction-row-i')).toHaveAttribute('data-kind', 'income');
    expect(screen.getByTestId('transaction-row-e')).toHaveAttribute('data-kind', 'expense');
  });

  it('labels the Kind in words: Income or Expense', () => {
    // Arrange
    const transactions = [
      aTransaction({ id: 'i', kind: 'income' }),
      aTransaction({ id: 'e', kind: 'expense' }),
    ];

    // Act
    renderList({ transactions });

    // Assert
    expect(column('kind')).toEqual(['Income', 'Expense']);
  });

  it('shows each amount in the Wallet’s Currency, unsigned — the Kind says which way the money went', () => {
    // Arrange
    const transactions = [
      aTransaction({ id: 'i', kind: 'income', amountMinor: '200000' }),
      aTransaction({ id: 'e', kind: 'expense', amountMinor: '12550' }),
    ];

    // Act
    renderList({ transactions });

    // Assert
    expect(column('amount')).toEqual([`THB${NBSP}2,000.00`, `THB${NBSP}125.50`]);
  });

  it('uses the digits of the Wallet’s Currency', () => {
    // Arrange & Act
    renderList({
      transactions: [aTransaction({ amountMinor: '1500' })],
      currency: 'JPY',
      minorDigits: 0,
    });

    // Assert
    expect(column('amount')).toEqual([`JPY${NBSP}1,500`]);
  });

  it('shows the date exactly as it was stored, as a date', () => {
    // Arrange & Act
    renderList({ transactions: [aTransaction({ occurredOn: '2024-02-29' })] });

    // Assert
    const date = screen.getByTestId('transaction-list').querySelector('[data-field="date"]');
    expect(date).toHaveTextContent(/^2024-02-29$/);
    expect(date).toHaveAttribute('datetime', '2024-02-29');
  });

  it('shows the note when there is one, and no note field when there is not', () => {
    // Arrange
    const transactions = [
      aTransaction({ id: 'with', note: 'Lunch' }),
      aTransaction({ id: 'without', note: null }),
    ];

    // Act
    renderList({ transactions });

    // Assert
    expect(
      screen.getByTestId('transaction-row-with').querySelector('[data-field="note"]'),
    ).toHaveTextContent(/^Lunch$/);
    expect(
      screen.getByTestId('transaction-row-without').querySelector('[data-field="note"]'),
    ).toBeNull();
  });

  it('shows a note as text, never as markup', () => {
    // Arrange
    const hostile = aTransaction({ note: '<img src=x onerror=alert(1)>' });

    // Act
    renderList({ transactions: [hostile] });

    // Assert
    expect(column('note')).toEqual(['<img src=x onerror=alert(1)>']);
    expect(screen.getByTestId('transaction-list').querySelector('img')).toBeNull();
  });
});
