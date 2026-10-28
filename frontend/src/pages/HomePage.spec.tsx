import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../App';
import { ApiError } from '../services/http/api-error';
import { GENERIC_FAILURE_TEXT } from '../services/http/failure-messages';
import { createMockServices, deferred, renderWithProviders } from '../test-utils';

// Boundary under test: Home as a signed-in User meets it — who they are, and Sign out. AuthService is the only thing mocked.

async function openHomeSignedIn() {
  const services = createMockServices();
  services.authService.getCurrentUser.mockResolvedValue({
    id: '6c1f0a52-0b64-4d8e-9a53-5b0f6a2a7c11',
    email: 'me@example.test',
  });
  renderWithProviders(<App />, { services, route: '/' });
  await screen.findByTestId('home-page');
  return { services, user: userEvent.setup() };
}

describe('Home screen', () => {
  it('shows who is signed in', async () => {
    // Arrange & Act
    await openHomeSignedIn();

    // Assert
    expect(screen.getByTestId('signed-in-email')).toHaveTextContent(/^me@example\.test$/);
  });

  it('signs out and lands on Sign In, where Home is out of reach', async () => {
    // Arrange
    const { services, user } = await openHomeSignedIn();

    // Act
    await user.click(screen.getByTestId('sign-out-button'));

    // Assert
    expect(await screen.findByTestId('sign-in-page')).toBeInTheDocument();
    expect(services.authService.signOut).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('home-page')).not.toBeInTheDocument();
  });

  it('disables Sign out while signing out is in flight', async () => {
    // Arrange
    const { services, user } = await openHomeSignedIn();
    services.authService.signOut.mockReturnValue(deferred<void>().promise);

    // Act
    await user.click(screen.getByTestId('sign-out-button'));

    // Assert
    expect(screen.getByTestId('sign-out-button')).toBeDisabled();
  });

  it('stays on Home and says so when signing out fails, so a failure is never silent', async () => {
    // Arrange
    const { services, user } = await openHomeSignedIn();
    services.authService.signOut.mockRejectedValue(new ApiError(500, []));

    // Act
    await user.click(screen.getByTestId('sign-out-button'));

    // Assert
    expect(await screen.findByTestId('sign-out-error')).toHaveTextContent(GENERIC_FAILURE_TEXT);
    expect(screen.getByTestId('home-page')).toBeInTheDocument();
    expect(screen.getByTestId('sign-out-button')).toBeEnabled();
  });

  it('takes the failure away when the person tries signing out again', async () => {
    // Arrange
    const { services, user } = await openHomeSignedIn();
    services.authService.signOut.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await user.click(screen.getByTestId('sign-out-button'));
    await screen.findByTestId('sign-out-error');
    services.authService.signOut.mockReturnValue(deferred<void>().promise);

    // Act
    await user.click(screen.getByTestId('sign-out-button'));

    // Assert
    expect(screen.queryByTestId('sign-out-error')).not.toBeInTheDocument();
  });
});
