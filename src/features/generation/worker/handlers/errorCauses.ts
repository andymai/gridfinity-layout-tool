/**
 * Only an error's message survives `postMessage`, so the chain behind an export
 * failure is flattened here, in the worker, while it still exists. The deepest
 * link is usually the kernel's own exception, which is what tells a disposed
 * handle, an empty shape and a real geometry fault apart when the export error
 * itself reads the same for all three.
 */

const MAX_DEPTH = 6;
const MAX_MESSAGE_LENGTH = 300;

function messageOf(value: unknown): string | null {
  if (value instanceof Error) return value.message;
  if (typeof value === 'object' && value !== null && 'message' in value) {
    return typeof value.message === 'string' ? value.message : null;
  }
  return typeof value === 'string' ? value : null;
}

/** Messages of `e`'s causes, outermost first, plus any mesh-writer fallback that also failed. */
export function describeErrorCauses(e: unknown): string[] {
  const out: string[] = [];
  const seen = new Set<unknown>();
  let current: unknown = e;
  for (
    let depth = 0;
    depth < MAX_DEPTH && current !== null && typeof current === 'object';
    depth++
  ) {
    if (seen.has(current)) break;
    seen.add(current);
    const fallback = messageOf((current as { meshFallbackCause?: unknown }).meshFallbackCause);
    if (fallback) out.push(`mesh fallback: ${fallback}`);
    current = (current as { cause?: unknown }).cause;
    const message = messageOf(current);
    if (message) out.push(message);
  }
  return out.map((m) => m.slice(0, MAX_MESSAGE_LENGTH));
}
