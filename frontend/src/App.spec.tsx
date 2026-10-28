import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './App';
import type { User } from './services/auth/auth.types';
import { createMockServices, deferred, renderWithProviders } from './test-utils';

// Boundary under test: the routes — which screen a Visitor or a User gets for a URL (artifacts/F-1/02-flow.md → Routing).

const USER: User = { id: '6c1f0a52-0b64-4d8e-9a53-5b0f6a2a7c11', email: 'me@example.test' };

function servicesSignedInAs(user: User) {
  const services = createMockServices();
  services.authService.getCurrentUser.mockResolvedValue(user);
  return services;
}

describe('App routing', () => {
  it('shows no screen at all until /me has answered', async () => {
    // Arrange
    const services = createMockServices();
    const answer = deferred<User | null>();
    services.authService.getCurrentUser.mockReturnValue(answer.promise);

    // Act
    const { container } = renderWithProviders(<App />, { services, route: '/' });

    // Assert
    expect(container).toBeEmptyDOMElement();
    answer.resolve(null);
    expect(await screen.findByTestId('sign-in-page')).toBeInTheDocument();
  });

  it('sends a Visitor who is not signed in from Home to Sign In', async () => {
    // Arrange & Act
    renderWithProviders(<App />, { route: '/' });

    // Assert
    expect(await screen.findByTestId('sign-in-page')).toBeInTheDocument();
    expect(screen.queryByTestId('home-page')).not.toBeInTheDocument();
  });

  it('lets a Visitor who is not signed in open Sign Up', async () => {
    // Arrange & Act
    renderWithProviders(<App />, { route: '/sign-up' });

    // Assert
    expect(await screen.findByTestId('sign-up-page')).toBeInTheDocument();
  });

  it.each(['/sign-in', '/sign-up'])(
    'sends a signed-in User who opens %s to Home',
    async (route) => {
      // Arrange
      const services = servicesSignedInAs(USER);

      // Act
      renderWithProviders(<App />, { services, route });

      // Assert
      expect(await screen.findByTestId('home-page')).toBeInTheDocument();
      expect(screen.getByTestId('signed-in-email')).toHaveTextContent('me@example.test');
    },
  );

  it('sends a signed-in User from an unknown path to Home', async () => {
    // Arrange
    const services = servicesSignedInAs(USER);

    // Act
    renderWithProviders(<App />, { services, route: '/no-such-screen' });

    // Assert
    expect(await screen.findByTestId('home-page')).toBeInTheDocument();
  });

  it('sends a Visitor from an unknown path to Sign In', async () => {
    // Arrange & Act
    renderWithProviders(<App />, { route: '/no-such-screen' });

    // Assert
    expect(await screen.findByTestId('sign-in-page')).toBeInTheDocument();
  });

  it.each(['/wallets/new', '/wallets/6c1f0a52-0b64-4d8e-9a53-5b0f6a2a7c11'])(
    'sends a Visitor who is not signed in from %s to Sign In',
    async (route) => {
      // Arrange & Act
      renderWithProviders(<App />, { route });

      // Assert
      expect(await screen.findByTestId('sign-in-page')).toBeInTheDocument();
    },
  );

  it('opens Create Wallet at /wallets/new — a static segment, never mistaken for a Wallet id', async () => {
    // Arrange
    const services = servicesSignedInAs(USER);

    // Act
    renderWithProviders(<App />, { services, route: '/wallets/new' });

    // Assert
    expect(await screen.findByTestId('create-wallet-page')).toBeInTheDocument();
    expect(services.walletService.getWallet).not.toHaveBeenCalled();
  });

  it('opens a Wallet at /wallets/:walletId for a signed-in User', async () => {
    // Arrange
    const services = servicesSignedInAs(USER);
    services.walletService.getWallet.mockResolvedValue({
      id: '6c1f0a52-0b64-4d8e-9a53-5b0f6a2a7c11',
      name: 'Cash',
      currency: 'THB',
      openingBalanceMinor: '0',
      balanceMinor: '0',
      createdAt: '2026-10-29T03:00:00.000Z',
      updatedAt: '2026-10-29T03:00:00.000Z',
      transactions: [],
    });
    services.walletService.listCurrencies.mockResolvedValue([
      { code: 'THB', name: 'Thai Baht', minorDigits: 2 },
    ]);

    // Act
    renderWithProviders(<App />, {
      services,
      route: '/wallets/6c1f0a52-0b64-4d8e-9a53-5b0f6a2a7c11',
    });

    // Assert
    expect(await screen.findByTestId('wallet-page')).toBeInTheDocument();
    expect(await screen.findByTestId('wallet-name-heading')).toHaveTextContent('Cash');
  });

  it('links Sign In to Sign Up', async () => {
    // Arrange
    const user = userEvent.setup();
    renderWithProviders(<App />, { route: '/sign-in' });
    await screen.findByTestId('sign-in-page');

    // Act
    await user.click(screen.getByTestId('go-to-sign-up-link'));

    // Assert
    expect(await screen.findByTestId('sign-up-page')).toBeInTheDocument();
  });

  it('links Sign Up to Sign In', async () => {
    // Arrange
    const user = userEvent.setup();
    renderWithProviders(<App />, { route: '/sign-up' });
    await screen.findByTestId('sign-up-page');

    // Act
    await user.click(screen.getByTestId('go-to-sign-in-link'));

    // Assert
    expect(await screen.findByTestId('sign-in-page')).toBeInTheDocument();
  });
});
