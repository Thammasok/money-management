import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { SignInFormProps } from './component-props';
import { SignInForm } from './SignInForm';

// Boundary under test: SignInForm's props — what it renders for them and what it reports back.

function renderForm(props: Partial<SignInFormProps> = {}) {
  const onSubmit = vi.fn<SignInFormProps['onSubmit']>();
  render(<SignInForm onSubmit={onSubmit} isSubmitting={false} error={null} {...props} />);
  return { onSubmit, user: userEvent.setup() };
}

describe('SignInForm', () => {
  it('reports the typed email and password when Sign in is pressed', async () => {
    // Arrange
    const { onSubmit, user } = renderForm();

    // Act
    await user.type(screen.getByTestId('sign-in-email'), 'me@example.test');
    await user.type(screen.getByTestId('sign-in-password'), 'Sunny-Day-42');
    await user.click(screen.getByTestId('sign-in-submit'));

    // Assert
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith('me@example.test', 'Sunny-Day-42');
  });

  it('reports empty fields too — the backend says what is missing', async () => {
    // Arrange
    const { onSubmit, user } = renderForm();

    // Act
    await user.click(screen.getByTestId('sign-in-submit'));

    // Assert
    expect(screen.getByTestId('sign-in-form')).toHaveAttribute('novalidate');
    expect(onSubmit).toHaveBeenCalledWith('', '');
  });

  it('labels both fields and hints browsers to offer the saved password', () => {
    // Arrange & Act
    renderForm();

    // Assert
    expect(screen.getByLabelText('Email')).toBe(screen.getByTestId('sign-in-email'));
    expect(screen.getByLabelText('Password')).toBe(screen.getByTestId('sign-in-password'));
    expect(screen.getByTestId('sign-in-email')).toHaveAttribute('autocomplete', 'email');
    expect(screen.getByTestId('sign-in-password')).toHaveAttribute(
      'autocomplete',
      'current-password',
    );
  });

  it('shows no alert when there is no error', () => {
    // Arrange & Act
    renderForm({ error: null });

    // Assert
    expect(screen.queryByTestId('sign-in-error')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows the error, and only the error, in the alert', () => {
    // Arrange & Act
    renderForm({ error: 'Email or password is incorrect.' });

    // Assert
    const alert = screen.getByRole('alert');
    expect(alert).toBe(screen.getByTestId('sign-in-error'));
    expect(alert).toHaveTextContent(/^Email or password is incorrect\.$/);
  });

  it('disables the submit button while the request is in flight', () => {
    // Arrange & Act
    renderForm({ isSubmitting: true });

    // Assert
    expect(screen.getByTestId('sign-in-submit')).toBeDisabled();
  });

  it('enables the submit button otherwise', () => {
    // Arrange & Act
    renderForm({ isSubmitting: false });

    // Assert
    expect(screen.getByTestId('sign-in-submit')).toBeEnabled();
  });

  it('says it is working in the button label while the request is in flight', () => {
    // Arrange & Act
    renderForm({ isSubmitting: true });

    // Assert
    expect(screen.getByTestId('sign-in-submit')).toHaveTextContent(/^Signing in…$/);
  });

  it('keeps what was typed when the error appears', async () => {
    // Arrange
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <SignInForm onSubmit={onSubmit} isSubmitting={false} error={null} />,
    );
    await user.type(screen.getByTestId('sign-in-email'), 'me@example.test');
    await user.type(screen.getByTestId('sign-in-password'), 'Not-The-Pass-1');

    // Act
    rerender(
      <SignInForm
        onSubmit={onSubmit}
        isSubmitting={false}
        error="Email or password is incorrect."
      />,
    );

    // Assert
    expect(screen.getByTestId('sign-in-email')).toHaveValue('me@example.test');
    expect(screen.getByTestId('sign-in-password')).toHaveValue('Not-The-Pass-1');
  });
});
