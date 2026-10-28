import { useEffect } from 'react';
import type { PageHeadingProps } from './component-props';
import { focusOnMount } from './focus-on-mount';

const APP_NAME = 'Money Management';

/**
 * Humble: a screen's title. A single-page app changes screens without a page load, so on arrival this takes focus (the
 * screen is announced and Tab starts inside it) and names the document, which the browser tab and history show.
 */
export function PageHeading({ children }: PageHeadingProps) {
  useEffect(() => {
    document.title = `${children} · ${APP_NAME}`;
  }, [children]);

  return (
    <h1 tabIndex={-1} ref={focusOnMount}>
      {children}
    </h1>
  );
}
