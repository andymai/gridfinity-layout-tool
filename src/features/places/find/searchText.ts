import { processLabel } from '@/shared/analytics/labelVocabulary';

/** A trailing plural `s` comes off, so "screws" and "screw" meet under prefix matching. */
function stem(token: string): string {
  return token.length > 3 && token.endsWith('s') && !token.endsWith('ss')
    ? token.slice(0, -1)
    : token;
}

export function tokenize(text: string): string[] {
  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token !== '')
    .map(stem);
}

/** The vocabulary's canonical term for `text`, so "Schrauben" and "screws" meet; null when unknown. */
export function conceptOf(text: string): string | null {
  const { normalized, confidence } = processLabel(text);
  return normalized !== null && confidence >= 0.8 ? normalized : null;
}
