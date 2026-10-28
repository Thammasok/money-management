---
name: frontend-stack-and-design
description: Concrete frontend stack facts from F-1 (versions, test setup, design-token file, daisyUI pitfalls, a stale-dev-server trap) that later features must follow
metadata:
  type: project
---

**Stack (pinned 2026-10-28/29, newer majors than most docs):** React 19.3, Vite 8 (`@vitejs/plugin-react` 6), Vitest 5 + jsdom 30, React Router 8 — import everything from `react-router` (declarative mode: `BrowserRouter`, `Routes`, `Navigate`, `Outlet`, `Link`, `MemoryRouter`), TypeScript 6, ESLint 10 flat config + `eslint-plugin-react-hooks` 7, Tailwind 4 + daisyUI 5. npm 12 blocks install scripts (`fsevents`) — harmless.

**Tests:** Vitest without globals → `src/test-setup.ts` calls `cleanup()` itself and sets `configure({ testIdAttribute: 'id' })` so `getByTestId('sign-in-email')` ⇒ `#sign-in-email`. Reuse `src/test-utils.tsx` (`createMockServices`, `renderWithProviders`, `deferred`). Specs are co-located `*.spec.ts(x)`; containers are tested by rendering `<App />` at a route with only `AuthService` mocked.

**Design tokens live in ONE file, `frontend/src/styles/theme.css`** (primitive `@theme static` → semantic daisyUI themes `ledger` / `ledger-night` → component radii/size/border). Direction "household ledger" (paper + ink + bookkeeping green, Newsreader over Source Sans 3, double rule under `h1`). Later features: use semantic classes only (`bg-base-100`, `btn-primary`, `alert-error`), add tokens there, don't invent a second palette. Fonts are self-hosted `@fontsource-variable/*` (no runtime third-party font request — keeps E2E offline-safe).

**daisyUI 5 pitfalls hit:** (1) page background must be set through `:root { --root-bg: var(--color-base-200) }`, not `body` (daisyUI paints `:root`; a body background only covers the body box). (2) default `.input` border is 20% content ≈ 1.4:1 — use `border-base-content/60` (≥3:1). (3) `.alert` is a column grid — several message lines need `alert-vertical justify-items-start text-start gap-2`. (4) `.input` default font is 14 px (iOS zoom) — use `input-lg`. (5) layout utilities (`@layer utilities`) beat daisyUI's nested sub-layers, so plain Tailwind utilities override component defaults without `!`.

**React gotchas:** a ref callback that focuses its element must be a stable module-level function (`focus-on-mount.ts`) — an inline arrow is re-run on every render and steals focus from the field being typed in. `fetch` must be wrapped, never stored bare (`this.fetchFn()` ⇒ "Illegal invocation").

**Dev-server trap:** a Vite dev server started from the agent sandbox receives NO file-change events — edits to TSX/CSS are silently not served. After editing, restart it (TaskStop + start again) before any screenshot. Playwright's own `webServer` starts fresh each run, so E2E is unaffected.

**Visual review recipe (no usable MCP browser, see [[e2e-mock-mode-sandbox]]):** start the dev server proxied at the impostor, drop a throwaway spec in `e2e/_scratch/` that screenshots every state (light/dark via `page.emulateMedia({ colorScheme })`, phone 390×780 + desktop), run `bash .claude/scripts/run-e2e.sh _scratch list`, Read the PNGs, then delete the spec and `rmdir` the folder (`rm -r` is denied; plain `rm file` and `rmdir` work). Contrast pairs were verified with a throwaway Node WCAG script, not by eye.
