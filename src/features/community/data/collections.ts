/**
 * Editorial collections: hand-picked groups of designs, curated by PR.
 *
 * Human taste is the honest alternative to an engagement algorithm, and unlike
 * an algorithm it does not pretend to be objective. Keeping the list in the
 * repo means curation is reviewable, diffable and revertible, and needs no
 * admin UI or storage.
 *
 * ## Adding a collection
 *
 * 1. Add an entry below with a stable `id`, the i18n keys for its title and
 *    blurb, and the design ids in the order you want them shown.
 * 2. Add those two keys to `src/i18n/locales/en.ts` and every locale JSON
 *    (see the i18n-changes skill). Editorial copy is user-facing, so it is
 *    translated like everything else.
 * 3. Open a PR. That PR *is* the curation record.
 *
 * A collection whose designs have since been removed or hidden simply shrinks;
 * one with nothing left to show disappears. Curating never has to be undone
 * because a design went away.
 *
 * The list is deliberately empty: the mechanism ships here, the picks are a
 * separate content decision.
 */

export interface CommunityCollection {
  /**
   * Stable slug, lowercase with hyphens. Becomes a React key and part of the
   * shelf's DOM id, so it must be unique across the list; `collections.test.ts`
   * enforces both.
   */
  readonly id: string;
  /** i18n key for the shelf heading. */
  readonly titleKey: string;
  /** i18n key for the one-line reason this grouping exists. */
  readonly blurbKey: string;
  /** Design ids, in the order they should appear. */
  readonly designIds: readonly string[];
}

export const COMMUNITY_COLLECTIONS: readonly CommunityCollection[] = [];
