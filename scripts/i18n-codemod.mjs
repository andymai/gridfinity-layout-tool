#!/usr/bin/env node
/**
 * i18n codemod script - Phase 1: Simple string replacements
 * Handles aria-labels, titles, and simple JSX text (no expression interpolation).
 *
 * Usage:
 *   node scripts/i18n-codemod.mjs --dry-run    # Preview changes
 *   node scripts/i18n-codemod.mjs --apply      # Apply changes
 *   node scripts/i18n-codemod.mjs --keys-only  # Just output new keys needed
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { relative } from 'path';

const ROOT = '/var/home/andy/Git/gridfinity-layout-tool';
const mode = process.argv[2] || '--dry-run';

// Common strings that map to shared keys
const COMMON_KEYS = {
  'Close': 'common.close',
  'Cancel': 'common.cancel',
  'Apply': 'common.apply',
  'Save': 'common.save',
  'Delete': 'common.delete',
  'Edit': 'common.edit',
  'Copy': 'common.copy',
  'Done': 'common.done',
  'Reset': 'common.reset',
  'Export': 'common.export',
  'Import': 'common.import',
  'Share': 'common.share',
  'Back': 'common.back',
  'Next': 'common.next',
  'Loading...': 'common.loading',
  'Error': 'common.error',
  'Confirm': 'common.confirm',
  'Search': 'common.search',
  'Download': 'common.download',
  'Settings': 'common.settings',
  'Help': 'common.help',
  'Name': 'common.name',
  'None': 'common.none',
  'Select': 'common.select',
  'Remove': 'common.remove',
  'Add': 'common.add',
  'Create': 'common.create',
  'Rename': 'common.rename',
  'Duplicate': 'common.duplicate',
  'Preview': 'common.preview',
  'Undo': 'common.undo',
  'Redo': 'common.redo',
  'Label': 'common.label',
  'Notes': 'common.notes',
  'Category': 'common.category',
  'Color': 'common.color',
  'Height': 'common.height',
  'Width': 'common.width',
  'Depth': 'common.depth',
  'Size': 'common.size',
  'Actions': 'common.actions',
  'Options': 'common.options',
  'Sort': 'common.sort',
  'Group': 'common.group',
  'Layers': 'common.layers',
  'Tools': 'common.tools',
  'Open': 'common.open',
  'View': 'common.view',
};

// File path to namespace mapping
function getNamespace(filePath) {
  const rel = relative(ROOT + '/src', filePath);
  if (rel.startsWith('components/Modals/BinListModal/')) return 'binList';
  if (rel.startsWith('components/Mobile/MobileLayoutsPanel')) return 'mobile.layouts';
  if (rel.startsWith('components/Mobile/MobileSettingsPanel')) return 'mobile.settings';
  if (rel.startsWith('components/Mobile/MobileHelpModal')) return 'mobile.help';
  if (rel.startsWith('components/Mobile/MobileHeader')) return 'mobile.header';
  if (rel.startsWith('components/Mobile/MobileInspector')) return 'mobile.inspector';
  if (rel.startsWith('components/Mobile/MobileGridToolbar')) return 'mobile.toolbar';
  if (rel.startsWith('components/Mobile/MobilePrintList')) return 'mobile.printList';
  if (rel.startsWith('components/Mobile/MobileCategoriesPanel')) return 'mobile.categories';
  if (rel.startsWith('components/Mobile/MultiBinContextMenu')) return 'mobile.contextMenu';
  if (rel.startsWith('components/Mobile/BottomSheet')) return 'mobile.bottomSheet';
  if (rel.startsWith('components/Mobile/')) return 'mobile';
  if (rel.startsWith('components/Modals/HelpModal')) return 'help';
  if (rel.startsWith('components/Modals/SettingsModal')) return 'settings';
  if (rel.startsWith('components/Modals/ImportModal')) return 'layouts.import';
  if (rel.startsWith('components/Modals/HalfBinModeBlockedModal')) return 'halfBinBlocked';
  if (rel.startsWith('components/RightPanel')) return 'rightPanel';
  if (rel.startsWith('components/Sidebar/')) return 'sidebar';
  if (rel.startsWith('components/Collab/')) return 'collab';
  if (rel.startsWith('components/Tablet/')) return 'tablet';
  if (rel.startsWith('components/ErrorBoundary')) return 'error';
  if (rel.startsWith('components/PanelErrorBoundary')) return 'error.panel';
  if (rel.startsWith('components/DropZones')) return 'grid.dropZones';
  if (rel.startsWith('components/BinList/')) return 'dashboard';
  if (rel.startsWith('features/bin-designer/')) return 'binDesigner';
  if (rel.startsWith('features/bin-inspector/')) return 'inspector';
  if (rel.startsWith('features/categories/')) return 'categories';
  if (rel.startsWith('features/cloud-share/')) return 'share';
  if (rel.startsWith('features/grid-editor/')) return 'grid';
  if (rel.startsWith('features/inspiration-gallery/')) return 'gallery';
  if (rel.startsWith('features/labs/')) return 'labs';
  if (rel.startsWith('features/layers/')) return 'layers';
  if (rel.startsWith('features/layout-library/')) return 'layouts';
  if (rel.startsWith('features/print-export/')) return 'print';
  if (rel.startsWith('features/staging/')) return 'staging';
  if (rel.startsWith('shared/components/ToolSwitcher')) return 'toolSwitcher';
  if (rel.startsWith('shared/components/Toast')) return 'toast';
  if (rel.startsWith('shared/components/ContextMenu')) return 'contextMenu';
  if (rel.startsWith('shared/')) return 'shared';
  if (rel.startsWith('hooks/')) return 'hooks';
  if (rel.startsWith('layouts/')) return 'layout';
  if (rel.startsWith('App.tsx')) return 'app';
  return 'app';
}

// Generate a camelCase key from a string
function stringToKey(str) {
  const cleaned = str
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(w => w.length > 0)
    .map((word, i) => i === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
  return cleaned.slice(0, 35) || 'text';
}

// Get all violations from ESLint
function getViolations() {
  let result;
  try {
    result = execSync(
      'npx eslint src/ -f json',
      { cwd: ROOT, maxBuffer: 50 * 1024 * 1024, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
  } catch (e) {
    result = e.stdout;
  }
  const data = JSON.parse(result);
  const violations = [];
  for (const file of data) {
    const i18nMessages = file.messages.filter(m => m.ruleId === 'i18next/no-literal-string');
    if (i18nMessages.length > 0) {
      violations.push({ filePath: file.filePath, messages: i18nMessages });
    }
  }
  return violations;
}

// Extract the literal string value from source at the violation position
function extractString(source, msg) {
  const lines = source.split('\n');

  if (msg.nodeType === 'Literal') {
    // Attribute value: the col points to the opening quote
    const line = lines[msg.line - 1];
    const startCol = msg.column - 1; // 0-indexed, points to opening quote
    const endCol = msg.endColumn - 1; // points after closing quote
    const raw = line.slice(startCol, endCol);
    // Remove quotes
    if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
      return raw.slice(1, -1);
    }
    return raw;
  }

  if (msg.nodeType === 'JSXText') {
    // Text content between tags
    if (msg.line === msg.endLine) {
      // Single line
      const line = lines[msg.line - 1];
      return line.slice(msg.column - 1, msg.endColumn - 1).trim();
    } else {
      // Multi-line: collect all lines
      let text = '';
      for (let i = msg.line - 1; i <= msg.endLine - 1; i++) {
        if (i === msg.line - 1) {
          text += lines[i].slice(msg.column - 1);
        } else if (i === msg.endLine - 1) {
          text += '\n' + lines[i].slice(0, msg.endColumn - 1);
        } else {
          text += '\n' + lines[i];
        }
      }
      return text.trim();
    }
  }

  return null;
}

// Check if a JSXText violation is simple (not mixed with expressions in the same parent)
function isSimpleJSXText(source, msg) {
  const lines = source.split('\n');
  const line = lines[msg.line - 1];

  // If it's single-line and the text is between > and <, it's simple
  if (msg.line === msg.endLine) {
    const before = line.slice(0, msg.column - 1);
    const after = line.slice(msg.endColumn - 1);
    // Check if there's a { on the same line before or after the text (indicates template)
    const textPart = line.slice(msg.column - 1, msg.endColumn - 1);
    if (textPart.includes('{')) return false;
    // Check if adjacent content has expressions
    if (before.includes('{') && before.lastIndexOf('{') > before.lastIndexOf('>')) return false;
    if (after.includes('{') && after.indexOf('{') < after.indexOf('<')) return false;
    return true;
  }

  // Multi-line: check if the trimmed content is just text (no expressions)
  const text = extractString(source, msg);
  return text && !text.includes('{') && !text.includes('}');
}

// Determine the attribute name for a Literal violation
function getAttributeName(source, msg) {
  const lines = source.split('\n');
  const line = lines[msg.line - 1];
  const before = line.slice(0, msg.column - 1);
  const attrMatch = before.match(/([\w-]+)=$/);
  return attrMatch ? attrMatch[1] : null;
}

// Main processing
const violations = getViolations();
const allKeys = new Map(); // key -> english value
const fileEdits = new Map(); // filePath -> edits[]
const usedKeys = new Set(); // track used keys to avoid duplicates

let totalViolations = 0;
let fixableCount = 0;
let skippedCount = 0;

for (const { filePath, messages } of violations) {
  const source = readFileSync(filePath, 'utf8');
  const namespace = getNamespace(filePath);
  const edits = [];

  for (const msg of messages) {
    totalViolations++;
    const value = extractString(source, msg);
    if (!value || value.length === 0) { skippedCount++; continue; }

    // Skip template-like strings (contain expressions)
    if (value.includes('{') || value.includes('}')) { skippedCount++; continue; }

    // Skip fragments: very short strings that are just formatting/unit suffixes
    const isFragment = (
      value.length <= 2 && !['or', 'No', 'OK', '3D'].includes(value) ||
      /^[^a-zA-Z]*$/.test(value) ||  // No letters at all (pure punctuation/numbers)
      /^[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}]/u.test(value) || // Emoji
      /^[.,:;!?()[\]{}%$#@&*+/\\|~`'"<>]+$/.test(value) || // Pure punctuation
      /^\d+[.,:;]?\s*$/.test(value) || // Just numbers
      value === 'm' || value === 'h' || value === 'u' || value === 'pcs' ||
      value === 'Pcs' || value === 'Qty' || value === '.5'
    );
    if (isFragment) { skippedCount++; continue; }

    if (msg.nodeType === 'Literal') {
      // Attribute value replacement
      const attrName = getAttributeName(source, msg);
      if (!attrName) { skippedCount++; continue; }

      const key = COMMON_KEYS[value] || `${namespace}.${stringToKey(value)}`;
      if (!usedKeys.has(key) || allKeys.get(key) === value) {
        allKeys.set(key, value);
        usedKeys.add(key);
      } else {
        // Key collision - add suffix
        const uniqueKey = `${namespace}.${stringToKey(value)}2`;
        allKeys.set(uniqueKey, value);
      }
      const finalKey = allKeys.has(COMMON_KEYS[value]) ? COMMON_KEYS[value] : (COMMON_KEYS[value] || `${namespace}.${stringToKey(value)}`);

      edits.push({
        line: msg.line,
        column: msg.column,
        endLine: msg.endLine,
        endColumn: msg.endColumn,
        type: 'attribute',
        attrName,
        oldValue: value,
        key: finalKey,
      });
      allKeys.set(finalKey, value);
      fixableCount++;

    } else if (msg.nodeType === 'JSXText') {
      if (!isSimpleJSXText(source, msg)) { skippedCount++; continue; }

      const key = COMMON_KEYS[value] || `${namespace}.${stringToKey(value)}`;
      allKeys.set(key, value);

      edits.push({
        line: msg.line,
        column: msg.column,
        endLine: msg.endLine,
        endColumn: msg.endColumn,
        type: 'jsxtext',
        oldValue: value,
        key,
      });
      fixableCount++;
    } else {
      skippedCount++;
    }
  }

  if (edits.length > 0) {
    fileEdits.set(filePath, edits);
  }
}

console.log(`Total violations: ${totalViolations}`);
console.log(`Auto-fixable: ${fixableCount}`);
console.log(`Skipped (manual): ${skippedCount}`);
console.log(`Files affected: ${fileEdits.size}`);

if (mode === '--keys-only') {
  console.log('\n=== NEW TRANSLATION KEYS ===\n');
  const sorted = [...allKeys.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  for (const [key, value] of sorted) {
    console.log(`  '${key}': '${value.replace(/'/g, "\\'")}',`);
  }
  console.log(`\nTotal: ${allKeys.size} keys`);

} else if (mode === '--dry-run') {
  for (const [filePath, edits] of fileEdits) {
    const rel = relative(ROOT, filePath);
    console.log(`\n${rel} (${edits.length} edits):`);
    for (const edit of edits.slice(0, 8)) {
      console.log(`  L${edit.line}: ${edit.type === 'attribute' ? edit.attrName + '=' : ''}"${edit.oldValue}" → t('${edit.key}')`);
    }
    if (edits.length > 8) console.log(`  ... and ${edits.length - 8} more`);
  }

} else if (mode === '--apply') {
  let totalApplied = 0;

  for (const [filePath, edits] of fileEdits) {
    const source = readFileSync(filePath, 'utf8');
    const lines = source.split('\n');
    let hasTranslation = source.includes('useTranslation');

    // Sort edits by position, bottom-to-top, right-to-left
    const sorted = [...edits].sort((a, b) => {
      if (b.line !== a.line) return b.line - a.line;
      return b.column - a.column;
    });

    for (const edit of sorted) {
      if (edit.type === 'attribute') {
        // Replace attr="value" with attr={t('key')}
        const lineIdx = edit.line - 1;
        const line = lines[lineIdx];
        const oldStr = `${edit.attrName}="${edit.oldValue}"`;
        const newStr = `${edit.attrName}={t('${edit.key}')}`;
        if (line.includes(oldStr)) {
          lines[lineIdx] = line.replace(oldStr, newStr);
          totalApplied++;
        } else {
          // Try single quotes
          const oldStrSingle = `${edit.attrName}='${edit.oldValue}'`;
          if (line.includes(oldStrSingle)) {
            lines[lineIdx] = line.replace(oldStrSingle, newStr);
            totalApplied++;
          }
        }
      } else if (edit.type === 'jsxtext') {
        if (edit.line === edit.endLine) {
          // Single-line JSX text
          const lineIdx = edit.line - 1;
          const line = lines[lineIdx];
          const startCol = edit.column - 1;
          const endCol = edit.endColumn - 1;
          const textContent = line.slice(startCol, endCol);
          // Find the indentation of this text
          const indent = line.match(/^(\s*)/)?.[1] || '';
          const trimmedText = textContent.trim();

          if (trimmedText.length > 0) {
            // Replace the text with {t('key')}
            const before = line.slice(0, startCol);
            const after = line.slice(endCol);
            // Check if it's between tags on same line: >Text<
            // Preserve any whitespace structure
            if (before.trimEnd().endsWith('>') && after.trimStart().startsWith('<')) {
              lines[lineIdx] = before.trimEnd() + `{t('${edit.key}')}` + after.trimStart();
            } else {
              // Text might have leading/trailing whitespace we should preserve as part of JSX
              lines[lineIdx] = before + `{t('${edit.key}')}` + after;
            }
            totalApplied++;
          }
        } else {
          // Multi-line JSX text: replace entire range with single-line {t('key')}
          const firstLine = lines[edit.line - 1];
          const lastLine = lines[edit.endLine - 1];
          const indent = firstLine.match(/^(\s*)/)?.[1] || '';
          const before = firstLine.slice(0, edit.column - 1);
          const after = lastLine.slice(edit.endColumn - 1);

          // Replace first line content, remove middle lines, update last line
          lines[edit.line - 1] = before.trimEnd() + `{t('${edit.key}')}` + after.trimStart();
          // Remove the middle and end lines
          lines.splice(edit.line, edit.endLine - edit.line);
          totalApplied++;
        }
      }
    }

    let result = lines.join('\n');

    // Add useTranslation import if not present
    if (!hasTranslation && totalApplied > 0) {
      const importIdx = result.lastIndexOf('\nimport ');
      if (importIdx >= 0) {
        const endOfImport = result.indexOf('\n', importIdx + 1);
        const afterImport = result.indexOf('\n', endOfImport + 1);
        result = result.slice(0, endOfImport + 1) + "import { useTranslation } from '@/i18n';\n" + result.slice(endOfImport + 1);
      }
    }

    // Add const t = useTranslation() in component functions that don't have it
    if (!hasTranslation && totalApplied > 0) {
      // Find function components and add t declaration
      const funcPatterns = [
        /^(export\s+(?:default\s+)?function\s+\w+\s*\([^)]*\)\s*(?::\s*[^{]+)?\{)/gm,
        /^(function\s+\w+\s*\([^)]*\)\s*(?::\s*[^{]+)?\{)/gm,
      ];
      for (const pattern of funcPatterns) {
        let match;
        const matches = [];
        while ((match = pattern.exec(result)) !== null) {
          matches.push(match);
        }
        // Only add to the first match (main component)
        if (matches.length > 0 && !result.includes('const t = useTranslation()')) {
          const m = matches[0];
          const insertPos = m.index + m[0].length;
          result = result.slice(0, insertPos) + '\n  const t = useTranslation();' + result.slice(insertPos);
          break;
        }
      }
    }

    writeFileSync(filePath, result);
    const rel = relative(ROOT, filePath);
    console.log(`✓ ${rel} (${edits.length} edits applied)`);
  }

  console.log(`\nTotal applied: ${totalApplied} edits across ${fileEdits.size} files`);
}
