/**
 * Plural forms as key families: `layers.binCount_one`, `layers.binCount_other`,
 * plus `_few` / `_many` where a language uses them. `t(key, { count })` picks
 * the form with `Intl.PluralRules`, so Polish gets "2 biny" and "5 binów".
 */

export const PLURAL_CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other'] as const;
export type PluralCategory = (typeof PLURAL_CATEGORIES)[number];

const SUFFIX = /_(zero|one|two|few|many|other)$/;

/** The base of a plural form (`a.b_one` gives `a.b`), or null for an ordinary key. */
export function pluralBase(key: string): string | null {
  const match = SUFFIX.exec(key);
  return match ? key.slice(0, match.index) : null;
}

const rulesByLocale = new Map<string, Intl.PluralRules>();

function rulesFor(locale: string): Intl.PluralRules {
  let rules = rulesByLocale.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(locale);
    rulesByLocale.set(locale, rules);
  }
  return rules;
}

export function pluralCategory(locale: string, count: number): PluralCategory {
  return rulesFor(locale).select(count);
}

/** The form for `count` in one locale's strings: its own category, then `_other`. */
export function lookupPlural(
  strings: Readonly<Record<string, string>>,
  locale: string,
  key: string,
  count: number
): string | undefined {
  const exact = `${key}_${pluralCategory(locale, count)}`;
  if (exact in strings) return strings[exact];
  const other = `${key}_other`;
  return other in strings ? strings[other] : undefined;
}

/** Every category a language defines, including ones only fractions reach. */
export function allowedPluralCategories(locale: string): PluralCategory[] {
  return rulesFor(locale).resolvedOptions().pluralCategories;
}

/**
 * The categories whole-number counts reach, plus `_other` as the fallback.
 * A plural family must define each one: a missing `_few` would show the
 * `_other` form for 2 in Polish.
 */
export function requiredPluralCategories(locale: string): PluralCategory[] {
  const reached = new Set<PluralCategory>(['other']);
  for (let n = 0; n <= 1000; n++) reached.add(pluralCategory(locale, n));
  return PLURAL_CATEGORIES.filter((category) => reached.has(category));
}
