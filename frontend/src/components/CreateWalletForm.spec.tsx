import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { CreateWalletFormProps } from './component-props';
import { CreateWalletForm } from './CreateWalletForm';

// Boundary under test: CreateWalletForm's props — what it renders for them and what it reports back. No rules live
// here: it reports what was typed, whatever it is, and the container decides what is sent.

const CURRENCIES = [
  { code: 'JPY', name: 'Japanese Yen', minorDigits: 0 },
  { code: 'THB', name: 'Thai Baht', minorDigits: 2 },
  { code: 'USD', name: 'United States Dollar', minorDigits: 2 },
];

const READY_PROPS = {
  currencies: CURRENCIES,
  defaultCurrency: '',
  isReady: true,
  isSubmitting: false,
  errors: [],
};

function renderForm(props: Partial<CreateWalletFormProps> = {}) {
  const onSubmit = vi.fn<CreateWalletFormProps['onSubmit']>();
  render(<CreateWalletForm {...READY_PROPS} onSubmit={onSubmit} {...props} />);
  return { onSubmit, user: userEvent.setup() };
}

describe('CreateWalletForm', () => {
  it('reports the typed name, the chosen Currency and the typed Opening Balance when Create wallet is pressed', async () => {
    // Arrange
    const { onSubmit, user } = renderForm();

    // Act
    await user.type(screen.getByTestId('wallet-name-input'), 'Cash');
    await user.selectOptions(screen.getByTestId('wallet-currency-select'), 'THB');
    await user.clear(screen.getByTestId('wallet-opening-balance-input'));
    await user.type(screen.getByTestId('wallet-opening-balance-input'), '1000');
    await user.click(screen.getByTestId('create-wallet-submit'));

    // Assert
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Cash',
      currency: 'THB',
      openingBalance: '1000',
    });
  });

  it('starts the Opening Balance at 0 and reports everything as typed, empty fields too', async () => {
    // Arrange
    const { onSubmit, user } = renderForm();

    // Act
    await user.click(screen.getByTestId('create-wallet-submit'));

    // Assert
    expect(screen.getByTestId('wallet-opening-balance-input')).toHaveValue('0');
    expect(onSubmit).toHaveBeenCalledWith({ name: '', currency: '', openingBalance: '0' });
  });

  it('labels every field, tells the browser to leave them alone, and offers a decimal keyboard for the Opening Balance', () => {
    // Arrange & Act
    renderForm();

    // Assert
    expect(screen.getByTestId('create-wallet-form')).toHaveAttribute('novalidate');
    expect(screen.getByLabelText('Name')).toBe(screen.getByTestId('wallet-name-input'));
    expect(screen.getByLabelText('Currency')).toBe(screen.getByTestId('wallet-currency-select'));
    expect(screen.getByLabelText('Opening Balance')).toBe(
      screen.getByTestId('wallet-opening-balance-input'),
    );
    expect(screen.getByTestId('wallet-name-input')).toHaveAttribute('autocomplete', 'off');
    expect(screen.getByTestId('wallet-opening-balance-input')).toHaveAttribute(
      'inputmode',
      'decimal',
    );
  });

  it('leaves the length of a name to the backend: no maxlength on the input', () => {
    // Arrange & Act
    renderForm();

    // Assert
    expect(screen.getByTestId('wallet-name-input')).not.toHaveAttribute('maxlength');
  });

  it('explains what an Opening Balance is, and that the Currency is for good, next to those fields', () => {
    // Arrange & Act
    renderForm();

    // Assert
    expect(screen.getByTestId('wallet-opening-balance-input')).toHaveAccessibleDescription(
      'What the Wallet holds today. It is not Income.',
    );
    expect(screen.getByTestId('wallet-currency-select')).toHaveAccessibleDescription(
      'Cannot be changed once the Wallet is created.',
    );
  });

  it('offers an empty choice first, then every Currency as its code and name', () => {
    // Arrange & Act
    renderForm();

    // Assert
    const options = Array.from(
      screen.getByTestId('wallet-currency-select').querySelectorAll('option'),
      (option) => [option.value, option.textContent],
    );
    expect(options).toEqual([
      ['', 'Choose a currency'],
      ['JPY', 'JPY — Japanese Yen'],
      ['THB', 'THB — Thai Baht'],
      ['USD', 'USD — United States Dollar'],
    ]);
  });

  it('chooses no Currency to begin with when none is the default', () => {
    // Arrange & Act
    renderForm({ defaultCurrency: '' });

    // Assert
    expect(screen.getByTestId('wallet-currency-select')).toHaveValue('');
  });

  it('chooses the default Currency to begin with (that of the last-created Wallet)', () => {
    // Arrange & Act
    renderForm({ defaultCurrency: 'USD' });

    // Assert
    expect(screen.getByTestId('wallet-currency-select')).toHaveValue('USD');
  });

  it('reports the default Currency when the person does not change it', async () => {
    // Arrange
    const { onSubmit, user } = renderForm({ defaultCurrency: 'USD' });

    // Act
    await user.click(screen.getByTestId('create-wallet-submit'));

    // Assert
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ currency: 'USD' }));
  });

  it('keeps the person’s own choice when the default arrives afterwards', async () => {
    // Arrange: the form is shown before the Wallets have loaded, so there is no default yet
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const { rerender } = render(
      <CreateWalletForm {...READY_PROPS} onSubmit={onSubmit} defaultCurrency="" />,
    );
    await user.selectOptions(screen.getByTestId('wallet-currency-select'), 'JPY');

    // Act
    rerender(<CreateWalletForm {...READY_PROPS} onSubmit={onSubmit} defaultCurrency="USD" />);

    // Assert
    expect(screen.getByTestId('wallet-currency-select')).toHaveValue('JPY');
  });

  it('keeps a name typed before the Currencies arrived', async () => {
    // Arrange
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const { rerender } = render(
      <CreateWalletForm {...READY_PROPS} onSubmit={onSubmit} currencies={[]} isReady={false} />,
    );
    await user.type(screen.getByTestId('wallet-name-input'), 'Cash');

    // Act
    rerender(<CreateWalletForm {...READY_PROPS} onSubmit={onSubmit} />);

    // Assert
    expect(screen.getByTestId('wallet-name-input')).toHaveValue('Cash');
  });

  it('cannot be submitted until the Currencies and Wallets have loaded', () => {
    // Arrange & Act
    renderForm({ isReady: false });

    // Assert
    expect(screen.getByTestId('create-wallet-submit')).toBeDisabled();
  });

  it('can be submitted once it is ready', () => {
    // Arrange & Act
    renderForm({ isReady: true, isSubmitting: false });

    // Assert
    expect(screen.getByTestId('create-wallet-submit')).toBeEnabled();
  });

  it('disables the submit button and says it is working while the request is in flight', () => {
    // Arrange & Act
    renderForm({ isReady: true, isSubmitting: true });

    // Assert
    expect(screen.getByTestId('create-wallet-submit')).toBeDisabled();
    expect(screen.getByTestId('create-wallet-submit')).toHaveTextContent(/^Creating…$/);
  });

  it('shows no alert when there is no error', () => {
    // Arrange & Act
    renderForm({ errors: [] });

    // Assert
    expect(screen.queryByTestId('create-wallet-error')).not.toBeInTheDocument();
  });

  it('shows every message in the alert, one line each', () => {
    // Arrange & Act
    renderForm({ errors: ['Enter a wallet name.', 'Opening balance is too large.'] });

    // Assert
    const alert = screen.getByRole('alert');
    expect(alert).toBe(screen.getByTestId('create-wallet-error'));
    expect(Array.from(alert.querySelectorAll('p'), (line) => line.textContent)).toEqual([
      'Enter a wallet name.',
      'Opening balance is too large.',
    ]);
  });

  it('keeps what was typed when an error appears', async () => {
    // Arrange
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const { rerender } = render(
      <CreateWalletForm {...READY_PROPS} onSubmit={onSubmit} errors={[]} />,
    );
    await user.type(screen.getByTestId('wallet-name-input'), 'Cash');
    await user.selectOptions(screen.getByTestId('wallet-currency-select'), 'THB');

    // Act
    rerender(
      <CreateWalletForm
        {...READY_PROPS}
        onSubmit={onSubmit}
        errors={['Opening balance is too large.']}
      />,
    );

    // Assert
    expect(screen.getByTestId('wallet-name-input')).toHaveValue('Cash');
    expect(screen.getByTestId('wallet-currency-select')).toHaveValue('THB');
  });
});
