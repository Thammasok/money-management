import { Inject, Injectable } from '@nestjs/common';
import type { CookieOptions, Response } from 'express';
import { APP_CONFIG } from '../config/app-config';
import type { AppConfig } from '../config/app-config';
import { SESSION_COOKIE_NAME, SESSION_LIFETIME_DAYS } from './identity.constants';

const DAY_MS = 24 * 60 * 60 * 1000;

/** A response header's value as a list of strings (Node returns a string, a list or nothing). */
function asList(header: number | string | string[] | undefined): string[] {
  if (header === undefined) {
    return [];
  }
  return Array.isArray(header) ? header : [String(header)];
}

/** Sets and clears the Session cookie — the only place that knows its attributes. */
@Injectable()
export class SessionCookie {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  /** (Re-)sends the Session id, lasting 30 days from now. */
  set(res: Response, sessionId: string): void {
    res.cookie(SESSION_COOKIE_NAME, sessionId, {
      ...this.attributes(),
      maxAge: SESSION_LIFETIME_DAYS * DAY_MS,
    });
  }

  /** Expires the cookie at once (`Max-Age=0`), replacing any sid cookie already queued for this response. */
  clear(res: Response): void {
    // The guard re-sends the cookie on every protected request, sign-out included; keeping that one beside the
    // expired one would send the browser two contradicting instructions.
    const otherCookies = asList(res.getHeader('Set-Cookie')).filter(
      (cookie) => !cookie.startsWith(`${SESSION_COOKIE_NAME}=`),
    );
    res.setHeader('Set-Cookie', otherCookies);
    res.cookie(SESSION_COOKIE_NAME, '', { ...this.attributes(), maxAge: 0 });
  }

  private attributes(): CookieOptions {
    return { httpOnly: true, sameSite: 'lax', secure: this.config.cookieSecure, path: '/' };
  }
}
