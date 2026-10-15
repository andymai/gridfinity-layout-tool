import { describe, expect, it } from 'vitest';
import { CONTENT_IMAGE_SIZES, renderContentImage, webpVariants } from './contentImage';

const landing = '/images/landing/drawer-ikea-alex-baseplate.png';
const allFiles = (): boolean => true;
const noFiles = (): boolean => false;

describe('webpVariants', () => {
  it('maps a landing PNG to its 720 and 1440 WebP variants', () => {
    expect(webpVariants(landing)).toEqual([
      '/images/landing/drawer-ikea-alex-baseplate-720.webp',
      '/images/landing/drawer-ikea-alex-baseplate-1440.webp',
    ]);
  });

  it.each(['/og/gridfinity-drawers.png', '/images/landing/photo.jpg', 'https://example.com/a.png'])(
    'leaves %s alone',
    (href) => {
      expect(webpVariants(href)).toBeNull();
    }
  );
});

describe('renderContentImage', () => {
  it('loads the first image eagerly at high priority', () => {
    const html = renderContentImage(
      { href: landing, title: '1200x675', alt: 'Alex', first: true },
      noFiles
    );
    expect(html).toContain('loading="eager" fetchpriority="high"');
    expect(html).not.toContain('loading="lazy"');
  });

  it('keeps later images lazy', () => {
    const html = renderContentImage(
      { href: landing, title: '1200x675', alt: 'Alex', first: false },
      noFiles
    );
    expect(html).toContain('loading="lazy"');
    expect(html).not.toContain('fetchpriority');
  });

  it('carries intrinsic dimensions from the title slot', () => {
    const html = renderContentImage(
      { href: landing, title: '1200x675', alt: 'Alex', first: false },
      noFiles
    );
    expect(html).toContain('width="1200" height="675"');
  });

  it('serves WebP through <picture> with the PNG as fallback when both variants exist', () => {
    const html = renderContentImage(
      { href: landing, title: '1200x675', alt: 'Alex', first: true },
      allFiles
    );
    expect(html).toMatch(/^<picture><source type="image\/webp"/);
    expect(html).toContain(
      'srcset="/images/landing/drawer-ikea-alex-baseplate-720.webp 720w, /images/landing/drawer-ikea-alex-baseplate-1440.webp 1440w"'
    );
    expect(html).toContain(`sizes="${CONTENT_IMAGE_SIZES}"`);
    expect(html).toContain(`src="${landing}"`);
    expect(html).toMatch(/<\/picture>$/);
  });

  it('falls back to the plain image when a variant is missing', () => {
    const only720 = (p: string): boolean => p.endsWith('-720.webp');
    const html = renderContentImage(
      { href: landing, title: null, alt: 'Alex', first: false },
      only720
    );
    expect(html).toMatch(/^<img /);
  });

  it('escapes alt text', () => {
    const html = renderContentImage(
      { href: landing, title: null, alt: 'Bins "6 by 7" <grid>', first: false },
      noFiles
    );
    expect(html).toContain('alt="Bins &quot;6 by 7&quot; &lt;grid&gt;"');
  });
});
