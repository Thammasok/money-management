import { useState } from 'react';
import { HomeView } from '../components/HomeView';
import { PageHeading } from '../components/PageHeading';
import { GENERIC_FAILURE_TEXT } from '../services/auth/auth-messages';
import { useServices } from '../services/ServiceContext';
import { useSession } from '../session/SessionProvider';

/**
 * Container: shows the signed-in User and wires Sign out to `AuthService.signOut`. When signing out works the Session
 * becomes signed-out and the route guard sends the person to Sign In; when it fails the failure is shown, never swallowed.
 */
export function HomePage() {
  const { authService } = useServices();
  const { session, signedOut } = useSession();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignOut() {
    setIsSigningOut(true);
    setError(null);
    try {
      await authService.signOut();
      signedOut();
    } catch {
      setError(GENERIC_FAILURE_TEXT);
    } finally {
      setIsSigningOut(false);
    }
  }

  // Home sits behind RequireSignedIn; this only narrows the type for the signed-in case.
  if (session.status !== 'signed-in') return null;

  return (
    <main id="home-page">
      <PageHeading>Home</PageHeading>
      <HomeView
        email={session.user.email}
        onSignOut={handleSignOut}
        isSigningOut={isSigningOut}
        error={error}
      />
    </main>
  );
}
