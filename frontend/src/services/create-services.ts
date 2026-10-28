import { HttpAuthService } from './auth/http-auth-service';
import type { Services } from './services';

/**
 * The production services. `fetch` is wrapped rather than handed over bare: a browser's `fetch` called as a method
 * of another object (`this.fetchFn(...)` inside a service) throws "Illegal invocation".
 */
export function createServices(): Services {
  const fetchFn: typeof fetch = (input, init) => fetch(input, init);
  return { authService: new HttpAuthService(fetchFn) };
}
