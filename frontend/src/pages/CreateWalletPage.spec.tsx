import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../App';
import { ApiError } from '../services/http/api-error';
import { GENERIC_FAILURE_TEXT } from '../services/http/failure-messages';
import type {
  Currency,
  Wallet,
  WalletDetail,
  WalletSummary,
} from '../services/wallets/wallet.types';
import { createMockServices, deferred, renderWithProviders } from '../test-utils';

// Boundary under test: Create Wallet as a signed-in User meets it — the Currencies and Wallets WalletService answers
// decide the picker and its default, what is typed becomes the request, and what comes back decides what is on screen.
// WalletService is the only thing mocked (with AuthService).

const USER = { id: '6c1f0a52-0b64-4d8e-9a53-5b0f6a2a7c11', email: 'me@example.test' };
const CURRENCIES: Currency[] = [
  { code: 'JPY', name: 'Japanese Yen', minorDigits: 0 },
  { code: 'THB', name: 'Thai Baht', minorDigits: 2 },
  { code: 'USD', name: 'United States Dollar', minorDigits: 2 },
];
const NEW_WALLET: Wallet = {
  id: '0d4a9b7e-3c2f-4a51-8e60-2f1b9c7d5e33',
  name: 'Cash',
  currency: 'THB',
  openingBalanceMinor: '100000',
  balanceMinor: '100000',
  createdAt: '2026-10-29T03:00:00.000Z',
  updatedAt: '2026-10-29T03:00:00.000Z',
};

function aWalletSummary(currency: string): WalletSummary {
  return {
    id: `wallet-${currency}`,
    name: currency,
    currency,
    createdAt: '2026-10-29T03:00:00.000Z',
  };
}

function servicesForCreateWallet(wallets: WalletSummary[] = []) {
  const services = createMockServices();
  services.authService.getCurrentUser.mockResolvedValue(USER);
  services.walletService.listCurrencies.mockResolvedValue(CURRENCIES);
  services.walletService.listWallets.mockResolvedValue(wallets);
  return services;
}

async function openCreateWallet(services = servicesForCreateWallet()) {
  renderWithProviders(<App />, { services, route: '/wallets/new' });
  await screen.findByTestId('create-wallet-page');
  await waitFor(() => expect(screen.getByTestId('create-wallet-submit')).toBeEnabled());
  return { services, user: userEvent.setup() };
}

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>, opening = '1000') {
  await user.type(screen.getByTestId('wallet-name-input'), 'Cash');
  await user.selectOptions(screen.getByTestId('wallet-currency-select'), 'THB');
  await user.clear(screen.getByTestId('wallet-opening-balance-input'));
  await user.type(screen.getByTestId('wallet-opening-balance-input'), opening);
  await user.click(screen.getByTestId('create-wallet-submit'));
}

