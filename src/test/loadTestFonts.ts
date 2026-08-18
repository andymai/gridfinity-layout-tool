/**
 * Register the bundled faces a generator test needs.
 *
 * Centralised because the set is not obvious from any one test: the design
 * DEFAULTS now use `atkinson-bold`, so a test that only loads the regular cut
 * silently produces no text at all rather than failing loudly, and through-cut
 * silently swaps to the stencil whatever the pick. Loading the three faces a
 * default design can reach keeps that failure mode out of every suite.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadFont } from 'brepjs';
import { isErr } from '@/core/result';

const FONT_DIR = resolve(import.meta.dirname, '..', 'shared', 'fonts', 'assets');

const FILES: Record<string, string> = {
  atkinson: 'AtkinsonHyperlegible-Regular.ttf',
  'atkinson-bold': 'AtkinsonHyperlegible-Bold.ttf',
  'jetbrains-mono': 'JetBrainsMono-Regular.ttf',
  'jetbrains-mono-bold': 'JetBrainsMono-Bold.ttf',
  'barlow-condensed': 'BarlowCondensed-SemiBold.ttf',
  poppins: 'Poppins-SemiBold.ttf',
  'allerta-stencil': 'AllertaStencil-Regular.ttf',
};

/** Faces a design using the shipped defaults can reach. */
export const DEFAULT_TEST_FONTS = ['atkinson', 'atkinson-bold', 'allerta-stencil'] as const;

export async function loadTestFonts(
  families: readonly string[] = DEFAULT_TEST_FONTS
): Promise<void> {
  for (const family of families) {
    const file = FILES[family];
    if (!file) throw new Error(`No bundled file for font family "${family}"`);
    const buffer = readFileSync(resolve(FONT_DIR, file));
    const result = await loadFont(
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
      family
    );
    if (isErr(result)) throw new Error(`Font load failed for ${family}: ${result.error.message}`);
  }
}
