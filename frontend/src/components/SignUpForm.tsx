import { useState } from 'react';
import { PASSWORD_RULE_TEXT } from '../services/auth/auth-messages';
import type { SignUpFormProps } from './component-props';
import { ErrorAlert } from './ErrorAlert';
import { TextField } from './TextField';

const PASSWORD_RULE_HINT = { id: 'sign-up-password-rule', text: PASSWORD_RULE_TEXT };

/** Humble: renders what it is given and reports what the person typed. No rules live here — the backend decides. */
export function SignUpForm({ onSubmit, isSubmitting, errors }: SignUpFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <form
      id="sign-up-form"
      noValidate
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(email, password);
      }}
    >
      <TextField
        id="sign-up-email"
        label="Email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={setEmail}
      />
      <TextField
        id="sign-up-password"
        label="Password"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={setPassword}
        hint={PASSWORD_RULE_HINT}
      />
      {errors.length > 0 ? (
        <ErrorAlert
          id="sign-up-error"
          className="alert-vertical justify-items-start gap-2 text-start"
        >
          {errors.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </ErrorAlert>
      ) : null}
      <button
        id="sign-up-submit"
        type="submit"
        disabled={isSubmitting}
        className="btn btn-primary btn-lg w-full"
      >
        {isSubmitting ? 'Signing up…' : 'Sign up'}
      </button>
    </form>
  );
}
