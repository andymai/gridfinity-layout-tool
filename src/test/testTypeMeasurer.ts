/**
 * A type measurer over the real bundled faces, for main-thread code that plans
 * text without the kernel. Loads through `brepjs/text`, the same entry the
 * app's font registry uses, so a test measures what the page measures.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getFont, loadFont } from 'brepjs/text';
import { TEXT_FONT_FILES } from './loadTestFonts';
import { createTypeMeasurer } from '@/shared/utils/typePlan';
import type { GlyphFont, TypeMeasurer } from '@/shared/utils/typePlan';
import type { TextFontFamily } from '@/shared/types/bin';

const FONT_DIR = resolve(import.meta.dirname, '..', 'shared', 'fonts', 'assets');

export async function loadTestTypeMeasurer(
  families: readonly TextFontFamily[]
): Promise<TypeMeasurer> {
  for (const family of families) {
    const buffer = readFileSync(resolve(FONT_DIR, TEXT_FONT_FILES[family]));
    const result = await loadFont(
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
      family
    );
    if (!result.ok) throw new Error(`Font load failed for ${family}`);
  }
  return createTypeMeasurer((family) => getFont(family) as GlyphFont | undefined);
}
