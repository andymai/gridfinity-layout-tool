/**
 * Bundles src/agent/server.ts for the Vercel functions in api/, which cannot
 * resolve the app's `@/` imports. The output is gitignored and rebuilt by
 * `build`, `typecheck` and `dev`; Vitest aliases api/lib/agent to the source.
 *
 *   tsx scripts/build-agent-server.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { rolldown } from 'rolldown';
import type { OutputChunk } from 'rolldown';
import { dts } from 'rolldown-plugin-dts';
import pkg from '../package.json' with { type: 'json' };

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT_DIR = path.join(ROOT, 'api/lib/agent/_generated');

// npm packages resolve from node_modules at runtime; workspace packages and
// `@/` code are bundled, so the function needs nothing outside api/.
const EXTERNAL = new Set(
  Object.entries(pkg.dependencies as Record<string, string>)
    .filter(([, version]) => !version.startsWith('workspace:'))
    .map(([name]) => name)
);
const isExternal = (id: string): boolean =>
  id.startsWith('node:') || [...EXTERNAL].some((name) => id === name || id.startsWith(`${name}/`));

// The server bundle must stay free of the browser app.
const FORBIDDEN_PACKAGES = /^(react|react-dom|zustand|three|posthog-js|@react-three\/.*)(\/|$)/;
const FORBIDDEN_MODULES = [/\/src\/core\/store\//, /\/node_modules\/(react|zustand|three)\//];

export function forbiddenIn(chunk: Pick<OutputChunk, 'imports' | 'moduleIds'>): string[] {
  return [
    ...chunk.imports.filter((id) => FORBIDDEN_PACKAGES.test(id)),
    ...chunk.moduleIds.filter((id) => FORBIDDEN_MODULES.some((re) => re.test(id))),
  ];
}

async function main(): Promise<void> {
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  const bundle = await rolldown({
    input: { server: path.join(ROOT, 'src/agent/server.ts') },
    platform: 'node',
    resolve: { alias: { '@': path.join(ROOT, 'src') } },
    external: isExternal,
    plugins: [dts({ tsconfig: path.join(ROOT, 'tsconfig.app.json') })],
  });
  const { output } = await bundle.write({
    dir: OUT_DIR,
    format: 'es',
    entryFileNames: '[name].js',
  });
  await bundle.close();

  const problems = output
    .filter((item): item is OutputChunk => item.type === 'chunk')
    .flatMap((chunk) => forbiddenIn(chunk).map((id) => `${chunk.fileName}: ${id}`));
  if (problems.length > 0) {
    throw new Error(`The agent server bundle pulls in browser app code:\n${problems.join('\n')}`);
  }
  console.log(`✓ Wrote ${path.relative(ROOT, OUT_DIR)}/server.js and server.d.ts`);
}

if (process.argv[1]?.endsWith('build-agent-server.ts')) await main();
