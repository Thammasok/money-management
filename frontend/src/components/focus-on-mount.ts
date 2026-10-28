/**
 * A ref callback that focuses its element once, when it mounts. Keep it a module-level function: React runs a ref
 * callback again whenever its identity changes, so a fresh inline arrow per render would pull focus back on every
 * re-render — even from the field the person is typing in.
 */
export function focusOnMount(element: HTMLElement | null): void {
  element?.focus();
}
