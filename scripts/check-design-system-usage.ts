/**
 * Design System Usage Checker
 *
 * Enforces that feature and component code uses design system components
 * instead of raw HTML elements:
 *
 *   <button>                 → <Button>
 *   <select>                 → <Select>
 *   <input type="checkbox">  → <Checkbox>
 *   <input>                  → <Input>
 *
 * Parses the JSX rather than grepping it. The previous shell implementation
 * matched line by line, so it required `<input` and `type="checkbox"` to land
 * on the SAME line — and Prettier routinely splits an element across lines. A
 * genuine raw checkbox cleared pre-commit and CI that way, and was only caught
 * by looking at the rendered UI. Walking the AST also stops `<button>` inside a
 * comment or a string from reading as a violation.
 *
 * Usage:
 *   tsx scripts/check-design-system-usage.ts           # every src/**\/*.tsx
 *   tsx scripts/check-design-system-usage.ts --staged  # staged files only
 *   tsx scripts/check-design-system-usage.ts file.tsx  # one file
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

const RED = '[0;31m';
const YELLOW = '[1;33m';
const GREEN = '[0;32m';
const BLUE = '[0;34m';
const CYAN = '[0;36m';
const DIM = '[2m';
const NC = '[0m';

const ALLOWLIST_FILE = 'scripts/design-system-allowlist.txt';

export interface Violation {
  readonly file: string;
  /** 1-based, matching editor and grep conventions. */
  readonly line: number;
  readonly found: string;
  readonly use: string;
  readonly lineContent: string;
  /**
   * Whether this fails the build.
   *
   * `<button>`, `<select>` and checkbox inputs have always been enforced. Text
   * `<input>` was documented as enforced but the shell implementation never
   * checked it, so turning it blocking here would fail ~50 pre-existing sites
   * on a commit that only meant to fix the checker. Reported, not enforced,
   * until that migration is scheduled.
   */
  readonly blocking: boolean;
}

/** Raw elements with a design-system replacement, keyed by intrinsic tag name. */
const SIMPLE_REPLACEMENTS: Readonly<Record<string, string>> = {
  button: '<Button>',
  select: '<Select>',
};

function isIntrinsic(tagName: ts.JsxTagNameExpression): tagName is ts.Identifier {
  // A lowercase-initial identifier is an intrinsic element; anything else
  // (`Button`, `Dialog.Root`) is a component, which is what we want people using.
  return ts.isIdentifier(tagName) && /^[a-z]/.test(tagName.text);
}

/**
 * The literal `type` of an `<input>`, or `null` when it is absent or computed.
 * A computed type could be "checkbox", so callers must not assume it is text.
 */
function literalInputType(attributes: ts.JsxAttributes): string | null {
  for (const property of attributes.properties) {
    if (!ts.isJsxAttribute(property)) continue;
    if (property.name.getText() !== 'type') continue;
    const { initializer } = property;
    if (initializer && ts.isStringLiteral(initializer)) return initializer.text;
    return null;
  }
  return null;
}

function describe(
  tagName: string,
  attributes: ts.JsxAttributes
): { found: string; use: string; blocking: boolean } | null {
  const simple = SIMPLE_REPLACEMENTS[tagName];
  if (simple !== undefined) return { found: `<${tagName}>`, use: simple, blocking: true };

  if (tagName !== 'input') return null;

  const type = literalInputType(attributes);
  if (type === 'checkbox') {
    return { found: '<input type="checkbox">', use: '<Checkbox>', blocking: true };
  }
  // No design-system equivalent, so there is nothing to recommend:
  // `hidden` renders nothing, and a file input is a mechanism rather than a
  // styled control — the pattern is a hidden input a Button clicks via a ref.
  if (type === 'hidden' || type === 'file') return null;
  // These have their own components; pointing them at <Input> was wrong.
  if (type === 'range') return { found: '<input type="range">', use: '<Slider>', blocking: false };
  if (type === 'color') {
    return { found: '<input type="color">', use: '<ColorSwatch>', blocking: false };
  }
  return { found: `<input${type ? ` type="${type}"` : ''}>`, use: '<Input>', blocking: false };
}

