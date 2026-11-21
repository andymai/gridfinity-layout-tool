import fs from 'node:fs/promises';
import path from 'node:path';
import { CORPUS_PATH, corpusSchema, labelsPath, labelsSchema } from './corpus.js';
import type { AskCorpus, AskLabels } from './corpus.js';
import { LOCALE_NAMES } from './prompt.js';

const FETCH_TIMEOUT_MS = 10_000;

export interface DocsSource {
  readonly corpus: AskCorpus;
  readonly english: AskLabels;
  /** How the corpus arrived: from the function's own files, or from its deployment over HTTP. */
  readonly via: 'file' | 'http';
  readonly labels: (locale: string) => Promise<AskLabels>;
  readonly locale: (requested: string) => string;
}

function docsDir(): string {
  return process.env.DOCS_ASK_CORPUS_DIR ?? path.join(process.cwd(), 'dist', 'docs');
}

async function readDocsFile(rel: string): Promise<{ text: string; via: 'file' | 'http' }> {
  try {
    return { text: await fs.readFile(path.join(docsDir(), rel), 'utf8'), via: 'file' };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const host = process.env.VERCEL_URL;
  if (!host) throw new Error(`docs-ask: ${rel} is not in ${docsDir()} and VERCEL_URL is unset`);
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  const response = await fetch(`https://${host}/docs/${rel}`, {
    headers: bypass ? { 'x-vercel-protection-bypass': bypass } : {},
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`docs-ask: GET /docs/${rel} returned ${response.status}`);
  return { text: await response.text(), via: 'http' };
}

async function load(): Promise<DocsSource> {
  const [corpusFile, englishFile] = await Promise.all([
    readDocsFile(CORPUS_PATH),
    readDocsFile(labelsPath('en')),
  ]);
  const corpus = corpusSchema.parse(JSON.parse(corpusFile.text));
  const english = labelsSchema.parse(JSON.parse(englishFile.text));
  const tables = new Map<string, Promise<AskLabels>>([['en', Promise.resolve(english)]]);
  const locale = (requested: string): string =>
    Object.hasOwn(LOCALE_NAMES, requested) ? requested : 'en';
  return {
    corpus,
    english,
    via: corpusFile.via,
    locale,
    labels: (requested) => {
      const code = locale(requested);
      let table = tables.get(code);
      if (!table) {
        table = readDocsFile(labelsPath(code)).then(({ text }) =>
          labelsSchema.parse(JSON.parse(text))
        );
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
