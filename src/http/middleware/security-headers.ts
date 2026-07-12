import type { MiddlewareHandler } from 'hono';

export const securityHeaders: MiddlewareHandler = async (c, next) => {
  await next();

  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  // Explicitly disable the legacy XSS auditor — modern browsers ignore it and
  // some versions introduced vulnerabilities when it was enabled.
  c.header('X-XSS-Protection', '0');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  const host = c.req.header('host') ?? '';
  if (!host.includes('localhost') && !host.includes('127.0.0.1')) {
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  c.res.headers.delete('X-Powered-By');
};
