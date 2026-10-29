const PARAM = 'credit';
/** Longer than any stored name (32), so a hand-edited link can't drag in an essay. */
const MAX_LENGTH = 64;

/**
 * Names stored before the server stopped cutting emoji in half can end in a
 * lone surrogate, which `encodeURIComponent` throws on. Links carry this
 * repaired form, and the lookup compares it on both sides.
 */
export function wellFormed(text: string): string {
  // A loop, not a lookbehind regex: Safari 15 can't parse lookbehind, and a
  // regex literal it can't parse breaks the whole chunk, not just links.
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        out += text[i] + text[i + 1];
        i++;
      } else {
        out += '\uFFFD';
      }
    } else {
      out += code >= 0xdc00 && code <= 0xdfff ? '\uFFFD' : text[i];
    }
  }
  return out;
}

/** A link that opens the credits on `name`. Names are the only handle the public list carries. */
export function creditLinkFor(name: string, origin: string): string {
  return `${origin}/supporters?${PARAM}=${encodeURIComponent(wellFormed(name))}`;
}

/** The supporter a link names: exact, ignoring case, never a partial match. */
export function isCreditFor(linked: string, name: string): boolean {
  return wellFormed(name).toLowerCase() === linked.toLowerCase();
}

/** Untrimmed on purpose: a name cut at 32 units can end in a space, and the link keeps it. */
export function creditFromSearch(search: string): string | null {
  const name = new URLSearchParams(search).get(PARAM);
  return name?.trim() && name.length <= MAX_LENGTH ? name : null;
}
