import type { JSX } from 'react';
import { Analytics } from '@vercel/analytics/react';

// Vercel's edge serves the analytics script; on any other host it 404s on every
// page load. A literal branch, not a shared helper, so a self-hosted build folds
// it away and the chunk is not emitted.
export function VercelAnalytics(): JSX.Element | null {
  if ((import.meta.env.VITE_SELF_HOSTED as string | undefined) === '1') return null;
  return <Analytics />;
}
