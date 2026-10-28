import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { ApiError } from '../services/http/api-error';
import { GENERIC_FAILURE_TEXT } from '../services/http/failure-messages';
import type { Currency, Transaction, WalletDetail } from '../services/wallets/wallet.types';
import { createMockServices, deferred, renderWithProviders } from '../test-utils';

// Boundary under test: the Wallet screen as a signed-in User meets it — what WalletService answers decides the name,
// Balance and Transactions on screen, what is entered becomes a request, and what comes back decides what changes.
// WalletService is the only thing mocked (with AuthService). The browser's date is fixed so "today" is known.

const NBSP = ' ';
const TODAY = '2026-10-29';
const USER = { id: '6c1f0a52-0b64-4d8e-9a53-5b0f6a2a7c11', email: 'me@example.test' };
const WALLET_ID = '0d4a9b7e-3c2f-4a51-8e60-2f1b9c7d5e33';
const CURRENCIES: Currency[] = [
  { code: 'JPY', name: 'Japanese Yen', minorDigits: 0 },
  { code: 'THB', name: 'Thai Baht', minorDigits: 2 },
];

function aWallet(overrides: Partial<WalletDetail> = {}): WalletDetail {
  return {
    id: WALLET_ID,
    name: 'Cash',
    currency: 'THB',
    openingBalanceMinor: '100000',
    balanceMinor: '100000',
    createdAt: '2026-10-29T03:00:00.000Z',
    updatedAt: '2026-10-29T03:00:00.000Z',
    transactions: [],
    ...overrides,
  };
}

function aTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 't1',
    walletId: WALLET_ID,
    kind: 'expense',
    amountMinor: '12550',
    occurredOn: TODAY,
    note: 'Lunch',
    createdAt: '2026-10-29T03:05:00.000Z',
    updatedAt: '2026-10-29T03:05:00.000Z',
    ...overrides,
  };
}

function servicesForWallet() {
  const services = createMockServices();
  services.authService.getCurrentUser.mockResolvedValue(USER);
  services.walletService.listCurrencies.mockResolvedValue(CURRENCIES);
  return services;
}

async function openWallet(wallet: WalletDetail = aWallet()) {
  const services = servicesForWallet();
  services.walletService.getWallet.mockResolvedValue(wallet);
  renderWithProviders(<App />, { services, route: `/wallets/${wallet.id}` });
  await screen.findByTestId('wallet-balance');
  return { services, user: userEvent.setup() };
}

function balanceText() {
  return screen.getByTestId('wallet-balance').textContent;
}

async function save(user: ReturnType<typeof userEvent.setup>, amount: string, note = '') {
  await user.type(screen.getByTestId('transaction-amount-input'), amount);
  if (note !== '') await user.type(screen.getByTestId('transaction-note-input'), note);
  await user.click(screen.getByTestId('transaction-submit'));
}

