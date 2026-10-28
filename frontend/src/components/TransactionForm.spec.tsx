import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { TransactionFormProps } from './component-props';
import { TransactionForm } from './TransactionForm';

// Boundary under test: TransactionForm's props — what it renders for them, what it reports back, and how it gets ready
// for the next Transaction once the container says the last one was saved. No rules live here.

const TODAY = '2026-10-29';

function renderForm(props: Partial<TransactionFormProps> = {}) {
  const onSubmit = vi.fn<TransactionFormProps['onSubmit']>().mockResolvedValue(true);
  render(
    <TransactionForm
      today={TODAY}
      isSubmitting={false}
      errors={[]}
      onSubmit={onSubmit}
      {...props}
    />,
  );
  return { onSubmit, user: userEvent.setup() };
}

describe('TransactionForm', () => {
  it('starts as an Expense dated today, with nothing typed', () => {
    // Arrange & Act
    renderForm();

    // Assert
    expect(screen.getByTestId('transaction-kind-expense')).toBeChecked();
    expect(screen.getByTestId('transaction-kind-income')).not.toBeChecked();
    expect(screen.getByTestId('transaction-date-input')).toHaveValue(TODAY);
    expect(screen.getByTestId('transaction-amount-input')).toHaveValue('');
    expect(screen.getByTestId('transaction-note-input')).toHaveValue('');
  });

  it('reports the entered Kind, amount, date and note when Save is pressed', async () => {
    // Arrange
    const { onSubmit, user } = renderForm();

    // Act
    await user.click(screen.getByTestId('transaction-kind-income'));
    await user.type(screen.getByTestId('transaction-amount-input'), '2000');
    await user.type(screen.getByTestId('transaction-note-input'), 'Salary');
    await user.click(screen.getByTestId('transaction-submit'));

    // Assert
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      kind: 'income',
      amount: '2000',
      date: TODAY,
      note: 'Salary',
    });
  });

  it('reports an Expense unless Income is chosen', async () => {
    // Arrange
    const { onSubmit, user } = renderForm();

    // Act
    await user.type(screen.getByTestId('transaction-amount-input'), '125.50');
    await user.click(screen.getByTestId('transaction-submit'));

    // Assert
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'expense', amount: '125.50' }),
    );
  });

  it('reports a date the person changed', async () => {
    // Arrange
    const { onSubmit, user } = renderForm();

    // Act
    await user.clear(screen.getByTestId('transaction-date-input'));
    await user.type(screen.getByTestId('transaction-date-input'), '2024-02-29');
    await user.click(screen.getByTestId('transaction-submit'));

    // Assert
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ date: '2024-02-29' }));
  });

  it('reports empty fields too — the backend and the container say what is missing', async () => {
    // Arrange
    const { onSubmit, user } = renderForm();

    // Act
    await user.click(screen.getByTestId('transaction-submit'));

    // Assert
    expect(screen.getByTestId('transaction-form')).toHaveAttribute('novalidate');
    expect(onSubmit).toHaveBeenCalledWith({ kind: 'expense', amount: '', date: TODAY, note: '' });
  });

  it('labels every field, offers a decimal keyboard for the amount, and offers no date after today', () => {
    // Arrange & Act
    renderForm();

    // Assert
    expect(screen.getByLabelText('Amount')).toBe(screen.getByTestId('transaction-amount-input'));
    expect(screen.getByLabelText('Date')).toBe(screen.getByTestId('transaction-date-input'));
    expect(screen.getByLabelText('Note (optional)')).toBe(
      screen.getByTestId('transaction-note-input'),
    );
    expect(screen.getByLabelText('Expense')).toBe(screen.getByTestId('transaction-kind-expense'));
    expect(screen.getByLabelText('Income')).toBe(screen.getByTestId('transaction-kind-income'));
    expect(screen.getByTestId('transaction-amount-input')).toHaveAttribute('inputmode', 'decimal');
    expect(screen.getByTestId('transaction-date-input')).toHaveAttribute('type', 'date');
    expect(screen.getByTestId('transaction-date-input')).toHaveAttribute('max', TODAY);
  });

  it('groups the two Kinds as one choice under the legend Kind', () => {
    // Arrange & Act
    renderForm();

    // Assert
    expect(screen.getByRole('group', { name: 'Kind' })).toContainElement(
      screen.getByTestId('transaction-kind-income'),
    );
    expect(screen.getByTestId('transaction-kind-expense')).toHaveAttribute('name', 'kind');
    expect(screen.getByTestId('transaction-kind-income')).toHaveAttribute('name', 'kind');
  });

  it('clears the amount and note after a save, keeps Kind and date, and returns focus to the amount', async () => {
    // Arrange
    const { user } = renderForm();
    await user.click(screen.getByTestId('transaction-kind-income'));
    await user.clear(screen.getByTestId('transaction-date-input'));
    await user.type(screen.getByTestId('transaction-date-input'), '2026-10-28');
    await user.type(screen.getByTestId('transaction-amount-input'), '10');
    await user.type(screen.getByTestId('transaction-note-input'), 'Tip');

    // Act
    await user.click(screen.getByTestId('transaction-submit'));

    // Assert
    await waitFor(() => expect(screen.getByTestId('transaction-amount-input')).toHaveValue(''));
    expect(screen.getByTestId('transaction-note-input')).toHaveValue('');
    expect(screen.getByTestId('transaction-kind-income')).toBeChecked();
    expect(screen.getByTestId('transaction-date-input')).toHaveValue('2026-10-28');
    expect(screen.getByTestId('transaction-amount-input')).toHaveFocus();
  });

  it('keeps everything that was entered when the Transaction was not saved', async () => {
    // Arrange
    const onSubmit = vi.fn<TransactionFormProps['onSubmit']>().mockResolvedValue(false);
    const { user } = renderForm({ onSubmit });
    await user.type(screen.getByTestId('transaction-amount-input'), 'abc');
    await user.type(screen.getByTestId('transaction-note-input'), 'Lunch');

    // Act
    await user.click(screen.getByTestId('transaction-submit'));

    // Assert
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('transaction-amount-input')).toHaveValue('abc');
    expect(screen.getByTestId('transaction-note-input')).toHaveValue('Lunch');
  });

  it('shows no alert when there is no error', () => {
    // Arrange & Act
    renderForm({ errors: [] });

    // Assert
    expect(screen.queryByTestId('transaction-error')).not.toBeInTheDocument();
  });

  it('shows every message in the alert, one line each', () => {
    // Arrange & Act
    renderForm({ errors: ['Amount must be greater than 0.', "Date can't be in the future."] });

    // Assert
    const alert = screen.getByRole('alert');
    expect(alert).toBe(screen.getByTestId('transaction-error'));
    expect(Array.from(alert.querySelectorAll('p'), (line) => line.textContent)).toEqual([
      'Amount must be greater than 0.',
      "Date can't be in the future.",
    ]);
  });

  it('disables Save and says it is working while the request is in flight', () => {
    // Arrange & Act
    renderForm({ isSubmitting: true });

    // Assert
    expect(screen.getByTestId('transaction-submit')).toBeDisabled();
    expect(screen.getByTestId('transaction-submit')).toHaveTextContent(/^Saving…$/);
  });

  it('enables Save otherwise', () => {
    // Arrange & Act
    renderForm({ isSubmitting: false });

    // Assert
    expect(screen.getByTestId('transaction-submit')).toBeEnabled();
    expect(screen.getByTestId('transaction-submit')).toHaveTextContent(/^Save$/);
  });
});
