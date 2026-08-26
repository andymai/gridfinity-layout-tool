#!/usr/bin/env tsx
/**
 * Regenerates the field tables in docs/schemas/*.md from the published schemas.
 *
 * Usage: pnpm run gen:schema-docs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DOCS_DIR,
  formatMarkdown,
  readDoc,
  renderConstraints,
  renderDoc,
  schemaIndex,
} from './schema/genSchemaDocs.ts';

const FILES = ['layout.md', 'bin-design.md'];

async function main(): Promise<void> {
  const index = schemaIndex();
  let changed = 0;
  for (const file of FILES) {
    const before = readDoc(file);
    const after = await formatMarkdown(renderDoc(before, index));
    if (before !== after) {
      writeFileSync(join(DOCS_DIR, file), after);
      changed += 1;
      console.log(`updated ${file}`);
    } else {
      console.log(`unchanged ${file}`);
    }
  }
  const constraints = await formatMarkdown(renderConstraints());
  const constraintsPath = join(DOCS_DIR, 'constraints.md');
  if (readFileSync(constraintsPath, 'utf8') !== constraints) {
    writeFileSync(constraintsPath, constraints);
    changed += 1;
    console.log('updated constraints.md');
  } else {
    console.log('unchanged constraints.md');
  }

  console.log(changed === 0 ? 'All schema docs already current.' : `Rewrote ${changed} file(s).`);
}

await main();
