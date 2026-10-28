import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { WalletListProps } from './component-props';
import { WalletList } from './WalletList';

// Boundary under test: WalletList's props — what Home shows for the User's Wallets while they load, when there are
// none, when there are some, and when they could not be loaded.

const BANK = { id: 'b7e1', name: 'Bank', currency: 'USD', createdAt: '2026-10-29T04:00:00.000Z' };
const CASH = { id: 'a3c9', name: 'Cash', currency: 'THB', createdAt: '2026-10-29T03:00:00.000Z' };

function renderList(props: Partial<WalletListProps> = {}) {
  render(
    <MemoryRouter>
      <WalletList wallets={[]} error={null} {...props} />
    </MemoryRouter>,
  );
}

describe('WalletList', () => {
  it('says the Wallets are loading, and claims neither that there are none nor that there are some', () => {
    // Arrange & Act
    renderList({ wallets: null });

    // Assert
    expect(screen.getByRole('status')).toHaveTextContent('Loading wallets…');
    expect(screen.queryByTestId('wallet-list-empty')).not.toBeInTheDocument();
    expect(screen.queryByTestId('wallet-list')).not.toBeInTheDocument();
  });

  it('says there are no Wallets yet, and shows no list', () => {
    // Arrange & Act
    renderList({ wallets: [] });

    // Assert
    expect(screen.getByTestId('wallet-list-empty')).toHaveTextContent(/^No wallets yet\.$/);
    expect(screen.queryByTestId('wallet-list')).not.toBeInTheDocument();
  });

  it('lists the Wallets in the order given, each with its name and its Currency code', () => {
    // Arrange & Act
    renderList({ wallets: [BANK, CASH] });

    // Assert
    const rows = screen.getByTestId('wallet-list').querySelectorAll('[data-wallet-row]');
    expect(
      Array.from(rows, (row) => row.querySelector('[data-field="name"]')?.textContent),
    ).toEqual(['Bank', 'Cash']);
    expect(
      Array.from(rows, (row) => row.querySelector('[data-field="currency"]')?.textContent),
    ).toEqual(['USD', 'THB']);
    expect(screen.queryByTestId('wallet-list-empty')).not.toBeInTheDocument();
  });

  it('gives each row the id the Playwright contract finds it by', () => {
    // Arrange & Act
    renderList({ wallets: [BANK, CASH] });

    // Assert
    expect(screen.getByTestId('wallet-row-b7e1')).toHaveAttribute('data-wallet-row');
    expect(screen.getByTestId('wallet-row-a3c9')).toHaveAttribute('data-wallet-row');
  });

  it('makes each name a link to that Wallet’s screen', () => {
    // Arrange & Act
    renderList({ wallets: [CASH] });

    // Assert
    expect(screen.getByRole('link', { name: 'Cash' })).toHaveAttribute('href', '/wallets/a3c9');
  });

  it('shows a name as text, never as markup', () => {
    // Arrange
    const hostile = { ...CASH, name: '<img src=x onerror=alert(1)>' };

    // Act
    renderList({ wallets: [hostile] });

    // Assert
    expect(screen.getByRole('link', { name: '<img src=x onerror=alert(1)>' })).toBeInTheDocument();
    expect(screen.getByTestId('wallet-list').querySelector('img')).toBeNull();
  });

  it('shows the failure in an alert instead of the list, and does not claim there are no Wallets', () => {
    // Arrange & Act
    renderList({ wallets: null, error: 'Something went wrong. Please try again.' });

    // Assert
    expect(screen.getByRole('alert')).toBe(screen.getByTestId('wallet-list-error'));
    expect(screen.getByRole('alert')).toHaveTextContent(
      /^Something went wrong\. Please try again\.$/,
    );
    expect(screen.queryByTestId('wallet-list-empty')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  const STATES: [string, Partial<WalletListProps>][] = [
    ['loading', { wallets: null }],
    ['empty', { wallets: [] }],
    ['listed', { wallets: [CASH] }],
    ['failed', { wallets: null, error: 'Not signed in.' }],
  ];

  it.each(STATES)('always offers New wallet, whatever the state (%s)', (_state, props) => {
    // Arrange & Act
    renderList(props);

    // Assert
    const link = screen.getByTestId('create-wallet-link');
    expect(link).toHaveTextContent(/^New wallet$/);
    expect(link).toHaveAttribute('href', '/wallets/new');
  });
});
