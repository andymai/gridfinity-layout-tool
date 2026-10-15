import { CORE_SCHEMA, load as loadYaml } from 'js-yaml';

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function parseFrontmatter(raw: string): { data: Record<string, unknown>; content: string } {
  const match = FRONTMATTER_RE.exec(raw);
  if (!match) return { data: {}, content: raw };
  const content = raw.slice(match[0].length);
  // A YAML 1.1 schema would turn an unquoted `lastmod: 2026-08-09` into a Date,
  // which resolvePageLastmod rejects, so the schema is pinned rather than left
  // to the library default.
  const parsed = loadYaml(match[1], { schema: CORE_SCHEMA });
  if (parsed == null) return { data: {}, content };
  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('frontmatter must be a YAML mapping');
  }
  return { data: parsed as Record<string, unknown>, content };
}
