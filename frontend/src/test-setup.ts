import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

// Every component carries the Playwright ID from artifacts/F-1/02-flow.md, so component tests find elements by
// `id` exactly as the E2E suite does (`screen.getByTestId('sign-up-email')` ⇒ `#sign-up-email`).
configure({ testIdAttribute: 'id' });

// Vitest runs without globals, so Testing Library's automatic cleanup is not registered — do it here.
afterEach(() => {
  cleanup();
});
