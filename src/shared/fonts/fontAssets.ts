/**
 * Bundled type faces, as Vite-resolved asset URLs.
 *
 * Shared rather than worker-local because two environments load the same
 * files: the generation worker registers them with the kernel to build glyph
 * solids, and the designer registers them on the main thread to measure the
 * ghost overlay. Measuring against a different face than the one the geometry
 * is cut from is exactly the drift a single source of truth prevents.
 *
 * Every face is OFL; its licence text sits beside it in `assets/`.
 */

import type { TextFontFamily } from '@/shared/types/bin';
import atkinsonUrl from './assets/AtkinsonHyperlegible-Regular.ttf?url';
import atkinsonBoldUrl from './assets/AtkinsonHyperlegible-Bold.ttf?url';
import jetbrainsMonoUrl from './assets/JetBrainsMono-Regular.ttf?url';
import jetbrainsMonoBoldUrl from './assets/JetBrainsMono-Bold.ttf?url';
import barlowCondensedUrl from './assets/BarlowCondensed-SemiBold.ttf?url';
import poppinsUrl from './assets/Poppins-SemiBold.ttf?url';
import allertaStencilUrl from './assets/AllertaStencil-Regular.ttf?url';

export const TEXT_FONT_URLS: Record<TextFontFamily, string> = {
  atkinson: atkinsonUrl,
  'atkinson-bold': atkinsonBoldUrl,
  'jetbrains-mono': jetbrainsMonoUrl,
  'jetbrains-mono-bold': jetbrainsMonoBoldUrl,
  'barlow-condensed': barlowCondensedUrl,
  poppins: poppinsUrl,
  'allerta-stencil': allertaStencilUrl,
};
