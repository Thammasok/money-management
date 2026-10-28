import type { HomeViewProps } from './component-props';
import { ErrorAlert } from './ErrorAlert';

/** Humble: shows who is signed in and reports that they want to sign out. */
export function HomeView({ email, onSignOut, isSigningOut, error }: HomeViewProps) {
  return (
    <>
      <p className="text-lg">
        Signed in as{' '}
        <span id="signed-in-email" className="font-semibold wrap-anywhere">
          {email}
        </span>
      </p>
      <button
        id="sign-out-button"
        type="button"
        disabled={isSigningOut}
        onClick={() => onSignOut()}
        className="btn btn-outline btn-lg w-full"
      >
        {isSigningOut ? 'Signing out…' : 'Sign out'}
      </button>
      {error !== null ? <ErrorAlert id="sign-out-error">{error}</ErrorAlert> : null}
    </>
  );
}
