import type { AskCorpus, AskLabels } from '../../api/lib/docsAsk/corpus.js';
import { DISCUSSIONS_URL } from '../../api/lib/docsAsk/prompt.js';

const DOCS_ORIGIN = 'https://gridfinitylayouttool.com';
const LINK = /\]\(([^)\s]+)\)/g;
const CHIP = /\[\[ui:([^\]]+)\]\]/g;
const CAPTURE = /\[\[capture:([A-Za-z0-9._-]+)\]\]/g;
const ANCHOR = /\{#([^}]+)\}/g;

export interface AnswerChecks {
  /** Docs links whose page or anchor does not exist. */
  readonly brokenLinks: readonly string[];
  /** Docs pages that the answer links, without anchors. */
  readonly citedPages: readonly string[];
  /** Chip labels found in neither the reader's label table nor the English one. */
  readonly unknownLabels: readonly string[];
  readonly unknownCaptures: readonly string[];
  readonly linksForum: boolean;
}

/** A docs URL as the corpus key of its page, or null for any other URL. */
export function docsPage(href: string): { page: string; anchor: string | null } | null {
  const local = href.startsWith(DOCS_ORIGIN) ? href.slice(DOCS_ORIGIN.length) : href;
  const match = /^\/docs(\/[^#?]*)?(?:\?[^#]*)?(?:#(.*))?$/.exec(local);
  if (!match) return null;
  const path = (match[1] ?? '').replace(/\.(md|html)$/, '').replace(/\/$/, '');
  return { page: path === '' ? '/index' : path, anchor: match[2] || null };
}

export function anchorsOf(markdown: string): Set<string> {
  return new Set([...markdown.matchAll(ANCHOR)].map((m) => m[1] as string));
}

export function checkAnswer(
  answer: string,
  corpus: AskCorpus,
  labels: AskLabels,
  english: AskLabels
): AnswerChecks {
  const brokenLinks: string[] = [];
  const citedPages = new Set<string>();
  for (const [, href] of answer.matchAll(LINK)) {
    const target = docsPage(href as string);
    if (!target) continue;
    const page = corpus.pages[target.page];
    if (!page || (target.anchor !== null && !anchorsOf(page.markdown).has(target.anchor))) {
      brokenLinks.push(href as string);
      continue;
    }
    citedPages.add(target.page);
  }
  const known = new Set([...Object.values(labels), ...Object.values(english)]);
  const unknownLabels = [...answer.matchAll(CHIP)]
    .map((m) => (m[1] as string).trim())
    .filter((label) => !known.has(label));
  const captures = new Set(
    Object.values(corpus.pages).flatMap((page) =>
      [...page.markdown.matchAll(CAPTURE)].map((m) => m[1] as string)
    )
  );
  const unknownCaptures = [...answer.matchAll(CAPTURE)]
    .map((m) => m[1] as string)
    .filter((id) => !captures.has(id));
  return {
    brokenLinks,
    citedPages: [...citedPages],
    unknownLabels: [...new Set(unknownLabels)],
    unknownCaptures,
    linksForum: answer.includes(DISCUSSIONS_URL),
  };
}
