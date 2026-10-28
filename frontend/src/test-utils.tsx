import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router';
import { vi, type Mocked } from 'vitest';
import type { IAuthService } from './services/auth/auth.types';
import { ServiceProvider } from './services/ServiceContext';
import type { Services } from './services/services';
import { SessionProvider } from './session/SessionProvider';

export interface MockServices extends Services {
  authService: Mocked<IAuthService>;
}

/** Mock services for a test: nobody is signed in and signing out works, until the test says otherwise. */
export function createMockServices(): MockServices {
  return {
    authService: {
      getCurrentUser: vi.fn<IAuthService['getCurrentUser']>().mockResolvedValue(null),
      signUp: vi.fn<IAuthService['signUp']>(),
      signIn: vi.fn<IAuthService['signIn']>(),
      signOut: vi.fn<IAuthService['signOut']>().mockResolvedValue(undefined),
    },
  };
}

export interface RenderOptions {
  services?: MockServices;
  /** Where the memory router starts; defaults to Home. */
  route?: string;
}

/** Renders `ui` the way `main.tsx` mounts the app: services → session → router. */
export function renderWithProviders(
  ui: ReactElement,
  { services = createMockServices(), route = '/' }: RenderOptions = {},
): RenderResult & { services: MockServices } {
  const result = render(
    <ServiceProvider services={services}>
      <SessionProvider>
        <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
      </SessionProvider>
    </ServiceProvider>,
  );
  return { ...result, services };
}

/** A promise a test settles by hand — to look at the screen while a request is still in flight. */
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}
