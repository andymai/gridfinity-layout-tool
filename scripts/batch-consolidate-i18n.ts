/* eslint-disable no-console -- CLI script that outputs to console */
/**
 * Batch i18n key consolidation.
 *
 * Processes a list of (from, to) key pairs and consolidates them:
 * - If both keys exist in all JSON files with identical values → full consolidation
 * - If FROM key doesn't exist in JSON (only en.ts) → remove from en.ts only
 * - If values differ → skip and report
 *
 * Usage:
 *   npx tsx scripts/batch-consolidate-i18n.ts --dry-run   # preview
 *   npx tsx scripts/batch-consolidate-i18n.ts             # execute all
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';

const ROOT_DIR = join(import.meta.dirname, '..');
const LOCALES_DIR = join(ROOT_DIR, 'src', 'i18n', 'locales');
const SRC_DIR = join(ROOT_DIR, 'src');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

// ---------------------------------------------------------------------------
// Dedup pairs: [from (remove), to (keep)]
// ---------------------------------------------------------------------------
const DEDUP_PAIRS: [string, string][] = [
  // --- Priority 1: intra-namespace ---
  ['rightPanel.inspectorTab', 'rightPanel.inspector'],
  ['inspector.deleteAll', 'inspector.multi.delete'],
  ['inspector.customProps.title', 'inspector.customProperties'],
  ['binDesigner.changeColor', 'binDesigner.changePreviewColor'],
  ['print.sort.customProperties', 'print.customProperties'],
  ['layouts.import.validationErrors', 'layouts.validationErrors'],
  ['layouts.importLayout', 'layouts.import.title'],
  ['designLinking.inspector.editDesign', 'designLinking.menu.editDesign'],

  // --- Priority 1: cross-namespace, duplicate of common.* ---
  ['commandPalette.redo', 'common.redo'],
  ['snapshots.undoDelete', 'common.undo'],
  ['errorBoundary.tryAgain', 'error.tryAgain'],
  ['inspector.category', 'common.category'],
  ['inspector.multi.category', 'common.category'],
  ['binDesigner.cutouts.delete', 'common.delete'],
  ['binDesigner.cutouts.duplicate', 'common.duplicate'],
  ['binDesigner.cutouts.copy', 'common.copy'],
  ['binDesigner.importDesign', 'common.import'],
  ['binDesigner.cutoutEditor.done', 'common.done'],
  ['loading.sharedWithMe', 'common.loading'],
  ['toolbar.moreOptions', 'common.moreOptions'],
  ['inspector.label', 'common.label'],
  ['inspector.notes', 'common.notes'],

  // --- Priority 1: other cross-namespace ---
  ['date.justNow', 'snapshots.justNow'],
  ['inspector.customPropertiesCount', 'rightPanel.customPropertiesCount'],
  ['header.openLayoutManager', 'help.shortcut.openLayoutManager'],
  ['inspector.customProps.valuePlaceholder', 'inspector.customProps.multiValuePlaceholder'],
  ['inspector.propertyName', 'inspector.customProps.multiKeyPlaceholder'],

  // --- Priority 2: preview3d mirrors of grid ---
  ['preview3d.isometricView', 'grid.isometricView'],
  ['preview3d.frontView', 'grid.frontView'],
  ['preview3d.sideView', 'grid.sideView'],
  ['preview3d.focusLayer', 'grid.focusShowOnlyActiveLayer'],
  ['preview3d.stackLayers', 'grid.stackShowActiveLayerAndBelow'],
  ['preview3d.allLayers', 'grid.allShowAllLayers'],

  // --- Priority 2: mobile mirrors ---
  ['mobile.layouts.inspirationGallery', 'gallery.title'],
  ['sidebar.inspirationGallery', 'gallery.title'],
  ['mobile.layouts.newLayout', 'layouts.newLayout'],
  ['commandPalette.newLayout', 'layouts.newLayout'],
  ['mobile.header.saved', 'header.saved'],
  ['binDesigner.saved', 'header.saved'],
  ['mobile.header.saving', 'header.saving'],
  ['binDesigner.saving', 'header.saving'],
  ['binDesigner.experimental', 'settings.experimental'],
  ['designLinking.experimental', 'settings.experimental'],
  ['mobile.categories.active', 'layouts.active'],
  ['mobile.layouts.active', 'layouts.active'],
  ['binDesigner.active', 'layouts.active'],
  ['binDesigner.viewMode', 'layouts.viewMode'],
  ['binDesigner.listView', 'layouts.listView'],
  ['binDesigner.gridView', 'layouts.gridView'],
  ['binDesigner.sortRecent', 'layouts.sortRecent'],
  ['binDesigner.sortBy', 'layouts.sortBy'],
  ['binDesigner.clearSearch', 'layouts.clearSearch'],
  ['help.clearSearch', 'layouts.clearSearch'],
  ['mobile.settings.toggleHalfBinMode', 'sidebar.toggleHalfBinMode'],
  ['mobile.categories.addCategory', 'categories.addCategory'],
  ['mobile.categories.editCategory', 'categories.editCategory'],
  ['layouts.viewOnly', 'share.cloud.viewOnly'],
  ['layouts.canEdit', 'share.cloud.canEdit'],
  ['mobile.layouts.shareToCloud', 'share.shareToCloud'],
  ['mobile.layouts.linkCopiedToClipboard', 'toast.linkCopied'],
  ['mobile.header.github', 'sidebar.github'],
  ['mobile.header.tip', 'sidebar.tip'],
  ['mobile.header.openSettings', 'sidebar.openSettings'],
  ['mobile.tools.deselect', 'layers.deselect'],
  ['mobile.tools.squares', 'layers.squares'],
  ['mobile.tools.tall', 'layers.tall'],
  ['mobile.tools.wide', 'layers.wide'],
  ['commandPalette.addLayer', 'layers.addLayer'],
  ['binDesigner.cutouts.clearAll', 'staging.clearAll'],
  ['mobile.settings.halfBinMode', 'sidebar.halfBinMode'],
  ['binDesigner.halfBinMode', 'sidebar.halfBinMode'],
  ['mobile.settings.labs', 'settings.tabs.labs'],
  ['labs.labs', 'settings.tabs.labs'],
  ['mobile.layouts.forkedFrom', 'layouts.forkedFrom'],
  ['mobile.layouts.getIdeasForYourDrawer', 'sidebar.inspirationHint'],
  ['mobile.layouts.previewLayers', 'layouts.import.layers'],
  ['snapshots.layers', 'layouts.import.layers'],
  ['mobile.tools.noGaps', 'layers.noGaps'],
  ['mobile.tools.noBins', 'layers.noBins'],
  ['mobile.tools.fillGaps', 'layers.fillGaps'],
  ['mobile.tools.rectangles', 'layers.rectangles'],
];

// Priority 3 bug fixes: [key, wrongValue, correctValue]
// These normalize values so more consolidations succeed
const VALUE_FIXES: [string, string, string][] = [
  // trailing space bug
  ['mobile.settings.toolBy', 'Tool by ', 'Tool by'],
  // ellipsis inconsistency - standardize to ASCII ...
  ['binDesigner.exporting', 'Exporting\u2026', 'Exporting...'],
  // missing ! in Copied
  ['binDesigner.copied', 'Copied', 'Copied!'],
  ['mobile.printList.copied', 'Copied', 'Copied!'],
  // capitalization fixes (standardize to sentence case)
  ['mobile.tools.noBins', 'No Bins', 'No bins'],
  ['mobile.tools.noGaps', 'No Gaps', 'No gaps'],
  ['mobile.tools.fillGaps', 'Fill {count} Gaps', 'Fill {count} gaps'],
  ['header.halfBinMode', 'Half-Bin Mode', 'Half-bin mode'],
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getEnglishTranslations(): Map<string, string> {
  const content = readFileSync(join(LOCALES_DIR, 'en.ts'), 'utf-8');
  const translations = new Map<string, string>();
  const singleQuoteRegex = /'([^']+)':\s*'([^']*)'/g;
  const doubleQuoteRegex = /'([^']+)':\s*"([^"]*)"/g;
  let match;
  while ((match = singleQuoteRegex.exec(content)) !== null) {
    translations.set(match[1], match[2]);
  }
  while ((match = doubleQuoteRegex.exec(content)) !== null) {
    translations.set(match[1], match[2]);
  }
  return translations;
}

function getLocaleFiles(): string[] {
  return readdirSync(LOCALES_DIR)
    .filter((f) => f.endsWith('.json') && f !== 'en.json')
    .sort();
}

function getJsonTranslations(filename: string): Record<string, string> {
  const content = readFileSync(join(LOCALES_DIR, filename), 'utf-8');
  try {
    return JSON.parse(content) as Record<string, string>;
  } catch (e) {
    throw new Error(`Failed to parse ${filename}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function writeJsonTranslations(filename: string, translations: Record<string, string>): void {
  const sortedKeys = Object.keys(translations).sort();
  writeFileSync(join(LOCALES_DIR, filename), JSON.stringify(translations, sortedKeys, 2) + '\n');
}

function removeFromEnTs(key: string): boolean {
  const enPath = join(LOCALES_DIR, 'en.ts');
  const content = readFileSync(enPath, 'utf-8');
  const lineRegex = new RegExp(`^\\s*'${escapeRegex(key)}':\\s*.+\\n`, 'gm');
  const newContent = content.replace(lineRegex, '');
  if (newContent !== content) {
    writeFileSync(enPath, newContent);
    return true;
  }
  return false;
}

function fixValueInEnTs(key: string, wrongValue: string, correctValue: string): boolean {
  const enPath = join(LOCALES_DIR, 'en.ts');
  const content = readFileSync(enPath, 'utf-8');
  const escapedKey = escapeRegex(key);
  const escapedWrong = escapeRegex(wrongValue);
  const re1 = new RegExp(`('${escapedKey}':\\s*)'${escapedWrong}'`);
  const re2 = new RegExp(`('${escapedKey}':\\s*)"${escapedWrong}"`);
  let newContent = content.replace(re1, `$1'${correctValue}'`);
  if (newContent === content) {
    newContent = content.replace(re2, `$1'${correctValue}'`);
  }
  if (newContent !== content) {
    writeFileSync(enPath, newContent);
    return true;
  }
  return false;
}

function replaceKeyInSourceFiles(fromKey: string, toKey: string): number {
  let totalReplaced = 0;

  function scanDir(dir: string): void {
    for (const entry of readdirSync(dir)) {
      const fullPath = join(dir, entry);
      const isDir = statSync(fullPath).isDirectory();

      if (isDir) {
        if (entry === 'node_modules' || entry === 'locales' || entry === '.git') continue;
        scanDir(fullPath);
      } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
        if (entry.endsWith('.d.ts')) continue;
        const content = readFileSync(fullPath, 'utf-8');
        // Match the key in both single and double quote contexts
        const escapedFrom = escapeRegex(fromKey);
        const re = new RegExp(`'${escapedFrom}'`, 'g');
        const re2 = new RegExp(`"${escapedFrom}"`, 'g');
        let newContent = content.replace(re, `'${toKey}'`);
        newContent = newContent.replace(re2, `"${toKey}"`);
        if (newContent !== content) {
          writeFileSync(fullPath, newContent);
          totalReplaced++;
        }
      }
    }
  }

  scanDir(SRC_DIR);
  return totalReplaced;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const localeFiles = getLocaleFiles();

let enTranslations = getEnglishTranslations();
const localeData: Map<string, Record<string, string>> = new Map();
for (const file of localeFiles) {
  localeData.set(file, getJsonTranslations(file));
}

// ---------------------------------------------------------------------------
// Phase 0: Fix Priority 3 value bugs
// ---------------------------------------------------------------------------
console.log(`\n🔧 Phase 0: Fixing Priority 3 value bugs${DRY_RUN ? ' (DRY RUN)' : ''}\n`);

for (const [key, wrongValue, correctValue] of VALUE_FIXES) {
  const currentEnValue = enTranslations.get(key);
  if (currentEnValue === undefined) {
    console.log(`  ⚠️  ${key}: not in en.ts, skipping`);
    continue;
  }
  if (currentEnValue !== wrongValue) {
    // May already be fixed
    if (currentEnValue === correctValue) {
      console.log(`  ✓  ${key}: already correct`);
    } else {
      console.log(`  ⚠️  ${key}: en.ts = "${currentEnValue}", expected "${wrongValue}"`);
    }
    continue;
  }

  if (DRY_RUN) {
    console.log(`  [DRY RUN] ${key}: "${wrongValue}" → "${correctValue}"`);
  } else {
    const fixed = fixValueInEnTs(key, wrongValue, correctValue);
    if (fixed) {
      enTranslations.set(key, correctValue);
      console.log(`  ✅ en.ts: ${key} fixed`);
    } else {
      console.log(`  ❌ en.ts: ${key}: regex did not match`);
    }

    // Fix in JSON locale files too (only if locale has the wrong value)
    for (const file of localeFiles) {
      const data = localeData.get(file)!;
      if (data[key] === wrongValue) {
        data[key] = correctValue;
        writeJsonTranslations(file, data);
        console.log(`  ✅ ${file}: ${key} fixed`);
      }
    }
  }
}

// Reload en.ts after fixes (in-memory locale data is already updated above)
if (!DRY_RUN) {
  enTranslations = getEnglishTranslations();
}

// ---------------------------------------------------------------------------
// Phase 1: Analyze all dedup pairs
// ---------------------------------------------------------------------------
console.log(`\n🔍 Phase 1: Analyzing ${DEDUP_PAIRS.length} dedup pairs\n`);

// Deduplicate pairs
const seenPairs = new Set<string>();
const uniquePairs: [string, string][] = [];
for (const [from, to] of DEDUP_PAIRS) {
  const pairKey = `${from}→${to}`;
  if (!seenPairs.has(pairKey)) {
    seenPairs.add(pairKey);
    uniquePairs.push([from, to]);
  }
}

type PairResult =
  | { status: 'skip_no_from_in_en' }
  | { status: 'skip_no_to_in_en' }
  | { status: 'skip_value_mismatch_en'; fromVal: string; toVal: string }
  | { status: 'full_consolidate'; enValue: string }
  | { status: 'en_only_remove'; enValue: string }
  | { status: 'skip_json_mismatch'; mismatches: string[] }
  | { status: 'skip_missing_to_in_json'; missing: string[] };

const pairResults: Map<string, PairResult> = new Map();

for (const [from, to] of uniquePairs) {
  const fromVal = enTranslations.get(from);
  const toVal = enTranslations.get(to);

  if (fromVal === undefined) {
    pairResults.set(`${from}→${to}`, { status: 'skip_no_from_in_en' });
    continue;
  }
  if (toVal === undefined) {
    pairResults.set(`${from}→${to}`, { status: 'skip_no_to_in_en' });
    continue;
  }
  if (fromVal !== toVal) {
    pairResults.set(`${from}→${to}`, { status: 'skip_value_mismatch_en', fromVal, toVal });
    continue;
  }

  const mismatches: string[] = [];
  const missingTo: string[] = [];
  let fromExistsInAnyJson = false;

  for (const file of localeFiles) {
    const data = localeData.get(file)!;
    const fromJsonVal = data[from];
    const toJsonVal = data[to];

    if (fromJsonVal !== undefined) fromExistsInAnyJson = true;

    if (fromJsonVal !== undefined && toJsonVal === undefined) {
      missingTo.push(`${file} (from="${fromJsonVal}" but to is absent)`);
    } else if (fromJsonVal !== undefined && toJsonVal !== undefined && fromJsonVal !== toJsonVal) {
      mismatches.push(`${file}: from="${fromJsonVal}" to="${toJsonVal}"`);
    }
  }

  if (mismatches.length > 0) {
    pairResults.set(`${from}→${to}`, { status: 'skip_json_mismatch', mismatches });
  } else if (missingTo.length > 0) {
    pairResults.set(`${from}→${to}`, { status: 'skip_missing_to_in_json', missing: missingTo });
  } else if (!fromExistsInAnyJson) {
    pairResults.set(`${from}→${to}`, { status: 'en_only_remove', enValue: fromVal });
  } else {
    pairResults.set(`${from}→${to}`, { status: 'full_consolidate', enValue: fromVal });
  }
}

const fullConsolidate: [string, string][] = [];
const enOnlyRemove: [string, string][] = [];
const skippedPairs: [string, string, PairResult][] = [];

for (const [from, to] of uniquePairs) {
  const result = pairResults.get(`${from}→${to}`)!;
  if (result.status === 'full_consolidate') fullConsolidate.push([from, to]);
  else if (result.status === 'en_only_remove') enOnlyRemove.push([from, to]);
  else skippedPairs.push([from, to, result]);
}

console.log(`  ✅ Full consolidation (en.ts + JSON): ${fullConsolidate.length}`);
console.log(`  📝 en.ts-only removal (not in JSON):  ${enOnlyRemove.length}`);
console.log(`  ⚠️  Skipped:                           ${skippedPairs.length}`);

if (skippedPairs.length > 0) {
  console.log('\n  Skipped details:');
  for (const [from, to, result] of skippedPairs) {
    console.log(`    ${from} → ${to}  [${result.status}]`);
    if (result.status === 'skip_value_mismatch_en') {
      console.log(`      from="${result.fromVal}"  to="${result.toVal}"`);
    } else if (result.status === 'skip_json_mismatch') {
      for (const m of result.mismatches) console.log(`      ${m}`);
    } else if (result.status === 'skip_missing_to_in_json') {
      for (const m of result.missing) console.log(`      ${m}`);
    }
  }
}

if (DRY_RUN) {
  console.log('\n🔍 Dry run complete. No files modified.\n');
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Phase 2: Execute consolidations
// ---------------------------------------------------------------------------
console.log('\n\n🚀 Phase 2: Executing consolidations\n');

for (const [from] of fullConsolidate) {
  const removed = removeFromEnTs(from);
  console.log(`  ${removed ? '✅' : '⚠️ '} en.ts: removed '${from}'`);

  for (const file of localeFiles) {
    const data = localeData.get(file)!;
    delete data[from];
  }
}

// Write each locale file once after all deletions
for (const file of localeFiles) {
  writeJsonTranslations(file, localeData.get(file)!);
}

for (const [from] of enOnlyRemove) {
  const removed = removeFromEnTs(from);
  console.log(`  ${removed ? '✅' : '⚠️ '} en.ts-only: removed '${from}'`);
}

// ---------------------------------------------------------------------------
// Phase 3: Update source code call sites
// ---------------------------------------------------------------------------
console.log('\n\n🔄 Phase 3: Updating source code call sites\n');

const allPairs = [...fullConsolidate, ...enOnlyRemove];
for (const [from, to] of allPairs) {
  const count = replaceKeyInSourceFiles(from, to);
  if (count > 0) {
    console.log(`  ✅ '${from}' → '${to}' (${count} file${count !== 1 ? 's' : ''})`);
  } else {
    console.log(`  -  '${from}' → '${to}' (no source references found)`);
  }
}

console.log(`\n✅ Done! Processed ${allPairs.length} key pairs.`);
console.log('\nNext steps:');
console.log('  npm run check:i18n');
console.log('  npm run check:i18n:unused');
console.log('  npm run check:i18n:values');
