import type { ReactNode } from 'react';

// Props of the humble components (artifacts/F-1/02-flow.md → UI Component Inventory). Each component renders what it
// is given and reports what the person did; the containers in `pages/` own the service calls and the state.

export interface ErrorAlertProps {
  /** The alert's `id` (the Playwright contract). */
  id: string;
  /** Extra layout classes for the alert (the default lays one line of text out). */
  className?: string;
  children: ReactNode;
}

export interface PageHeadingProps {
  /** The screen's title: the heading text and, behind the app name, the document title. */
  children: string;
}

export interface TextFieldProps {
  /** The input's `id` (the Playwright contract); the label points at it. */
  id: string;
  label: string;
  type: 'email' | 'password';
  /** The browser's autofill hint: `email`, `new-password`, `current-password`. */
  autoComplete: string;
  value: string;
  /** Called with the new text on every keystroke. */
  onChange(value: string): void;
  /** Persistent help text under the input, read together with it (e.g. the password rule). */
  hint?: { id: string; text: string };
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
