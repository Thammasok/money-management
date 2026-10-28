import { useState } from 'react';
import type { CreateWalletFormProps } from './component-props';
import { ErrorList } from './ErrorList';
import { TextField } from './TextField';

const OPENING_BALANCE_HINT = {
  id: 'wallet-opening-balance-hint',
  text: 'What the Wallet holds today. It is not Income.',
};
const CURRENCY_HINT_ID = 'wallet-currency-hint';

/**
 * Humble: renders what it is given and reports what the person typed. No rules live here — the container decides
 * what is sent and the backend decides what is allowed.
 */
export function CreateWalletForm({
  currencies,
  defaultCurrency,
  isReady,
  isSubmitting,
  errors,
  onSubmit,
}: CreateWalletFormProps) {
  const [name, setName] = useState('');
  // `null` until the person chooses: the default (known only once the Wallets have loaded) shows until then, and
  // never replaces a choice they made while the page was still loading.
  const [chosenCurrency, setChosenCurrency] = useState<string | null>(null);
  const [openingBalance, setOpeningBalance] = useState('0');
  const currency = chosenCurrency ?? defaultCurrency;

  return (
    <form
      id="create-wallet-form"
      noValidate
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ name, currency, openingBalance });
      }}
    >
      <TextField
        id="wallet-name-input"
        label="Name"
        type="text"
        name="name"
        autoComplete="off"
        value={name}
        onChange={setName}
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="wallet-currency-select" className="text-sm font-semibold">
          Currency
        </label>
        <select
          id="wallet-currency-select"
          name="currency"
          aria-describedby={CURRENCY_HINT_ID}
          value={currency}
          onChange={(event) => setChosenCurrency(event.target.value)}
          className="select select-lg w-full border-base-content/60"
        >
          <option value="">Choose a currency</option>
          {currencies.map((candidate) => (
            <option key={candidate.code} value={candidate.code}>
              {candidate.code} — {candidate.name}
            </option>
          ))}
        </select>
        <p id={CURRENCY_HINT_ID} className="text-sm text-base-content/70">
          Cannot be changed once the Wallet is created.
        </p>
      </div>
      <TextField
        id="wallet-opening-balance-input"
        label="Opening Balance"
        type="text"
        name="openingBalance"
        inputMode="decimal"
        autoComplete="off"
        value={openingBalance}
        onChange={setOpeningBalance}
        hint={OPENING_BALANCE_HINT}
      />
      <ErrorList id="create-wallet-error" messages={errors} />
      <button
        id="create-wallet-submit"
        type="submit"
        disabled={!isReady || isSubmitting}
        className="btn btn-primary btn-lg w-full"
      >
        {isSubmitting ? 'Creating…' : 'Create wallet'}
      </button>
    </form>
  );
}
