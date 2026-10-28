import { useRef, useState, type FormEvent } from 'react';
import type { TransactionKind } from '../services/wallets/wallet.types';
import type { TransactionFormProps } from './component-props';
import { ErrorList } from './ErrorList';
import { TextField } from './TextField';

// The two Kinds are one segmented control: radio inputs drawn as buttons (daisyUI names each with its `aria-label`).
// A checked button would be the primary colour, but the form's one primary action is Save, so the checked Kind is the
// inverse of the page (ink on paper becomes paper on ink, and the other way round at night) — the one pair that stays
// plainly different from the unchecked button in both schemes.
const KIND_BUTTON_CLASSES =
  'btn btn-lg join-item flex-1 checked:[--btn-color:var(--color-base-content)] checked:[--btn-fg:var(--color-base-100)]';

/**
 * Humble: renders what it is given and reports what the person entered. Once the container says the Transaction was
 * saved it gets ready for the next one — the amount and note are cleared, Kind and date are kept (people record a run
 * of Transactions for one day), and focus goes back to the amount. No rules live here.
 */
export function TransactionForm({ today, isSubmitting, errors, onSubmit }: TransactionFormProps) {
  const [kind, setKind] = useState<TransactionKind>('expense');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  const amountInput = useRef<HTMLInputElement>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const isSaved = await onSubmit({ kind, amount, date, note });
    if (isSaved) {
      setAmount('');
      setNote('');
      amountInput.current?.focus();
    }
  }

  return (
    <form id="transaction-form" noValidate className="flex flex-col gap-5" onSubmit={handleSubmit}>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-semibold">Kind</legend>
        <div className="join w-full">
          <input
            id="transaction-kind-expense"
            type="radio"
            name="kind"
            value="expense"
            aria-label="Expense"
            checked={kind === 'expense'}
            onChange={() => setKind('expense')}
            className={KIND_BUTTON_CLASSES}
          />
          <input
            id="transaction-kind-income"
            type="radio"
            name="kind"
            value="income"
            aria-label="Income"
            checked={kind === 'income'}
            onChange={() => setKind('income')}
            className={KIND_BUTTON_CLASSES}
          />
        </div>
      </fieldset>
      <TextField
        id="transaction-amount-input"
        label="Amount"
        type="text"
        name="amount"
        inputMode="decimal"
        autoComplete="off"
        value={amount}
        onChange={setAmount}
        ref={amountInput}
      />
      <TextField
        id="transaction-date-input"
        label="Date"
        type="date"
        name="date"
        autoComplete="off"
        max={today}
        value={date}
        onChange={setDate}
      />
      <TextField
        id="transaction-note-input"
        label="Note (optional)"
        type="text"
        name="note"
        autoComplete="off"
        value={note}
        onChange={setNote}
      />
      <ErrorList id="transaction-error" messages={errors} />
      <button
        id="transaction-submit"
        type="submit"
        disabled={isSubmitting}
        className="btn btn-primary btn-lg w-full"
      >
        {isSubmitting ? 'Saving…' : 'Save'}
      </button>
    </form>
  );
}
