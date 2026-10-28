import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../App';
import type { User } from '../services/auth/auth.types';
import { ApiError } from '../services/http/api-error';
import { GENERIC_FAILURE_TEXT } from '../services/http/failure-messages';
import { createMockServices, deferred, renderWithProviders } from '../test-utils';

// Boundary under test: the Sign Up screen as a Visitor meets it — the typed values go to AuthService.signUp, and what
// comes back decides what is on screen. AuthService is the only thing mocked.

const USER: User = { id: '6c1f0a52-0b64-4d8e-9a53-5b0f6a2a7c11', email: 'new@example.test' };

async function openSignUp() {
  const services = createMockServices();
  renderWithProviders(<App />, { services, route: '/sign-up' });
  await screen.findByTestId('sign-up-page');
  return { services, user: userEvent.setup() };
}

async function submit(user: ReturnType<typeof userEvent.setup>, email: string, password: string) {
  await user.type(screen.getByTestId('sign-up-email'), email);
  await user.type(screen.getByTestId('sign-up-password'), password);
  await user.click(screen.getByTestId('sign-up-submit'));
}

describe('Sign Up screen', () => {
  it('signs up with what was typed and lands on Home, signed in as the new User', async () => {
    // Arrange
    const { services, user } = await openSignUp();
    services.authService.signUp.mockResolvedValue(USER);

    // Act
    await submit(user, 'new@example.test', 'Sunny-Day-42');

    // Assert
    expect(await screen.findByTestId('home-page')).toBeInTheDocument();
    expect(screen.getByTestId('signed-in-email')).toHaveTextContent('new@example.test');
    expect(services.authService.signUp).toHaveBeenCalledWith('new@example.test', 'Sunny-Day-42');
  });

  it('stays on Sign Up and shows every message the backend sent when sign-up is refused with a 400', async () => {
    // Arrange
    const { services, user } = await openSignUp();
    services.authService.signUp.mockRejectedValue(
      new ApiError(400, ['Enter a valid email address.', 'Password must be strong.']),
    );

    // Act
    await submit(user, 'not-an-email', 'weak');

    // Assert
    const alert = await screen.findByTestId('sign-up-error');
    expect(alert).toHaveTextContent('Enter a valid email address.');
    expect(alert).toHaveTextContent('Password must be strong.');
    expect(screen.getByTestId('sign-up-page')).toBeInTheDocument();
    expect(screen.queryByTestId('home-page')).not.toBeInTheDocument();
  });

  it('shows the 409 message when the email is already registered', async () => {
    // Arrange
    const { services, user } = await openSignUp();
    services.authService.signUp.mockRejectedValue(
      new ApiError(409, ['This email is already registered.']),
    );

    // Act
    await submit(user, 'taken@example.test', 'Sunny-Day-42');

    // Assert
    expect(await screen.findByTestId('sign-up-error')).toHaveTextContent(
      'This email is already registered.',
    );
    expect(screen.getByTestId('sign-up-page')).toBeInTheDocument();
  });

  it('says something went wrong when the request itself fails', async () => {
    // Arrange
    const { services, user } = await openSignUp();
    services.authService.signUp.mockRejectedValue(new TypeError('Failed to fetch'));

    // Act
    await submit(user, 'new@example.test', 'Sunny-Day-42');

    // Assert
    expect(await screen.findByTestId('sign-up-error')).toHaveTextContent(GENERIC_FAILURE_TEXT);
  });

  it('disables the submit button while the request is in flight', async () => {
    // Arrange
    const { services, user } = await openSignUp();
    services.authService.signUp.mockReturnValue(deferred<User>().promise);

    // Act
    await submit(user, 'new@example.test', 'Sunny-Day-42');

    // Assert
    expect(screen.getByTestId('sign-up-submit')).toBeDisabled();
  });

  it('enables the submit button again after a refusal', async () => {
    // Arrange
    const { services, user } = await openSignUp();
    services.authService.signUp.mockRejectedValue(
      new ApiError(409, ['This email is already registered.']),
    );

    // Act
    await submit(user, 'new@example.test', 'Sunny-Day-42');

    // Assert
    await screen.findByTestId('sign-up-error');
    expect(screen.getByTestId('sign-up-submit')).toBeEnabled();
  });

  it('takes the earlier messages away when the person tries again', async () => {
    // Arrange
    const { services, user } = await openSignUp();
    services.authService.signUp.mockRejectedValueOnce(
      new ApiError(409, ['This email is already registered.']),
    );
    await submit(user, 'taken@example.test', 'Sunny-Day-42');
    await screen.findByTestId('sign-up-error');
    const retry = deferred<User>();
    services.authService.signUp.mockReturnValue(retry.promise);

    // Act
    await user.click(screen.getByTestId('sign-up-submit'));

    // Assert
    expect(screen.queryByTestId('sign-up-error')).not.toBeInTheDocument();
  });
});
