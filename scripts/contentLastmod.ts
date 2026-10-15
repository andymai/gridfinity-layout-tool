const LASTMOD_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface PageLastmod {
  own: string | undefined;
  sitemap: string;
  invalid: boolean;
}

function isLastmodDate(value: unknown): value is string {
  if (typeof value !== 'string' || !LASTMOD_RE.test(value)) return false;
  // Date rolls an impossible day like 2026-02-30 over into March instead of
  // rejecting it, so only a round trip back to the same string proves it real.
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function resolvePageLastmod(value: unknown, fallback: string): PageLastmod {
  if (isLastmodDate(value)) return { own: value, sitemap: value, invalid: false };
  return { own: undefined, sitemap: fallback, invalid: value !== undefined };
}
