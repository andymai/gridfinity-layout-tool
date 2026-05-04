import type { VercelRequest, VercelResponse } from '@vercel/node';
import { methodNotAllowed } from './shared.js';

/**
 * Validate that `req.method` is one of `allowed`.
 *
 * Returns true if allowed (caller proceeds). Returns false after sending an
 * appropriate response:
 *   - OPTIONS preflight → 200 with Allow header
 *   - any other disallowed method → 405 via methodNotAllowed()
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
