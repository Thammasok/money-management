import { useState } from 'react';
import { Link } from 'react-router';
import { PageHeading } from '../components/PageHeading';
import { SignInForm } from '../components/SignInForm';
import { describeSignInFailure } from '../services/auth/auth-messages';
import { useServices } from '../services/ServiceContext';
import { useSession } from '../session/SessionProvider';

/**
 * Container: wires the Sign In form to `AuthService.signIn` and reports success to the Session — the route guard then
 * sends the signed-in User Home.
 */
export function SignInPage() {
  const { authService } = useServices();
  const { signedIn } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(email: string, password: string) {
    setIsSubmitting(true);
    setError(null);
    try {
      signedIn(await authService.signIn(email, password));
    } catch (failure) {
      setError(describeSignInFailure(failure));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main id="sign-in-page">
      <PageHeading>Sign in</PageHeading>
      <SignInForm onSubmit={handleSubmit} isSubmitting={isSubmitting} error={error} />
      <p className="text-center">
        New here?{' '}
        <Link
          id="go-to-sign-up-link"
          to="/sign-up"
          className="link link-primary inline-block py-2.5 font-semibold"
        >
          Sign up
        </Link>
      </p>
    </main>
  );
}
