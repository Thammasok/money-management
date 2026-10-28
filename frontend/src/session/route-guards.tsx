import { Navigate, Outlet } from 'react-router';
import { useSession } from './SessionProvider';

/** Home and every screen after it: only for a signed-in User — anyone else is sent to Sign In. */
export function RequireSignedIn() {
  const { session } = useSession();
  return session.status === 'signed-in' ? <Outlet /> : <Navigate to="/sign-in" replace />;
}

/** Sign Up and Sign In: only for a Visitor — a signed-in User is sent Home. */
export function RequireSignedOut() {
  const { session } = useSession();
  return session.status === 'signed-out' ? <Outlet /> : <Navigate to="/" replace />;
}
