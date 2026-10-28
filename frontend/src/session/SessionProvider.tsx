import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useServices } from '../services/ServiceContext';
import type { Session, SessionContextValue } from './session.types';

const SessionContext = createContext<SessionContextValue | null>(null);

/**
 * Asks `GET /api/v1/me` once when the app loads and renders nothing until it has an answer, so a signed-out Visitor
 * never sees a flash of Home (artifacts/F-1/02-flow.md → Routing & session bootstrap).
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const { authService } = useServices();
  // `null` = the first answer has not come yet.
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let isCurrent = true;
    authService.getCurrentUser().then(
      (user) => {
        if (isCurrent) setSession(user ? { status: 'signed-in', user } : { status: 'signed-out' });
      },
      () => {
        // The answer cannot be had (backend down): show Sign In rather than a blank page — signing in says what is wrong.
        if (isCurrent) setSession({ status: 'signed-out' });
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [authService]);

  if (session === null) return null;

  const value: SessionContextValue = {
    session,
    signedIn: (user) => setSession({ status: 'signed-in', user }),
    signedOut: () => setSession({ status: 'signed-out' }),
  };
  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (value === null) {
    throw new Error('useSession must be used inside a <SessionProvider>');
  }
  return value;
}
