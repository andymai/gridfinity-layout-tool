import fs from 'node:fs/promises';
import path from 'node:path';
import { CORPUS_PATH, corpusSchema, labelsPath, labelsSchema } from './corpus.js';
import type { AskCorpus, AskLabels } from './corpus.js';
import { LOCALE_NAMES } from './prompt.js';

export interface DocsSource {
  readonly corpus: AskCorpus;
  readonly english: AskLabels;
  readonly labels: (locale: string) => Promise<AskLabels>;
  readonly locale: (requested: string) => string;
}

/**
 * vercel.json's includeFiles puts the docs build's ask/ files in the function,
 * at the path the build wrote them. DOCS_ASK_CORPUS_DIR points a local run at
 * another docs build.
 */
function docsDir(): string {
  return process.env.DOCS_ASK_CORPUS_DIR ?? path.join(process.cwd(), 'dist', 'docs');
}

async function readJson(rel: string): Promise<unknown> {
  return JSON.parse(await fs.readFile(path.join(docsDir(), rel), 'utf8'));
}

async function load(): Promise<DocsSource> {
  const [corpus, english] = await Promise.all([
    readJson(CORPUS_PATH).then((data) => corpusSchema.parse(data)),
    readJson(labelsPath('en')).then((data) => labelsSchema.parse(data)),
  ]);
  const tables = new Map<string, Promise<AskLabels>>([['en', Promise.resolve(english)]]);
  const locale = (requested: string): string =>
    Object.hasOwn(LOCALE_NAMES, requested) ? requested : 'en';
  return {
    corpus,
    english,
    locale,
    labels: (requested) => {
      const code = locale(requested);
      let table = tables.get(code);
      if (!table) {
        table = readJson(labelsPath(code)).then((data) => labelsSchema.parse(data));
        // A failed read retries on the next request, not never.
        table.catch(() => tables.delete(code));
        tables.set(code, table);
      }
      return table;
    },
  };
}

let loading: Promise<DocsSource> | null = null;

/** The docs for this deployment, loaded once for each function instance. */
export function docsSource(): Promise<DocsSource> {
  if (!loading) {
    loading = load();
    loading.catch(() => {
      loading = null;
    });
  }
  return loading;
}
