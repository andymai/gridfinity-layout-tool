/**
 * Markup for a content-page image: `![alt](src "WxH")` in the markdown.
 *
 * The first image on a page is usually its largest paint, so it loads eagerly
 * at high priority; the rest stay lazy. A PNG under /images/landing/ with
 * WebP variants beside it (`<name>-720.webp`, `<name>-1440.webp`, made by
 * `pnpm run gen:webp`) is served through `<picture>`, keeping the PNG as the
 * fallback, so a missing variant degrades to the plain image.
 */

/** Widths the content column needs: 1x and 2x of its 720px max. */
export const WEBP_WIDTHS = [720, 1440] as const;

export const CONTENT_IMAGE_SIZES = '(max-width: 760px) 100vw, 720px';

export interface ContentImage {
  readonly href: string;
  readonly title: string | null;
  readonly alt: string;
  readonly first: boolean;
}

const escapeAttr = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function webpVariants(href: string): readonly string[] | null {
  const match = /^(\/images\/landing\/[\w-]+)\.png$/.exec(href);
  if (match === null) return null;
  const [, stem] = match;
  return WEBP_WIDTHS.map((width) => `${stem}-${width}.webp`);
}

export function renderContentImage(
  image: ContentImage,
  hasFile: (publicPath: string) => boolean
): string {
  const dims = image.title?.match(/^(\d+)x(\d+)$/);
  const sizeAttrs = dims ? ` width="${dims[1]}" height="${dims[2]}"` : '';
  const loading = image.first ? ' loading="eager" fetchpriority="high"' : ' loading="lazy"';
  const img = `<img class="content-img" src="${escapeAttr(image.href)}" alt="${escapeAttr(image.alt)}"${sizeAttrs}${loading} decoding="async">`;

  const variants = webpVariants(image.href);
  if (variants === null || !variants.every(hasFile)) return img;

  const srcset = variants.map((path, i) => `${path} ${WEBP_WIDTHS[i]}w`).join(', ');
  return `<picture><source type="image/webp" srcset="${srcset}" sizes="${CONTENT_IMAGE_SIZES}">${img}</picture>`;
}
