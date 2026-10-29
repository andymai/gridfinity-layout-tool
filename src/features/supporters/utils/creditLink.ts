const PARAM = 'credit';
/** Longer than any stored name (32), so a hand-edited link can't drag in an essay. */
const MAX_LENGTH = 64;

/**
 * Names stored before the server stopped cutting emoji in half can end in a
 * lone surrogate, which `encodeURIComponent` throws on. Links carry this
 * repaired form, and the lookup compares it on both sides.
 */
export function wellFormed(text: string): string {
  return text.replace(
    /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,
    '\uFFFD'
  );
}

/** A link that opens the credits on `name`. Names are the only handle the public list carries. */
export function creditLinkFor(name: string, origin: string): string {
  return `${origin}/supporters?${PARAM}=${encodeURIComponent(wellFormed(name))}`;
}

/** The supporter a link names: exact, ignoring case, never a partial match. */
export function isCreditFor(linked: string, name: string): boolean {
  return wellFormed(name).toLowerCase() === linked.toLowerCase();
}

export function creditFromSearch(search: string): string | null {
  const name = new URLSearchParams(search).get(PARAM)?.trim();
  return name && name.length <= MAX_LENGTH ? name : null;
}
