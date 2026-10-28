import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../App';
import { ApiError } from '../services/http/api-error';
import { GENERIC_FAILURE_TEXT } from '../services/http/failure-messages';
import type { WalletDetail, WalletSummary } from '../services/wallets/wallet.types';
import { createMockServices, deferred, renderWithProviders } from '../test-utils';

// Boundary under test: Home's Wallet list as a signed-in User meets it — the Wallets WalletService answers decide what
// is on screen, and a row or New wallet leads on. WalletService is the only thing mocked (with AuthService).

const USER = { id: '6c1f0a52-0b64-4d8e-9a53-5b0f6a2a7c11', email: 'me@example.test' };
const BANK: WalletSummary = {
  id: 'b7e1',
  name: 'Bank',
  currency: 'USD',
  createdAt: '2026-10-29T04:00:00.000Z',
};
const CASH: WalletSummary = {
  id: 'a3c9',
  name: 'Cash',
  currency: 'THB',
  createdAt: '2026-10-29T03:00:00.000Z',
};

function openHome() {
  const services = createMockServices();
  services.authService.getCurrentUser.mockResolvedValue(USER);
  return services;
}

describe('Home Wallet list', () => {
  it('lists the User’s Wallets in the order the service gives them, each with its Currency', async () => {
    // Arrange
    const services = openHome();
    services.walletService.listWallets.mockResolvedValue([BANK, CASH]);

    // Act
    renderWithProviders(<App />, { services, route: '/' });

    // Assert
    expect(await screen.findByTestId('wallet-list')).toBeInTheDocument();
    const rows = screen.getAllByRole('listitem');
    expect(rows.map((row) => row.textContent)).toEqual(['Bank USD', 'Cash THB']);
    expect(screen.queryByTestId('wallet-list-empty')).not.toBeInTheDocument();
    expect(services.walletService.listWallets).toHaveBeenCalledTimes(1);
  });

  it('says there are no Wallets yet when the User has none, with a way to make the first', async () => {
    // Arrange
    const services = openHome();

    // Act
    renderWithProviders(<App />, { services, route: '/' });

    // Assert
    expect(await screen.findByTestId('wallet-list-empty')).toHaveTextContent('No wallets yet.');
    expect(screen.getByTestId('create-wallet-link')).toBeInTheDocument();
  });

  it('says the Wallets are loading, never "none yet", while the answer is on its way', async () => {
    // Arrange
    const services = openHome();
    services.walletService.listWallets.mockReturnValue(deferred<WalletSummary[]>().promise);

    // Act
    renderWithProviders(<App />, { services, route: '/' });

    // Assert
    expect(await screen.findByRole('status')).toHaveTextContent('Loading wallets…');
    expect(screen.queryByTestId('wallet-list-empty')).not.toBeInTheDocument();
  });

  it('shows the generic sentence when the Wallets cannot be loaded, and still offers Sign out', async () => {
    // Arrange
    const services = openHome();
    services.walletService.listWallets.mockRejectedValue(new ApiError(500, []));

    // Act
    renderWithProviders(<App />, { services, route: '/' });

    // Assert
    expect(await screen.findByTestId('wallet-list-error')).toHaveTextContent(GENERIC_FAILURE_TEXT);
    expect(screen.queryByTestId('wallet-list-empty')).not.toBeInTheDocument();
    expect(screen.getByTestId('sign-out-button')).toBeEnabled();
  });

  it('shows the backend’s own sentence when the session is gone', async () => {
    // Arrange
    const services = openHome();
    services.walletService.listWallets.mockRejectedValue(new ApiError(401, ['Not signed in.']));

    // Act
    renderWithProviders(<App />, { services, route: '/' });

    // Assert
    expect(await screen.findByTestId('wallet-list-error')).toHaveTextContent('Not signed in.');
  });

  it('shows the generic sentence when there is no network', async () => {
    // Arrange
    const services = openHome();
    services.walletService.listWallets.mockRejectedValue(new TypeError('Failed to fetch'));

    // Act
    renderWithProviders(<App />, { services, route: '/' });

    // Assert
    expect(await screen.findByTestId('wallet-list-error')).toHaveTextContent(GENERIC_FAILURE_TEXT);
  });

  it('leads from New wallet to Create Wallet', async () => {
    // Arrange
    const services = openHome();
    renderWithProviders(<App />, { services, route: '/' });
    const user = userEvent.setup();

    // Act
    await user.click(await screen.findByTestId('create-wallet-link'));

    // Assert
    expect(await screen.findByTestId('create-wallet-page')).toBeInTheDocument();
  });

  it('leads from a row to that Wallet’s screen', async () => {
    // Arrange
    const services = openHome();
    services.walletService.listWallets.mockResolvedValue([CASH]);
    services.walletService.listCurrencies.mockResolvedValue([
      { code: 'THB', name: 'Thai Baht', minorDigits: 2 },
    ]);
    const detail: WalletDetail = {
      ...CASH,
      openingBalanceMinor: '0',
      balanceMinor: '0',
      updatedAt: CASH.createdAt,
      transactions: [],
    };
    services.walletService.getWallet.mockResolvedValue(detail);
    renderWithProviders(<App />, { services, route: '/' });
    const user = userEvent.setup();

    // Act
    await user.click(await screen.findByRole('link', { name: 'Cash' }));

    // Assert
    expect(await screen.findByTestId('wallet-page')).toBeInTheDocument();
    expect(services.walletService.getWallet).toHaveBeenCalledWith('a3c9');
  });
});
