import { createContentLoader } from 'vitepress';

export interface Capture {
  readonly alt: string;
}

declare const data: Record<string, Capture>;
export { data };

const SCREENSHOT_TAG = /<Screenshot\s[^>]*\/>/g;
const ATTRIBUTE = /\b(id|alt)="([^"]*)"/g;

// An answer names a capture by id alone; the panel takes its alt text from the page that shows it.
export default createContentLoader('**/*.md', {
  includeSrc: true,
  transform(pages): Record<string, Capture> {
    const captures: Record<string, Capture> = {};
    for (const page of pages) {
      for (const [tag] of (page.src ?? '').matchAll(SCREENSHOT_TAG)) {
        const attrs = new Map([...tag.matchAll(ATTRIBUTE)].map(([, key, value]) => [key, value]));
        const id = attrs.get('id');
        const alt = attrs.get('alt');
        if (id && alt) captures[id] = { alt };
      }
    }
    return captures;
  },
});
