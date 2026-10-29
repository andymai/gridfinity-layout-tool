const PARAM = 'credit';
/** Longer than any stored name (32), so a hand-edited link can't drag in an essay. */
const MAX_LENGTH = 64;

/** A link that opens the credits on `name`. Names are the only handle the public list carries. */
export function creditLinkFor(name: string, origin: string): string {
  return `${origin}/supporters?${PARAM}=${encodeURIComponent(name)}`;
}

export function creditFromSearch(search: string): string | null {
  const name = new URLSearchParams(search).get(PARAM)?.trim();
  return name && name.length <= MAX_LENGTH ? name : null;
}
