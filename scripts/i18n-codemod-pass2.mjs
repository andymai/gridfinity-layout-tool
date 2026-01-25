#!/usr/bin/env node
/**
 * i18n codemod pass 2: Handle template strings and expressions
 * Targets patterns like:
 * - {count} bins/pcs/etc (text after expression)
 * - condition ? 'A' : 'B' (ternary strings)
 * - `template ${vars}` in attributes
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { relative } from 'path';

const ROOT = '/var/home/andy/Git/gridfinity-layout-tool';
const mode = process.argv[2] || '--dry-run';

function getViolations() {
  let result;
  try {
    result = execSync('npx eslint src/ -f json',
      { cwd: ROOT, maxBuffer: 50 * 1024 * 1024, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (e) { result = e.stdout; }
  const data = JSON.parse(result);
  const violations = [];
  for (const file of data) {
    const msgs = file.messages.filter(m => m.ruleId === 'i18next/no-literal-string');
    if (msgs.length > 0) violations.push({ filePath: file.filePath, messages: msgs });
  }
  return violations;
}

// Get all remaining violations grouped by file and line
const violations = getViolations();
let totalViolations = 0;

// Report remaining by file
for (const { filePath, messages } of violations) {
  const rel = relative(ROOT, filePath);
  totalViolations += messages.length;
}
console.log(`Total remaining violations: ${totalViolations}`);

// For each file, show what needs manual intervention
if (mode === '--report') {
  for (const { filePath, messages } of violations) {
    const rel = relative(ROOT, filePath);
    const source = readFileSync(filePath, 'utf8');
    const lines = source.split('\n');
    console.log(`\n=== ${rel} (${messages.length}) ===`);
    for (const msg of messages) {
      const line = lines[msg.line - 1]?.trim() || '';
      console.log(`  L${msg.line}: ${line.slice(0, 120)}`);
    }
  }
}

// For suppress mode: add eslint-disable comments for remaining violations
// that are genuinely format strings (numbers + units adjacent to expressions)
if (mode === '--suppress-fragments') {
  let suppressCount = 0;
  for (const { filePath, messages } of violations) {
    const source = readFileSync(filePath, 'utf8');
    const lines = source.split('\n');
    const linesToSuppress = new Set();

    for (const msg of messages) {
      const line = lines[msg.line - 1] || '';
      const trim = line.trim();
      // Only suppress genuinely unsuppressible format fragments:
      // - Single characters/symbols that slipped through
      // - Text fragments that are part of already-translated expressions
      const textAtViolation = line.slice(msg.column - 1, msg.endColumn - 1).trim();
      if (
        textAtViolation.length <= 3 && /^[^a-zA-Z]*$/.test(textAtViolation) || // pure non-alpha
        /^[.,:;!?)(\[\]]+$/.test(textAtViolation) // pure punctuation
      ) {
        linesToSuppress.add(msg.line - 1);
        suppressCount++;
      }
    }

    if (linesToSuppress.size > 0) {
      const newLines = [...lines];
      // Add in reverse order to maintain indices
      const sorted = [...linesToSuppress].sort((a, b) => b - a);
      for (const lineIdx of sorted) {
        const indent = newLines[lineIdx].match(/^(\s*)/)?.[1] || '';
        newLines.splice(lineIdx, 0, `${indent}{/* eslint-disable-next-line i18next/no-literal-string */}`);
      }
      writeFileSync(filePath, newLines.join('\n'));
      const rel = relative(ROOT, filePath);
      console.log(`Suppressed ${linesToSuppress.size} in ${rel}`);
    }
  }
  console.log(`\nTotal suppressed: ${suppressCount}`);
}