export function findViolations(file: string, source: string): Violation[] {
  const snippet = (node: ts.Node, sf: ts.SourceFile): string => {
    // The whole opening tag, whitespace collapsed. Printing just the starting
    // line renders a bare "<input" for the multi-line elements this checker
    // exists to catch, which tells the reader nothing.
    const text = node.getText(sf).replace(/\s+/g, ' ').trim();
    return text.length > 100 ? `${text.slice(0, 97)}...` : text;
  };

  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const out: Violation[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      if (isIntrinsic(node.tagName)) {
        const described = describe(node.tagName.text, node.attributes);
        if (described) {
          const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
          out.push({
            file,
            line: line + 1,
            found: described.found,
            use: described.use,
            lineContent: snippet(node, sourceFile),
            blocking: described.blocking,
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return out;
}

export function shouldExclude(file: string): boolean {
  return (
    file.startsWith('src/design-system/') ||
    file.includes('.test.') ||
    file.includes('.spec.') ||
    file.includes('.stories.') ||
    file.startsWith('src/test/') ||
    file.startsWith('e2e/')
  );
}

function loadAllowlist(): Set<string> {
  if (!existsSync(ALLOWLIST_FILE)) return new Set();
  return new Set(
    readFileSync(ALLOWLIST_FILE, 'utf8')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('#'))
  );
}

function walkTsx(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walkTsx(path, out);
    else if (entry.name.endsWith('.tsx')) out.push(path);
  }
}

function getFiles(arg: string | undefined): string[] {
  if (arg === '--staged') {
    // execFileSync with an argument array: no shell, so nothing here can be
    // reinterpreted even if a path ever contained shell metacharacters.
    const staged = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACM'], {
      encoding: 'utf8',
    });
    return staged
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.endsWith('.tsx') && l.startsWith('src/'));
  }
  if (arg) return [arg];
  const out: string[] = [];
  walkTsx('src', out);
  return out;
}

function main(): void {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' Design System Usage Check');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  const files = getFiles(process.argv[2]).filter((f) => !shouldExclude(f) && existsSync(f));

  if (files.length === 0) {
    console.log(`${GREEN}✓${NC} No TSX files to check`);
    process.exit(0);
  }

  console.log(`Checking ${files.length} file(s) for raw HTML element usage...`);
  console.log('');

  const allowlist = loadAllowlist();
  let allowlisted = 0;
  const blocking: Violation[] = [];
  const warnings: Violation[] = [];

  for (const file of files) {
    for (const found of findViolations(file, readFileSync(file, 'utf8'))) {
      if (allowlist.has(file)) allowlisted += 1;
      else if (found.blocking) blocking.push(found);
      else warnings.push(found);
    }
  }

  for (const v of blocking) {
    console.log(`${RED}VIOLATION${NC} ${v.file}:${v.line}`);
    console.log(`  Found: ${YELLOW}${v.found}${NC}`);
    console.log(`  Use:   ${GREEN}${v.use}${NC} from ${CYAN}@/design-system${NC}`);
    console.log(`  Line:  ${BLUE}${v.lineContent}${NC}`);
    console.log('');
  }

  if (warnings.length > 0) {
    const byUse = new Map<string, Set<string>>();
    for (const w of warnings) {
      const files = byUse.get(w.use) ?? new Set<string>();
      files.add(w.file);
      byUse.set(w.use, files);
    }
    console.log(`${YELLOW}⚠${NC}  Raw elements with a design-system equivalent, not blocking:`);
    for (const [use, files] of [...byUse].sort()) {
      const count = warnings.filter((w) => w.use === use).length;
      console.log(`     ${count} could use ${GREEN}${use}${NC} ${DIM}(${files.size} file(s))${NC}`);
    }
    console.log('');
  }

  console.log('───────────────────────────────────────────────────────────────');
  if (blocking.length === 0) {
    if (allowlisted > 0) {
      console.log(`${GREEN}✓${NC} No new design system violations`);
      console.log(`  ${DIM}(${allowlisted} existing violation(s) in allowlisted files)${NC}`);
    } else {
      console.log(`${GREEN}✓${NC} All files use design system components correctly`);
    }
    console.log('');
    process.exit(0);
  }

  console.log(`${RED}✗${NC} Found ${blocking.length} new design system violation(s)`);
  if (allowlisted > 0) {
    console.log(`  ${DIM}(${allowlisted} existing violation(s) in allowlisted files)${NC}`);
  }
  console.log('');
  console.log('The design system provides consistent, accessible components.');
  console.log('Import them from @/design-system:');
  console.log('');
  console.log("  import { Button, Checkbox, Select, Input } from '@/design-system';");
  console.log('');
  console.log('If this is an existing file being modified, add it to:');
  console.log(`  ${ALLOWLIST_FILE}`);
  console.log('');
  process.exit(1);
}

// Guarded so the test can import findViolations without running the CLI.
if (process.argv[1]?.endsWith('check-design-system-usage.ts')) main();
