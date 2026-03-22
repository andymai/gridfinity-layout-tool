// scripts/profile-tests.ts
import { execFileSync } from 'child_process';
import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import path from 'path';

// Run vitest with JSON reporter, capturing output to a temp file
const tmpFile = path.resolve('test-profile-results.json');

console.log('Running vitest with JSON reporter...');
try {
  execFileSync('pnpm', ['exec', 'vitest', 'run', '--reporter=json', `--outputFile=${tmpFile}`], {
    stdio: 'inherit',
    env: { ...process.env, FORCE_COLOR: '0' },
  });
} catch {
  // vitest exits non-zero if tests fail, but JSON is still written
  console.log('(vitest exited non-zero, parsing results anyway)');
}

interface TestFileResult {
  name: string;
  duration?: number;
  numTests: number;
}

const raw = readFileSync(tmpFile, 'utf-8');
const json = JSON.parse(raw);
const results: TestFileResult[] = (json.testResults ?? []).map(
  (r: { name: string; duration?: number; assertionResults?: unknown[] }) => ({
    name: path.relative(process.cwd(), r.name),
    duration: r.duration ?? 0,
    numTests: r.assertionResults?.length ?? 0,
  })
);

// Sort by duration descending
results.sort((a, b) => (b.duration ?? 0) - (a.duration ?? 0));

// Classify files: check for testing-library/react imports
function needsJsdom(filePath: string): boolean {
  try {
    const content = readFileSync(filePath, 'utf-8');
    return (
      content.includes('@testing-library/react') ||
      content.includes("from 'react-dom") ||
      content.includes('from "react-dom') ||
      content.includes('@react-three/') ||
      content.includes('@vitest-environment jsdom')
    );
  } catch {
    return true; // If can't read, assume jsdom needed
  }
}

const totalDuration = results.reduce((sum, r) => sum + (r.duration ?? 0), 0);

console.log(`\n${'='.repeat(80)}`);
console.log(`TOTAL: ${results.length} files, ${(totalDuration / 1000).toFixed(1)}s`);
console.log(`${'='.repeat(80)}\n`);

// Top 30 slowest
console.log('TOP 30 SLOWEST FILES:');
console.log('-'.repeat(80));
for (const r of results.slice(0, 30)) {
  const env = needsJsdom(r.name) ? 'jsdom' : 'node';
  console.log(`  ${((r.duration ?? 0) / 1000).toFixed(2).padStart(8)}s  [${env}]  ${r.name}`);
}

// Environment classification summary
const nodeFiles = results.filter((r) => !needsJsdom(r.name));
const jsdomFiles = results.filter((r) => needsJsdom(r.name));
const nodeDuration = nodeFiles.reduce((sum, r) => sum + (r.duration ?? 0), 0);
const jsdomDuration = jsdomFiles.reduce((sum, r) => sum + (r.duration ?? 0), 0);

console.log(`\nENVIRONMENT CLASSIFICATION:`);
console.log(`  node:  ${nodeFiles.length} files (${(nodeDuration / 1000).toFixed(1)}s)`);
console.log(`  jsdom: ${jsdomFiles.length} files (${(jsdomDuration / 1000).toFixed(1)}s)`);

// Write classification lists for use in workspace config
writeFileSync('test-profile-node-files.txt', nodeFiles.map((r) => r.name).join('\n') + '\n');
writeFileSync('test-profile-jsdom-files.txt', jsdomFiles.map((r) => r.name).join('\n') + '\n');

console.log(`\nClassification lists written to:`);
console.log(`  test-profile-node-files.txt (${nodeFiles.length} files)`);
console.log(`  test-profile-jsdom-files.txt (${jsdomFiles.length} files)`);

// Cleanup JSON
try {
  unlinkSync(tmpFile);
} catch {
  /* already removed */
}
