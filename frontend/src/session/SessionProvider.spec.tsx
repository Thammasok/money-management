import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { User } from '../services/auth/auth.types';
import { createMockServices, deferred, renderWithProviders } from '../test-utils';
import { useSession } from './SessionProvider';

// Boundary under test: SessionProvider / useSession — how the Web App learns who is signed in, and tells it changed.

const USER: User = { id: '6c1f0a52-0b64-4d8e-9a53-5b0f6a2a7c11', email: 'me@example.test' };
const OTHER: User = { id: 'c0ffee00-0b64-4d8e-9a53-5b0f6a2a7c22', email: 'other@example.test' };

function WhoIsSignedIn() {
  const { session, signedIn, signedOut } = useSession();
  return (
    <div>
      <p id="who">
        {session.status === 'signed-in' ? `signed in as ${session.user.email}` : 'signed out'}
      </p>
      <button id="report-sign-in" type="button" onClick={() => signedIn(OTHER)}>
        report sign-in
      </button>
      <button id="report-sign-out" type="button" onClick={() => signedOut()}>
        report sign-out
      </button>
    </div>
  );
}

describe('SessionProvider', () => {
  it('renders nothing until the first /me answer, then its children', async () => {
    // Arrange
    const services = createMockServices();
    const answer = deferred<User | null>();
    services.authService.getCurrentUser.mockReturnValue(answer.promise);

    // Act
    renderWithProviders(<WhoIsSignedIn />, { services });

    // Assert — before the answer
    expect(screen.queryByTestId('who')).not.toBeInTheDocument();
    answer.resolve(null);
    expect(await screen.findByTestId('who')).toBeInTheDocument();
  });

  it('asks who is signed in exactly once', async () => {
    // Arrange
    const services = createMockServices();

    // Act
    renderWithProviders(<WhoIsSignedIn />, { services });
    await screen.findByTestId('who');

    // Assert
    expect(services.authService.getCurrentUser).toHaveBeenCalledTimes(1);
  });

  it('is signed out when /me says nobody is signed in', async () => {
    // Arrange
    const services = createMockServices();
    services.authService.getCurrentUser.mockResolvedValue(null);

    // Act
    renderWithProviders(<WhoIsSignedIn />, { services });

    // Assert
    expect(await screen.findByTestId('who')).toHaveTextContent('signed out');
  });

  it('is signed in as the User /me returns', async () => {
    // Arrange
    const services = createMockServices();
    services.authService.getCurrentUser.mockResolvedValue(USER);

    // Act
    renderWithProviders(<WhoIsSignedIn />, { services });

    // Assert
    expect(await screen.findByTestId('who')).toHaveTextContent('signed in as me@example.test');
  });

  it('is signed out when /me cannot be answered at all, so the person can still reach Sign In', async () => {
    // Arrange
    const services = createMockServices();
    services.authService.getCurrentUser.mockRejectedValue(new TypeError('Failed to fetch'));

    // Act
    renderWithProviders(<WhoIsSignedIn />, { services });

    // Assert
    expect(await screen.findByTestId('who')).toHaveTextContent('signed out');
  });

  it('follows what a screen reports: signed in, then signed out', async () => {
    // Arrange
    const user = userEvent.setup();
    renderWithProviders(<WhoIsSignedIn />);
    await screen.findByTestId('who');

    // Act
    await user.click(screen.getByTestId('report-sign-in'));

    // Assert
    expect(screen.getByTestId('who')).toHaveTextContent('signed in as other@example.test');

    // Act
    await user.click(screen.getByTestId('report-sign-out'));

    // Assert
    expect(screen.getByTestId('who')).toHaveTextContent('signed out');
  });
});

describe('useSession', () => {
  it('refuses to run outside a SessionProvider', () => {
    // Arrange
    const quietConsole = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Act
    const renderWithoutProvider = () => render(<WhoIsSignedIn />);

    // Assert
    expect(renderWithoutProvider).toThrow('useSession must be used inside a <SessionProvider>');
    quietConsole.mockRestore();
  });
});
