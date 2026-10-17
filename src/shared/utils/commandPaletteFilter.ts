import { defaultFilter } from 'cmdk';

/**
 * Marks a palette item that arrives already matched and ranked (Find's bins).
 * cmdk still scores and sorts every item and group, so these score above any
 * `commandScore`, which tops out at 1, and its stable sort keeps their order.
 */
export const PRE_RANKED_VALUE_PREFIX = 'pre-ranked:';

export function commandPaletteFilter(value: string, search: string, keywords?: string[]): number {
  return value.startsWith(PRE_RANKED_VALUE_PREFIX) ? 2 : defaultFilter(value, search, keywords);
}
