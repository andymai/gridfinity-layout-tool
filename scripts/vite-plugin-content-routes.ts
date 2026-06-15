import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { Plugin } from 'vite';

// Mirror of vercel.json's content rewrites. The prod CDN serves the generated
// public/<slug>/index.html for these extensionless paths, but Vite's dev server
// has no equivalent — the SPA history fallback swallows them and returns the app
// shell instead. This dev-only middleware reproduces the rewrite so the Learn
// links resolve to the same static pages locally as they do in production.
const PUBLIC_DIR = fileURLToPath(new URL('../public', import.meta.url));

const SLUGS = [
  'what-is-gridfinity',
  'guide',
  'privacy',
  'terms',
  'gridfinity-bin-generator',
  'gridfinity-baseplate-generator',
  'gridfinity-sizes',
];

// privacy/terms are English-only in prod (omitted from the localized rewrite).
const LOCALIZED_SLUGS = SLUGS.filter((s) => s !== 'privacy' && s !== 'terms');
const LOCALES = ['de', 'fr', 'es', 'pt-BR', 'nl', 'sv', 'nb', 'uk'];

const ROUTE = new RegExp(`^/(${SLUGS.join('|')})/?$`);
const LOCALIZED_ROUTE = new RegExp(`^/(${LOCALES.join('|')})/(${LOCALIZED_SLUGS.join('|')})/?$`);

export function contentRoutesPlugin(): Plugin {
  return {
    name: 'content-routes-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = (req.url ?? '').split('?')[0];

        let file: string | null = null;
        const plain = ROUTE.exec(pathname);
        if (plain) {
          file = path.join(PUBLIC_DIR, plain[1], 'index.html');
        } else {
          const localized = LOCALIZED_ROUTE.exec(pathname);
          if (localized) {
            file = path.join(PUBLIC_DIR, localized[1], localized[2], 'index.html');
          }
        }

        if (!file || !existsSync(file)) {
          next();
          return;
        }

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(readFileSync(file));
      });
    },
  };
}
