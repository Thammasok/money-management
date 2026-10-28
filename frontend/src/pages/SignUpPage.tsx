import { useState } from 'react';
import { Link } from 'react-router';
import { PageHeading } from '../components/PageHeading';
import { SignUpForm } from '../components/SignUpForm';
import { describeSignUpFailure } from '../services/auth/auth-messages';
import { useServices } from '../services/ServiceContext';
import { useSession } from '../session/SessionProvider';

/**
 * Container: wires the Sign Up form to `AuthService.signUp` and reports success to the Session — the route guard then
 * sends the new, signed-in User Home.
 */
export function SignUpPage() {
  const { authService } = useServices();
  const { signedIn } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  async function handleSubmit(email: string, password: string) {
    setIsSubmitting(true);
    setErrors([]);
    try {
      signedIn(await authService.signUp(email, password));
    } catch (error) {
      setErrors(describeSignUpFailure(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main id="sign-up-page">
      <PageHeading>Sign up</PageHeading>
      <SignUpForm onSubmit={handleSubmit} isSubmitting={isSubmitting} errors={errors} />
      <p className="text-center">
        Already registered?{' '}
        <Link
          id="go-to-sign-in-link"
          to="/sign-in"
          className="link link-primary inline-block py-2.5 font-semibold"
        >
          Sign in
        </Link>
      </p>
    </main>
  );
}