describe('Wallet screen', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 29, 10, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('showing the Wallet', () => {
    it('asks for the Wallet in the URL and shows its name, Currency and Balance', async () => {
      // Arrange & Act
      const { services } = await openWallet(aWallet({ name: 'Cash', balanceMinor: '87450' }));

      // Assert
      expect(services.walletService.getWallet).toHaveBeenCalledWith(WALLET_ID);
      expect(screen.getByTestId('wallet-name-heading')).toHaveTextContent(/^Cash$/);
      expect(screen.getByTestId('wallet-currency').textContent).toBe('THB');
      expect(balanceText()).toBe(`THB${NBSP}874.50`);
      expect(document.title).toBe('Cash · Money Management');
    });

    it('formats the Balance with the Currency’s own digits, and a negative one with its minus sign', async () => {
      // Arrange & Act
      await openWallet(aWallet({ currency: 'JPY', balanceMinor: '-1500' }));

      // Assert
      expect(balanceText()).toBe(`-JPY${NBSP}1,500`);
    });

    it('lists the Transactions in the order the service gives them, each in the Wallet’s Currency', async () => {
      // Arrange
      const newest = aTransaction({ id: 'c', kind: 'income', amountMinor: '200000', note: 'C' });
      const oldest = aTransaction({ id: 'a', kind: 'expense', amountMinor: '12550', note: 'A' });

      // Act
      await openWallet(aWallet({ transactions: [newest, oldest] }));

      // Assert
      const rows = screen
        .getByTestId('transaction-list')
        .querySelectorAll('[data-transaction-row]');
      expect(Array.from(rows, (row) => row.textContent)).toEqual([
        `Income THB${NBSP}2,000.00 ${TODAY} C`,
        `Expense THB${NBSP}125.50 ${TODAY} A`,
      ]);
    });

    it('says there are no Transactions yet for a new Wallet', async () => {
      // Arrange & Act
      await openWallet(aWallet({ transactions: [] }));

      // Assert
      expect(screen.getByTestId('transaction-list-empty')).toHaveTextContent(
        'No transactions yet.',
      );
    });

    it('starts the record form as an Expense dated today, offering no later date', async () => {
      // Arrange & Act
      await openWallet();

      // Assert
      expect(screen.getByTestId('transaction-kind-expense')).toBeChecked();
      expect(screen.getByTestId('transaction-date-input')).toHaveValue(TODAY);
      expect(screen.getByTestId('transaction-date-input')).toHaveAttribute('max', TODAY);
    });

    it('shows nothing of the Wallet while it is loading', async () => {
      // Arrange
      const services = servicesForWallet();
      services.walletService.getWallet.mockReturnValue(deferred<WalletDetail>().promise);

      // Act
      renderWithProviders(<App />, { services, route: `/wallets/${WALLET_ID}` });

      // Assert
      expect(await screen.findByRole('status')).toHaveTextContent('Loading wallet…');
      expect(screen.queryByTestId('wallet-balance')).not.toBeInTheDocument();
      expect(screen.queryByTestId('transaction-form')).not.toBeInTheDocument();
    });

    it('leads back to the Wallet list', async () => {
      // Arrange
      const { user } = await openWallet();

      // Act
      await user.click(screen.getByTestId('back-to-wallets-link'));

      // Assert
      expect(await screen.findByTestId('home-page')).toBeInTheDocument();
    });
  });

  describe('a Wallet that cannot be shown', () => {
    it.each(['not-a-uuid', WALLET_ID])(
      'says "Wallet not found." for a 404 (%s), with no Balance, no form, and the way back',
      async (id) => {
        // Arrange
        const services = servicesForWallet();
        services.walletService.getWallet.mockRejectedValue(
          new ApiError(404, ['Wallet not found.']),
        );

        // Act
        renderWithProviders(<App />, { services, route: `/wallets/${id}` });

        // Assert
        expect(await screen.findByTestId('wallet-not-found')).toHaveTextContent(
          /^Wallet not found\.$/,
        );
        expect(screen.getByRole('alert')).toBe(screen.getByTestId('wallet-not-found'));
        expect(screen.queryByTestId('wallet-balance')).not.toBeInTheDocument();
        expect(screen.queryByTestId('transaction-form')).not.toBeInTheDocument();
        expect(screen.getByTestId('back-to-wallets-link')).toHaveAttribute('href', '/');
      },
    );

    it.each([
      ['a 500', new ApiError(500, [])],
      ['no network', new TypeError('Failed to fetch')],
    ])('says something went wrong for %s, with the way back', async (_what, failure) => {
      // Arrange
      const services = servicesForWallet();
      services.walletService.getWallet.mockRejectedValue(failure);

      // Act
      renderWithProviders(<App />, { services, route: `/wallets/${WALLET_ID}` });

      // Assert
      expect(await screen.findByTestId('wallet-load-error')).toHaveTextContent(
        GENERIC_FAILURE_TEXT,
      );
      expect(screen.queryByTestId('wallet-not-found')).not.toBeInTheDocument();
      expect(screen.queryByTestId('wallet-balance')).not.toBeInTheDocument();
      expect(screen.getByTestId('back-to-wallets-link')).toBeInTheDocument();
    });

    it('says something went wrong when the Currencies cannot be loaded, since the Balance cannot be shown without them', async () => {
      // Arrange
      const services = servicesForWallet();
      services.walletService.getWallet.mockResolvedValue(aWallet());
      services.walletService.listCurrencies.mockRejectedValue(new ApiError(500, []));

      // Act
      renderWithProviders(<App />, { services, route: `/wallets/${WALLET_ID}` });

      // Assert
      expect(await screen.findByTestId('wallet-load-error')).toHaveTextContent(
        GENERIC_FAILURE_TEXT,
      );
      expect(screen.queryByTestId('wallet-balance')).not.toBeInTheDocument();
    });

    it('says something went wrong rather than guess the digits of a Currency that is not on the list', async () => {
      // Arrange
      const services = servicesForWallet();
      services.walletService.getWallet.mockResolvedValue(aWallet({ currency: 'BGN' }));

      // Act
      renderWithProviders(<App />, { services, route: `/wallets/${WALLET_ID}` });

      // Assert
      expect(await screen.findByTestId('wallet-load-error')).toHaveTextContent(
        GENERIC_FAILURE_TEXT,
      );
      expect(screen.queryByTestId('wallet-balance')).not.toBeInTheDocument();
    });
  });

  describe('recording a Transaction', () => {
    it('turns what was entered into the request — the amount in minor units, today from the browser — and then shows what the backend now derives', async () => {
      // Arrange
      const { services, user } = await openWallet();
      services.walletService.recordTransaction.mockResolvedValue(aTransaction());
      services.walletService.getWallet.mockResolvedValue(
        aWallet({ balanceMinor: '87450', transactions: [aTransaction()] }),
      );

      // Act
      await save(user, '125.50', 'Lunch');

      // Assert
      await waitFor(() => expect(balanceText()).toBe(`THB${NBSP}874.50`));
      expect(services.walletService.recordTransaction).toHaveBeenCalledTimes(1);
      expect(services.walletService.recordTransaction).toHaveBeenCalledWith(WALLET_ID, {
        kind: 'expense',
        amountMinor: '12550',
        occurredOn: TODAY,
        note: 'Lunch',
        today: TODAY,
      });
      expect(services.walletService.getWallet).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId('transaction-list')).toHaveTextContent('Lunch');
      expect(screen.queryByTestId('transaction-list-empty')).not.toBeInTheDocument();
    });

    it('records an Income when Income is chosen', async () => {
      // Arrange
      const { services, user } = await openWallet();
      services.walletService.recordTransaction.mockResolvedValue(aTransaction({ kind: 'income' }));
      await user.click(screen.getByTestId('transaction-kind-income'));

      // Act
      await save(user, '2000');

      // Assert
      await waitFor(() =>
        expect(services.walletService.recordTransaction).toHaveBeenCalledTimes(1),
      );
      expect(services.walletService.recordTransaction).toHaveBeenCalledWith(
        WALLET_ID,
        expect.objectContaining({ kind: 'income', amountMinor: '200000' }),
      );
    });

    it('uses the Wallet’s Currency for the digits of what is typed', async () => {
      // Arrange
      const { services, user } = await openWallet(aWallet({ currency: 'JPY' }));
      services.walletService.recordTransaction.mockResolvedValue(aTransaction());

      // Act
      await save(user, '1500');

      // Assert
      await waitFor(() =>
        expect(services.walletService.recordTransaction).toHaveBeenCalledTimes(1),
      );
      expect(services.walletService.recordTransaction).toHaveBeenCalledWith(
        WALLET_ID,
        expect.objectContaining({ amountMinor: '1500' }),
      );
    });

    it('sends today as it is when saving, not as it was when the page opened', async () => {
      // Arrange
      const { services, user } = await openWallet();
      services.walletService.recordTransaction.mockResolvedValue(aTransaction());
      vi.setSystemTime(new Date(2026, 9, 30, 0, 5, 0));

      // Act
      await save(user, '10');

      // Assert
      await waitFor(() =>
        expect(services.walletService.recordTransaction).toHaveBeenCalledTimes(1),
      );
      expect(services.walletService.recordTransaction).toHaveBeenCalledWith(
        WALLET_ID,
        expect.objectContaining({ occurredOn: TODAY, today: '2026-10-30' }),
      );
    });

    it('clears the amount and note after a save and hides an earlier error', async () => {
      // Arrange
      const { services, user } = await openWallet();
      services.walletService.recordTransaction.mockRejectedValueOnce(
        new ApiError(400, ['Amount must be greater than 0.']),
      );
      await save(user, '0');
      await screen.findByTestId('transaction-error');
      services.walletService.recordTransaction.mockResolvedValue(aTransaction());
      await user.clear(screen.getByTestId('transaction-amount-input'));

      // Act
      await save(user, '40', 'Snack');

      // Assert
      await waitFor(() => expect(screen.getByTestId('transaction-amount-input')).toHaveValue(''));
      expect(screen.getByTestId('transaction-note-input')).toHaveValue('');
      expect(screen.queryByTestId('transaction-error')).not.toBeInTheDocument();
    });

    it.each(['abc', '-5', '1.234'])(
      'refuses %j as an amount before anything is sent',
      async (typed) => {
        // Arrange
        const { services, user } = await openWallet();

        // Act
        await save(user, typed);

        // Assert
        expect(await screen.findByTestId('transaction-error')).toHaveTextContent(
          /^Enter a valid amount\.$/,
        );
        expect(services.walletService.recordTransaction).not.toHaveBeenCalled();
        expect(screen.getByTestId('transaction-amount-input')).toHaveValue(typed);
      },
    );

    it('refuses decimals the Wallet’s Currency does not have', async () => {
      // Arrange
      const { services, user } = await openWallet(aWallet({ currency: 'JPY' }));

      // Act
      await save(user, '15.5');

      // Assert
      expect(await screen.findByTestId('transaction-error')).toHaveTextContent(
        /^Enter a valid amount\.$/,
      );
      expect(services.walletService.recordTransaction).not.toHaveBeenCalled();
    });

    it('shows every message of a 400, keeps what was entered, and leaves the Balance as it was', async () => {
      // Arrange
      const { services, user } = await openWallet(aWallet({ balanceMinor: '100000' }));
      services.walletService.recordTransaction.mockRejectedValue(
        new ApiError(400, ['Amount must be greater than 0.', "Date can't be in the future."]),
      );

      // Act
      await save(user, '0', 'Oops');

      // Assert
      const alert = await screen.findByTestId('transaction-error');
      expect(Array.from(alert.querySelectorAll('p'), (line) => line.textContent)).toEqual([
        'Amount must be greater than 0.',
        "Date can't be in the future.",
      ]);
      expect(screen.getByTestId('transaction-amount-input')).toHaveValue('0');
      expect(screen.getByTestId('transaction-note-input')).toHaveValue('Oops');
      expect(balanceText()).toBe(`THB${NBSP}1,000.00`);
      expect(services.walletService.getWallet).toHaveBeenCalledTimes(1);
    });

    it('says "Wallet not found." in the form’s alert when the Wallet is gone by the time it is saved to', async () => {
      // Arrange
      const { services, user } = await openWallet();
      services.walletService.recordTransaction.mockRejectedValue(
        new ApiError(404, ['Wallet not found.']),
      );

      // Act
      await save(user, '10');

      // Assert
      expect(await screen.findByTestId('transaction-error')).toHaveTextContent(
        /^Wallet not found\.$/,
      );
    });

    it('shows the generic sentence when saving fails for any other reason, and can be tried again', async () => {
      // Arrange
      const { services, user } = await openWallet();
      services.walletService.recordTransaction.mockRejectedValue(new TypeError('Failed to fetch'));

      // Act
      await save(user, '10');

      // Assert
      expect(await screen.findByTestId('transaction-error')).toHaveTextContent(
        GENERIC_FAILURE_TEXT,
      );
      expect(screen.getByTestId('transaction-submit')).toBeEnabled();
      expect(screen.getByTestId('transaction-amount-input')).toHaveValue('10');
    });

    it('disables Save while the request is in flight, so a Transaction cannot be recorded twice', async () => {
      // Arrange
      const { services, user } = await openWallet();
      services.walletService.recordTransaction.mockReturnValue(deferred<Transaction>().promise);

      // Act
      await save(user, '10');

      // Assert
      expect(screen.getByTestId('transaction-submit')).toBeDisabled();
      expect(screen.getByTestId('transaction-submit')).toHaveTextContent('Saving…');
    });

    it('keeps Save disabled until the Wallet has been read again, not only until the Transaction is saved', async () => {
      // Arrange
      const { services, user } = await openWallet();
      services.walletService.recordTransaction.mockResolvedValue(aTransaction());
      services.walletService.getWallet.mockReturnValue(deferred<WalletDetail>().promise);

      // Act
      await save(user, '10');

      // Assert
      await waitFor(() => expect(services.walletService.getWallet).toHaveBeenCalledTimes(2));
      expect(screen.getByTestId('transaction-submit')).toBeDisabled();
    });

    it('says the Transaction was saved, and not to record it again, when the Wallet cannot be read afterwards', async () => {
      // Arrange
      const { services, user } = await openWallet();
      services.walletService.recordTransaction.mockResolvedValue(aTransaction());
      services.walletService.getWallet.mockRejectedValue(new TypeError('Failed to fetch'));

      // Act
      await save(user, '10');

      // Assert
      expect(await screen.findByTestId('wallet-load-error')).toHaveTextContent(
        'Saved, but this page could not be refreshed. Reload it to see the new Balance.',
      );
      expect(screen.queryByTestId('wallet-balance')).not.toBeInTheDocument();
      expect(screen.queryByTestId('transaction-form')).not.toBeInTheDocument();
      expect(screen.getByTestId('back-to-wallets-link')).toBeInTheDocument();
    });
  });
});