describe('Create Wallet screen', () => {
  it('fills the Currency picker from the Currencies the service lists', async () => {
    // Arrange & Act
    const { services } = await openCreateWallet();

    // Assert
    const codes = Array.from(
      screen.getByTestId('wallet-currency-select').querySelectorAll('option'),
      (o) => o.value,
    );
    expect(codes).toEqual(['', 'JPY', 'THB', 'USD']);
    expect(services.walletService.listCurrencies).toHaveBeenCalledTimes(1);
  });

  it('starts with the Currency of the last-created Wallet, which the list gives first', async () => {
    // Arrange
    const services = servicesForCreateWallet([aWalletSummary('USD'), aWalletSummary('THB')]);

    // Act
    await openCreateWallet(services);

    // Assert
    expect(screen.getByTestId('wallet-currency-select')).toHaveValue('USD');
  });

  it('starts with no Currency when the User has no Wallets yet', async () => {
    // Arrange & Act
    await openCreateWallet();

    // Assert
    expect(screen.getByTestId('wallet-currency-select')).toHaveValue('');
  });

  it('starts with no Currency when the last-created Wallet’s Currency is no longer on the list', async () => {
    // Arrange
    const services = servicesForCreateWallet([aWalletSummary('BGN')]);

    // Act
    await openCreateWallet(services);

    // Assert
    expect(screen.getByTestId('wallet-currency-select')).toHaveValue('');
  });

  it('cannot be submitted until the Currencies and the Wallets have both answered', async () => {
    // Arrange
    const services = servicesForCreateWallet();
    services.walletService.listWallets.mockReturnValue(deferred<WalletSummary[]>().promise);

    // Act
    renderWithProviders(<App />, { services, route: '/wallets/new' });

    // Assert
    expect(await screen.findByTestId('create-wallet-submit')).toBeDisabled();
  });

  it.each([
    [
      'the Currencies',
      (s: ReturnType<typeof servicesForCreateWallet>) => s.walletService.listCurrencies,
    ],
    ['the Wallets', (s: ReturnType<typeof servicesForCreateWallet>) => s.walletService.listWallets],
  ])(
    'says something went wrong, and cannot be submitted, when %s cannot be loaded',
    async (_what, failing) => {
      // Arrange
      const services = servicesForCreateWallet();
      failing(services).mockRejectedValue(new ApiError(500, []));

      // Act
      renderWithProviders(<App />, { services, route: '/wallets/new' });

      // Assert
      expect(await screen.findByTestId('create-wallet-error')).toHaveTextContent(
        GENERIC_FAILURE_TEXT,
      );
      expect(screen.getByTestId('create-wallet-submit')).toBeDisabled();
    },
  );

  it('turns what was typed into the request — the Opening Balance in minor units — and lands on the new Wallet', async () => {
    // Arrange
    const { services, user } = await openCreateWallet();
    services.walletService.createWallet.mockResolvedValue(NEW_WALLET);
    const detail: WalletDetail = { ...NEW_WALLET, transactions: [] };
    services.walletService.getWallet.mockResolvedValue(detail);

    // Act
    await fillAndSubmit(user, '1000');

    // Assert
    expect(await screen.findByTestId('wallet-page')).toBeInTheDocument();
    expect(services.walletService.createWallet).toHaveBeenCalledTimes(1);
    expect(services.walletService.createWallet).toHaveBeenCalledWith({
      name: 'Cash',
      currency: 'THB',
      openingBalanceMinor: '100000',
    });
    expect(services.walletService.getWallet).toHaveBeenCalledWith(NEW_WALLET.id);
    expect(screen.queryByTestId('create-wallet-page')).not.toBeInTheDocument();
  });

  it('replaces Create Wallet in the history, so Back from the new Wallet does not return to an empty form', async () => {
    // Arrange
    const { services, user } = await openCreateWallet();
    services.walletService.createWallet.mockResolvedValue(NEW_WALLET);
    services.walletService.getWallet.mockResolvedValue({ ...NEW_WALLET, transactions: [] });

    // Act
    await fillAndSubmit(user);
    await screen.findByTestId('wallet-page');
    await user.click(screen.getByTestId('back-to-wallets-link'));

    // Assert
    expect(await screen.findByTestId('home-page')).toBeInTheDocument();
  });

  it('refuses a missing Currency before anything is sent', async () => {
    // Arrange
    const { services, user } = await openCreateWallet();

    // Act
    await user.type(screen.getByTestId('wallet-name-input'), 'Cash');
    await user.click(screen.getByTestId('create-wallet-submit'));

    // Assert
    expect(await screen.findByTestId('create-wallet-error')).toHaveTextContent(
      /^Choose a supported currency\.$/,
    );
    expect(services.walletService.createWallet).not.toHaveBeenCalled();
  });

  it.each(['12.345', 'abc'])(
    'refuses an Opening Balance of %j before anything is sent',
    async (opening) => {
      // Arrange
      const { services, user } = await openCreateWallet();

      // Act
      await fillAndSubmit(user, opening);

      // Assert
      expect(await screen.findByTestId('create-wallet-error')).toHaveTextContent(
        /^Enter a valid amount\.$/,
      );
      expect(services.walletService.createWallet).not.toHaveBeenCalled();
      expect(screen.getByTestId('create-wallet-page')).toBeInTheDocument();
    },
  );

  it('shows every message of a 400, stays on the form, and keeps what was typed', async () => {
    // Arrange
    const { services, user } = await openCreateWallet();
    services.walletService.createWallet.mockRejectedValue(
      new ApiError(400, ['Enter a wallet name.', 'Opening balance is too large.']),
    );

    // Act
    await fillAndSubmit(user, '1000');

    // Assert
    const alert = await screen.findByTestId('create-wallet-error');
    expect(Array.from(alert.querySelectorAll('p'), (line) => line.textContent)).toEqual([
      'Enter a wallet name.',
      'Opening balance is too large.',
    ]);
    expect(screen.getByTestId('wallet-name-input')).toHaveValue('Cash');
    expect(screen.getByTestId('wallet-opening-balance-input')).toHaveValue('1000');
    expect(screen.getByTestId('create-wallet-submit')).toBeEnabled();
  });

  it('shows the generic sentence when the request fails for any other reason, and can be tried again', async () => {
    // Arrange
    const { services, user } = await openCreateWallet();
    services.walletService.createWallet.mockRejectedValue(new TypeError('Failed to fetch'));

    // Act
    await fillAndSubmit(user);

    // Assert
    expect(await screen.findByTestId('create-wallet-error')).toHaveTextContent(
      GENERIC_FAILURE_TEXT,
    );
    expect(screen.getByTestId('create-wallet-submit')).toBeEnabled();
  });

  it('takes the old message away when the person tries again', async () => {
    // Arrange
    const { services, user } = await openCreateWallet();
    services.walletService.createWallet.mockRejectedValueOnce(
      new ApiError(400, ['Enter a wallet name.']),
    );
    await fillAndSubmit(user);
    await screen.findByTestId('create-wallet-error');
    services.walletService.createWallet.mockReturnValue(deferred<Wallet>().promise);

    // Act
    await user.click(screen.getByTestId('create-wallet-submit'));

    // Assert
    expect(screen.queryByTestId('create-wallet-error')).not.toBeInTheDocument();
  });

  it('disables Create wallet and says it is working while the request is in flight', async () => {
    // Arrange
    const { services, user } = await openCreateWallet();
    services.walletService.createWallet.mockReturnValue(deferred<Wallet>().promise);

    // Act
    await fillAndSubmit(user);

    // Assert
    expect(screen.getByTestId('create-wallet-submit')).toBeDisabled();
    expect(screen.getByTestId('create-wallet-submit')).toHaveTextContent('Creating…');
  });

  it('goes back Home when the person cancels', async () => {
    // Arrange
    const { user } = await openCreateWallet();

    // Act
    await user.click(screen.getByTestId('cancel-create-wallet-link'));

    // Assert
    expect(await screen.findByTestId('home-page')).toBeInTheDocument();
  });

  it('is titled New wallet', async () => {
    // Arrange & Act
    await openCreateWallet();

    // Assert
    expect(screen.getByRole('heading', { level: 1, name: 'New wallet' })).toBeInTheDocument();
    expect(document.title).toBe('New wallet · Money Management');
  });
});
