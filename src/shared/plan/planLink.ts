import { deflateSync, strToU8 } from 'fflate';
import { err, ok } from '@/core/result';
import type { Result } from '@/core/result';
import { planInput } from './planInput';
import type { PlanInput } from './planInput';

export const PLAN_LINK_VERSION = 1;
/** Longest encoded plan, so a link stays far below what browsers and chat apps cut. */
export const PLAN_LINK_MAX_CHARS = 6144;
export const PLAN_HASH_PREFIX = '#plan=';

export type PlanLinkError =
  | { readonly kind: 'malformed' }
  | { readonly kind: 'newer-version'; readonly version: number }
  | { readonly kind: 'invalid'; readonly issues: readonly string[] };

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

/** `v1.` plus the deflated JSON of the plan input, base64url. */
export function encodePlanLink(input: PlanInput): string {
  return `v${PLAN_LINK_VERSION}.${toBase64Url(deflateSync(strToU8(JSON.stringify(input))))}`;
}

export function planLinkUrl(origin: string, input: PlanInput): string {
  return `${origin}/${PLAN_HASH_PREFIX}${encodePlanLink(input)}`;
}

// The largest valid plan, 60 bins with full labels and item lists, inflates to
// about 70 KB. A link is input from anyone, so inflating stops past this cap
// rather than let a small crafted link expand without limit.
const MAX_INFLATED_BYTES = 256 * 1024;

// The browser's own inflate, not fflate's: fflate sits in the startup bundle for
// its zip export, and any fflate function used anywhere stays in that file.
async function inflateRaw(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const body = new Response(bytes).body;
  if (body === null) throw new Error('No data');
  const reader = body.pipeThrough(new DecompressionStream('deflate-raw')).getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_INFLATED_BYTES) {
      await reader.cancel();
      throw new Error('The plan is too large');
    }
    chunks.push(value);
  }
  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(joined);
}

export async function decodePlanLink(value: string): Promise<Result<PlanInput, PlanLinkError>> {
  if (value.length > PLAN_LINK_MAX_CHARS) return err({ kind: 'malformed' });
  const match = /^v(\d+)\.([A-Za-z0-9_-]+)$/.exec(value);
  if (match === null) return err({ kind: 'malformed' });
  const version = Number(match[1]);
  if (version > PLAN_LINK_VERSION) return err({ kind: 'newer-version', version });
  let json: unknown;
  try {
    json = JSON.parse(await inflateRaw(fromBase64Url(match[2])));
  } catch {
    return err({ kind: 'malformed' });
  }
  const parsed = planInput.safeParse(json);
  if (!parsed.success) {
    return err({ kind: 'invalid', issues: parsed.error.issues.map((issue) => issue.message) });
  }
  return ok(parsed.data);
}
