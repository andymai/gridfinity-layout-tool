import { createHash } from 'node:crypto';

/**
 * Derive a stable, pseudonymous public author id from a sync userId.
 *
 * PRIVACY: the userId never appears in public records, only this hash, so an
 * author page URL or a design blob can't be joined back to a sync account.
 *
 * Same discipline as `deriveDonorId` in `supporters.ts`: the salt is
 * load-bearing, not decoration: an unsalted SHA-256 of a userId would let
 * anyone holding a userId confirm which community designs it published.
 * Without TOKEN_SALT configured we refuse to derive an id at all (callers
 * must reject the publish) rather than write a reversible digest. The
 * `:community:` tag namespaces the hash input so the same salt used for other
 * feature ids can't collide with this one on identical raw input.
 */
export function deriveAuthorPublicId(userId: string): string | null {
  const salt = process.env.TOKEN_SALT;
  if (!salt) return null;
  return createHash('sha256').update(`${salt}:community:${userId}`).digest('hex').slice(0, 32);
}

const DESIGN_ID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
export const COMMUNITY_DESIGN_ID_LENGTH = 12;

/**
 * Random 12-char alphanumeric design id, matching the legacy 12-char branch of
 * `isValidShareId` so the existing id validation accepts community ids
 * unchanged. Rejection sampling (62 does not divide 256) keeps the
 * distribution uniform.
 */
export function generateCommunityDesignId(): string {
  const limit = DESIGN_ID_ALPHABET.length * Math.floor(256 / DESIGN_ID_ALPHABET.length);
  let out = '';
  while (out.length < COMMUNITY_DESIGN_ID_LENGTH) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    for (const byte of bytes) {
      if (byte >= limit) continue;
      out += DESIGN_ID_ALPHABET[byte % DESIGN_ID_ALPHABET.length];
      if (out.length === COMMUNITY_DESIGN_ID_LENGTH) break;
    }
  }
  return out;
}
