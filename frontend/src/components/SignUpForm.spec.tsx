import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PASSWORD_RULE_TEXT } from '../services/auth/auth-messages';
import type { SignUpFormProps } from './component-props';
import { SignUpForm } from './SignUpForm';

// Boundary under test: SignUpForm's props — what it renders for them and what it reports back.

function renderForm(props: Partial<SignUpFormProps> = {}) {
  const onSubmit = vi.fn<SignUpFormProps['onSubmit']>();
  render(<SignUpForm onSubmit={onSubmit} isSubmitting={false} errors={[]} {...props} />);
  return { onSubmit, user: userEvent.setup() };
}

describe('SignUpForm', () => {
  it('reports the typed email and password when Sign up is pressed', async () => {
    // Arrange
    const { onSubmit, user } = renderForm();

    // Act
    await user.type(screen.getByTestId('sign-up-email'), 'me@example.test');
    await user.type(screen.getByTestId('sign-up-password'), 'Sunny-Day-42');
    await user.click(screen.getByTestId('sign-up-submit'));

    // Assert
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith('me@example.test', 'Sunny-Day-42');
  });

  it('reports whatever was typed even when it is not an email — the backend says what is wrong', async () => {
    // Arrange
    const { onSubmit, user } = renderForm();

    // Act
    await user.type(screen.getByTestId('sign-up-email'), 'not-an-email');
    await user.click(screen.getByTestId('sign-up-submit'));

    // Assert
    expect(screen.getByTestId('sign-up-form')).toHaveAttribute('novalidate');
    expect(onSubmit).toHaveBeenCalledWith('not-an-email', '');
  });

  it('labels both fields and hints browsers to offer a new password', () => {
    // Arrange & Act
    renderForm();

    // Assert
    expect(screen.getByLabelText('Email')).toBe(screen.getByTestId('sign-up-email'));
    expect(screen.getByLabelText('Password')).toBe(screen.getByTestId('sign-up-password'));
    expect(screen.getByTestId('sign-up-email')).toHaveAttribute('autocomplete', 'email');
    expect(screen.getByTestId('sign-up-password')).toHaveAttribute('autocomplete', 'new-password');
  });

  it('always shows the password rule and ties it to the password field', () => {
    // Arrange & Act
    renderForm();

    // Assert
    const rule = screen.getByTestId('sign-up-password-rule');
    expect(rule).toHaveTextContent(PASSWORD_RULE_TEXT);
    expect(screen.getByTestId('sign-up-password')).toHaveAccessibleDescription(PASSWORD_RULE_TEXT);
  });

  it('shows no alert when there is nothing to report', () => {
    // Arrange & Act
    renderForm({ errors: [] });

    // Assert
    expect(screen.queryByTestId('sign-up-error')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows every error on its own line in one alert', () => {
    // Arrange & Act
    renderForm({ errors: ['Enter a valid email address.', 'Password must be strong.'] });

    // Assert
    const alert = screen.getByRole('alert');
    expect(alert).toBe(screen.getByTestId('sign-up-error'));
    expect(alert.querySelectorAll('p')).toHaveLength(2);
    expect(alert).toHaveTextContent('Enter a valid email address.');
    expect(alert).toHaveTextContent('Password must be strong.');
  });

  it('disables the submit button while the request is in flight', () => {
    // Arrange & Act
    renderForm({ isSubmitting: true });

    // Assert
    expect(screen.getByTestId('sign-up-submit')).toBeDisabled();
  });

  it('enables the submit button otherwise', () => {
    // Arrange & Act
    renderForm({ isSubmitting: false });

    // Assert
    expect(screen.getByTestId('sign-up-submit')).toBeEnabled();
  });

  it('says it is working in the button label while the request is in flight', () => {
    // Arrange & Act
    renderForm({ isSubmitting: true });

    // Assert
    expect(screen.getByTestId('sign-up-submit')).toHaveTextContent(/^Signing up…$/);
  });

  it('turns off spell-checking for the email and the password', () => {
    // Arrange & Act
    renderForm();

    // Assert
    expect(screen.getByTestId('sign-up-email')).toHaveAttribute('spellcheck', 'false');
    expect(screen.getByTestId('sign-up-password')).toHaveAttribute('spellcheck', 'false');
  });

  it('keeps what was typed when errors appear, so the person can fix it', async () => {
    // Arrange
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <SignUpForm onSubmit={onSubmit} isSubmitting={false} errors={[]} />,
    );
    await user.type(screen.getByTestId('sign-up-email'), 'me@example.test');
    await user.type(screen.getByTestId('sign-up-password'), 'weak');

    // Act
    rerender(
      <SignUpForm onSubmit={onSubmit} isSubmitting={false} errors={['Password must be strong.']} />,
    );

    // Assert
    expect(screen.getByTestId('sign-up-email')).toHaveValue('me@example.test');
    expect(screen.getByTestId('sign-up-password')).toHaveValue('weak');
  });
});
