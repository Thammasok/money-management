import type { ReactNode, Ref } from 'react';
import type {
  Currency,
  Transaction,
  TypedTransaction,
  TypedWallet,
  WalletSummary,
} from '../services/wallets/wallet.types';

// Props of the humble components (artifacts/F-1/02-flow.md and artifacts/F-2/02-flow.md → UI Component Inventory).
// Each component renders what it is given and reports what the person did; the containers in `pages/` own the
// service calls and the state.

export interface ErrorAlertProps {
  /** The alert's `id` (the Playwright contract). */
  id: string;
  /** Extra layout classes for the alert (the default lays one line of text out). */
  className?: string;
  children: ReactNode;
}

export interface ErrorListProps {
  /** The alert's `id` (the Playwright contract). */
  id: string;
  /** One line per message; no alert is rendered when there are none. */
  messages: string[];
}

export interface PageHeadingProps {
  /** The screen's title: the heading text and, behind the app name, the document title. */
  children: string;
  /** The heading's `id`, for a screen whose title is also part of the Playwright contract. */
  id?: string;
}

export interface TextFieldProps {
  /** The input's `id` (the Playwright contract); the label points at it. */
  id: string;
  label: string;
  type: 'email' | 'password' | 'text' | 'date';
  /** The browser's autofill hint: `email`, `new-password`, `current-password`, or `off`. */
  autoComplete: string;
  value: string;
  /** Called with the new text on every keystroke. */
  onChange(value: string): void;
  /** Persistent help text under the input, read together with it (e.g. the password rule). */
  hint?: { id: string; text: string };
  /** The input's `name`; defaults to its `type`. */
  name?: string;
  /** The soft keyboard to offer for a number typed as text (an amount of money). */
  inputMode?: 'decimal';
  /** A date field's latest allowed value, `YYYY-MM-DD`. */
  max?: string;
  /** Lets the owner move focus into the input (React 19 passes `ref` as an ordinary prop). */
  ref?: Ref<HTMLInputElement>;
}

export interface SignUpFormProps {
  /** Called with what the person typed when they press Sign up. */
  onSubmit(email: string, password: string): void;
  /** True while the request is in flight: the submit button is disabled. */
  isSubmitting: boolean;
  /** One line per message the backend sent; the alert is rendered only when there is at least one. */
  errors: string[];
}

export interface SignInFormProps {
  /** Called with what the person typed when they press Sign in. */
  onSubmit(email: string, password: string): void;
  /** True while the request is in flight: the submit button is disabled. */
  isSubmitting: boolean;
  /** The one sentence to show, or `null` for none; the alert is rendered only when there is one. */
  error: string | null;
}

export interface HomeViewProps {
  /** The signed-in User's email. */
  email: string;
  /** Called when the person presses Sign out. */
  onSignOut(): void;
  /** True while signing out is in flight: the button is disabled. */
  isSigningOut: boolean;
  /** Shown when signing out failed (so a failure is never silent on a shared device), or `null`. */
  error: string | null;
}

export interface WalletListProps {
  /** The User's Wallets, newest first; `null` until they have loaded. */
  wallets: WalletSummary[] | null;
  /** The sentence to show when they could not be loaded, or `null`; the alert is rendered only when there is one. */
  error: string | null;
}

export interface CreateWalletFormProps {
  /** Every Currency a Wallet may hold, for the picker; empty until loaded. */
  currencies: Currency[];
  /** The Currency code chosen to begin with (that of the last-created Wallet, Q-11), or `''` for none. */
  defaultCurrency: string;
  /** False until the Currencies and Wallets have loaded: the form cannot be submitted before then. */
  isReady: boolean;
  /** True while the request is in flight: the submit button is disabled. */
  isSubmitting: boolean;
  /** One line per message to show (the Web App's own check or every message the backend sent); the alert is rendered only when there is at least one. */
  errors: string[];
  /** Called with what the person typed when they press Create wallet. */
  onSubmit(typed: TypedWallet): void;
}

export interface TransactionFormProps {
  /** The browser's local date, `YYYY-MM-DD`: where the date field starts and the latest date it offers. */
  today: string;
  /** True while the request is in flight: the submit button is disabled. */
  isSubmitting: boolean;
  /** One line per message to show; the alert is rendered only when there is at least one. */
  errors: string[];
  /**
   * Called with what the person entered when they press Save. Resolves `true` once the Transaction is saved, so the
   * form can clear the amount and note (keeping Kind and date) and be ready for the next one; `false` keeps what was typed.
   */
  onSubmit(typed: TypedTransaction): Promise<boolean>;
}

export interface TransactionListProps {
  /** A Wallet's Transactions, already newest first. */
  transactions: Transaction[];
  /** The Wallet's Currency code and its minor digits, to show each amount in that Currency. */
  currency: string;
  minorDigits: number;
}

export interface WalletBalanceProps {
  /** The Wallet's Currency code. */
  currency: string;
  /** The Balance in minor units of `currency` (a decimal-integer string, possibly negative). */
  balanceMinor: string;
  minorDigits: number;
}
