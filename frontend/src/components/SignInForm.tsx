import { useState } from 'react';
import type { SignInFormProps } from './component-props';
import { ErrorAlert } from './ErrorAlert';
import { TextField } from './TextField';

/** Humble: renders what it is given and reports what the person typed. No rules live here — the backend decides. */
export function SignInForm({ onSubmit, isSubmitting, error }: SignInFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <form
      id="sign-in-form"
      noValidate
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(email, password);
      }}
    >
      <TextField
        id="sign-in-email"
        label="Email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={setEmail}
      />
      <TextField
        id="sign-in-password"
        label="Password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={setPassword}
      />
      {error !== null ? <ErrorAlert id="sign-in-error">{error}</ErrorAlert> : null}
      <button
        id="sign-in-submit"
        type="submit"
        disabled={isSubmitting}
        className="btn btn-primary btn-lg w-full"
      >
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
