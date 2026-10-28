import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { HomeViewProps } from './component-props';
import { HomeView } from './HomeView';

// Boundary under test: HomeView's props — what it renders for them and what it reports back.

function renderView(props: Partial<HomeViewProps> = {}) {
  const onSignOut = vi.fn<HomeViewProps['onSignOut']>();
  render(
    <HomeView
      email="me@example.test"
      onSignOut={onSignOut}
      isSigningOut={false}
      error={null}
      {...props}
    />,
  );
  return { onSignOut, user: userEvent.setup() };
}

describe('HomeView', () => {
  it('shows the signed-in email and nothing else in its place', () => {
    // Arrange & Act
    renderView({ email: 'me@example.test' });

    // Assert
    expect(screen.getByTestId('signed-in-email')).toHaveTextContent(/^me@example\.test$/);
  });

  it('reports Sign out when the button is pressed', async () => {
    // Arrange
    const { onSignOut, user } = renderView();

    // Act
    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    // Assert
    expect(onSignOut).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('sign-out-button')).toBe(
      screen.getByRole('button', { name: 'Sign out' }),
    );
  });

  it('disables the Sign out button while signing out is in flight', () => {
    // Arrange & Act
    renderView({ isSigningOut: true });

    // Assert
    expect(screen.getByTestId('sign-out-button')).toBeDisabled();
  });

  it('enables the Sign out button otherwise', () => {
    // Arrange & Act
    renderView({ isSigningOut: false });

    // Assert
    expect(screen.getByTestId('sign-out-button')).toBeEnabled();
  });

  it('says it is working in the button label while signing out is in flight', () => {
    // Arrange & Act
    renderView({ isSigningOut: true });

    // Assert
    expect(screen.getByTestId('sign-out-button')).toHaveTextContent(/^Signing out…$/);
  });

  it('shows no alert when signing out has not failed', () => {
    // Arrange & Act
    renderView({ error: null });

    // Assert
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows the failure in an alert so a failed sign-out is never silent', () => {
    // Arrange & Act
    renderView({ error: 'Something went wrong. Please try again.' });

    // Assert
    const alert = screen.getByRole('alert');
    expect(alert).toBe(screen.getByTestId('sign-out-error'));
    expect(alert).toHaveTextContent('Something went wrong. Please try again.');
  });
});
