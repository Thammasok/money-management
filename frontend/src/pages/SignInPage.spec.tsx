import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../App';
import { ApiError } from '../services/auth/api-error';
import type { User } from '../services/auth/auth.types';
import { GENERIC_FAILURE_TEXT } from '../services/auth/auth-messages';
import { createMockServices, deferred, renderWithProviders } from '../test-utils';

// Boundary under test: the Sign In screen as a Visitor meets it — the typed values go to AuthService.signIn, and what
// comes back decides what is on screen. AuthService is the only thing mocked.

const USER: User = { id: '6c1f0a52-0b64-4d8e-9a53-5b0f6a2a7c11', email: 'me@example.test' };

async function openSignIn() {
  const services = createMockServices();
  renderWithProviders(<App />, { services, route: '/sign-in' });
  await screen.findByTestId('sign-in-page');
  return { services, user: userEvent.setup() };
}

async function submit(user: ReturnType<typeof userEvent.setup>, email: string, password: string) {
  await user.type(screen.getByTestId('sign-in-email'), email);
  await user.type(screen.getByTestId('sign-in-password'), password);
  await user.click(screen.getByTestId('sign-in-submit'));
}

describe('Sign In screen', () => {
  it('signs in with what was typed and lands on Home, signed in as that User', async () => {
    // Arrange
    const { services, user } = await openSignIn();
    services.authService.signIn.mockResolvedValue(USER);

    // Act
    await submit(user, 'me@example.test', 'Sunny-Day-42');

    // Assert
    expect(await screen.findByTestId('home-page')).toBeInTheDocument();
    expect(screen.getByTestId('signed-in-email')).toHaveTextContent('me@example.test');
    expect(services.authService.signIn).toHaveBeenCalledWith('me@example.test', 'Sunny-Day-42');
  });

  it('stays on Sign In and shows the 401 message when the credentials are wrong', async () => {
    // Arrange
    const { services, user } = await openSignIn();
    services.authService.signIn.mockRejectedValue(
      new ApiError(401, ['Email or password is incorrect.']),
    );

    // Act
    await submit(user, 'me@example.test', 'Not-The-Pass-1');

    // Assert
    expect(await screen.findByTestId('sign-in-error')).toHaveTextContent(
      /^Email or password is incorrect\.$/,
    );
    expect(screen.getByTestId('sign-in-page')).toBeInTheDocument();
    expect(screen.queryByTestId('home-page')).not.toBeInTheDocument();
  });

  it('says when to try again, in local time, when sign-in is paused', async () => {
    // Arrange
    const { services, user } = await openSignIn();
    services.authService.signIn.mockRejectedValue(
      new ApiError(
        429,
        ['Too many failed sign-ins. Try again later.'],
        new Date(Date.now() + 600_000).toISOString(),
      ),
    );

    // Act
    await submit(user, 'me@example.test', 'Sunny-Day-42');

    // Assert
    expect(await screen.findByTestId('sign-in-error')).toHaveTextContent(
      /^Too many failed sign-ins\. Try again at \d{1,2}:\d{2}.*\.$/,
    );
  });

  it('says something went wrong when the request itself fails', async () => {
    // Arrange
    const { services, user } = await openSignIn();
    services.authService.signIn.mockRejectedValue(new TypeError('Failed to fetch'));

    // Act
    await submit(user, 'me@example.test', 'Sunny-Day-42');

    // Assert
    expect(await screen.findByTestId('sign-in-error')).toHaveTextContent(GENERIC_FAILURE_TEXT);
  });

  it('disables the submit button while the request is in flight and enables it again after a refusal', async () => {
    // Arrange
    const { services, user } = await openSignIn();
    const answer = deferred<User>();
    services.authService.signIn.mockReturnValue(answer.promise);

    // Act
    await submit(user, 'me@example.test', 'Sunny-Day-42');

    // Assert — in flight
    expect(screen.getByTestId('sign-in-submit')).toBeDisabled();

    // Act
    answer.reject(new ApiError(401, ['Email or password is incorrect.']));

    // Assert — settled
    await screen.findByTestId('sign-in-error');
    expect(screen.getByTestId('sign-in-submit')).toBeEnabled();
  });

  it('takes the earlier message away when the person tries again', async () => {
    // Arrange
    const { services, user } = await openSignIn();
    services.authService.signIn.mockRejectedValueOnce(
      new ApiError(401, ['Email or password is incorrect.']),
    );
    await submit(user, 'me@example.test', 'Not-The-Pass-1');
    await screen.findByTestId('sign-in-error');
    const retry = deferred<User>();
    services.authService.signIn.mockReturnValue(retry.promise);

    // Act
    await user.click(screen.getByTestId('sign-in-submit'));

    // Assert
    expect(screen.queryByTestId('sign-in-error')).not.toBeInTheDocument();
  });
});
