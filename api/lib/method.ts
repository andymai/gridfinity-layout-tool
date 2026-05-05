import type { VercelRequest, VercelResponse } from '@vercel/node';
import { methodNotAllowed } from './shared.js';

/**
 * Validate that `req.method` is one of `allowed`.
 *
 * Returns true if allowed (caller proceeds). Returns false after sending an
 * appropriate response:
 *   - OPTIONS → 200 with `Allow` header (HTTP method enumeration)
 *   - any other disallowed method → 405 via methodNotAllowed()
 *
 * Scope: this helper only handles HTTP method validation. The `Allow` header
 * is the correct response for an OPTIONS request when CORS is *not* in play
 * (same-origin Vercel deployment, which is our case). If a future endpoint
 * needs cross-origin browser access, the caller is responsible for setting
 * `Access-Control-Allow-Origin` / `-Methods` / `-Headers` separately —
 * deliberately keeping CORS policy out of this helper so it stays composable.
 *
 * Usage:
 *   if (!requireMethod(req, res, ['GET', 'POST'])) return;
 */
export function requireMethod(
  req: VercelRequest,
  res: VercelResponse,
  allowed: readonly string[]
): boolean {
  if (req.method && allowed.includes(req.method)) return true;
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', allowed.join(', '));
    res.status(200).end();
    return false;
  }
  methodNotAllowed(res, allowed.join(', '));
  return false;
}
