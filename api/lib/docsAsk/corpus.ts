import { z } from 'zod';

/**
 * The docs as Ask AI reads them, written by scripts/build-docs-llms.ts into
 * the docs build as ask/corpus.json, with one ask/labels/<locale>.json for each
 * app locale.
 */
export const CORPUS_PATH = 'ask/corpus.json';
export const labelsPath = (locale: string): string => `ask/labels/${locale}.json`;

const pageSchema = z.object({
  group: z.string(),
  title: z.string(),
  url: z.string(),
  markdown: z.string(),
  labels: z.array(z.string()),
});

export const corpusSchema = z.object({
  version: z.string(),
  map: z.string(),
  pages: z.record(z.string(), pageSchema),
});

export const labelsSchema = z.record(z.string(), z.string());

export type AskCorpus = z.infer<typeof corpusSchema>;
export type AskPage = z.infer<typeof pageSchema>;
export type AskLabels = z.infer<typeof labelsSchema>;

export function pageAt(corpus: AskCorpus, link: string): AskPage | undefined {
  return Object.hasOwn(corpus.pages, link) ? corpus.pages[link] : undefined;
}
