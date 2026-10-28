import type { NextFunction, Request, RequestHandler, Response } from 'express';

const ONE_YEAR_SECONDS = 31_536_000;

/**
 * Response headers for an API whose every answer is private to the signed-in User and is never meant to be
 * rendered: no caching, no content sniffing, no framing, no referrer, nothing loadable from it. HSTS only when
 * the API is served over https (browsers ignore it on plain http anyway).
 */
export function securityHeaders(options: { hsts: boolean }): RequestHandler {
  return (_req: Request, res: Response, next: NextFunction): void => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    if (options.hsts) {
      res.setHeader('Strict-Transport-Security', `max-age=${ONE_YEAR_SECONDS}; includeSubDomains`);
    }
    next();
  };
}

/**
 * Accepts only JSON bodies (415 otherwise). The Web App only ever sends JSON, and refusing form and text/plain
 * bodies closes the cross-site "login CSRF" route: an HTML form on another site can post
 * `application/x-www-form-urlencoded` (or `text/plain`) without a CORS preflight, but cannot send JSON.
 * Requests without a body are untouched. Register it before the body parsers.
 */
export function requireJsonBody(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (hasBody(req) && !req.is('application/json')) {
      res.status(415).json({
        statusCode: 415,
        message: 'Content-Type must be application/json',
        error: 'Unsupported Media Type',
      });
      return;
    }
    next();
  };
}

function hasBody(req: Request): boolean {
  return (
    req.headers['transfer-encoding'] !== undefined || Number(req.headers['content-length'] ?? 0) > 0
  );
}
