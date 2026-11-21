import { Marked } from 'marked';
import type { Tokens } from 'marked';

export type Segment = { kind: 'html'; html: string } | { kind: 'capture'; id: string };

const SITE = 'https://gridfinitylayouttool.com';
const MAX_CAPTURES = 2;
const CAPTURE_LINE = /^\s*\[\[capture:([A-Za-z0-9._-]+)\]\]\s*$/;
const CHIP = /\[\[ui:([^\]]+)\]\]/g;
// A marker that the stream has not finished yet, at the very end of the text.
const OPEN_MARKER = /\[\[[^\]]*\]?$/;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** A docs page on this site as a path that the router can open, or null. */
export function docsPath(href: string): string | null {
  const local = href.startsWith(SITE) ? href.slice(SITE.length) : href;
  return /^\/docs(?:[/?#]|$)/.test(local) ? local : null;
}

function safeHref(href: string): string | null {
  if (docsPath(href)) return docsPath(href);
  if (/^https?:\/\//i.test(href)) return href;
  return null;
}

// The answer is model output, so no raw HTML goes through but <kbd>, and a
// link goes through only to the web or to this site.
const marked = new Marked({
  gfm: true,
  renderer: {
    html({ text }: Tokens.HTML | Tokens.Tag): string {
      return /^<\/?kbd>$/i.test(text.trim()) ? text.trim().toLowerCase() : escapeHtml(text);
    },
    link(
      this: { parser: { parseInline(tokens: Tokens.Link['tokens']): string } },
      token: Tokens.Link
    ): string {
      const label = this.parser.parseInline(token.tokens);
      const href = safeHref(token.href);
      if (!href) return label;
      const docs = docsPath(href);
      return docs
        ? `<a href="${escapeHtml(docs)}" data-docs-link>${label}</a>`
        : `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    },
    image({ text }: Tokens.Image): string {
      return escapeHtml(text);
    },
  },
});

// A chip is a token of its own, so a marker can only become one in text,
// never inside a link target or another attribute.
marked.use({
  extensions: [
    {
      name: 'uiChip',
      level: 'inline',
      start: (src: string) => {
        const at = src.indexOf('[[ui:');
        return at < 0 ? undefined : at;
      },
      tokenizer: (src: string) => {
        const match = /^\[\[ui:([^\]]+)\]\]/.exec(src);
        return match ? { type: 'uiChip', raw: match[0], label: match[1] } : undefined;
      },
      renderer: (token) => `<span class="ui-label">${escapeHtml(String(token.label))}</span>`,
    },
  ],
});

function renderMarkdown(text: string): string {
  return marked.parse(text, { async: false });
}

/**
 * An answer as HTML runs and the captures between them. While the answer
 * streams, an unfinished marker at its end stays hidden, so `[[ca` never
 * flashes up as text.
 */
export function answerSegments(
  text: string,
  options: { streaming: boolean; isCapture: (id: string) => boolean }
): Segment[] {
  const source = options.streaming ? text.replace(OPEN_MARKER, '') : text;
  const segments: Segment[] = [];
  let lines: string[] = [];
  let captures = 0;
  const flush = (): void => {
    const markdown = lines.join('\n');
    if (markdown.trim()) segments.push({ kind: 'html', html: renderMarkdown(markdown) });
    lines = [];
  };
  for (const line of source.split('\n')) {
    const id = CAPTURE_LINE.exec(line)?.[1];
    if (id === undefined) {
      lines.push(line);
      continue;
    }
    if (!options.isCapture(id) || captures >= MAX_CAPTURES) continue;
    flush();
    segments.push({ kind: 'capture', id });
    captures++;
  }
  flush();
  return segments;
}

/** The answer as plain text for the clipboard. */
export function plainAnswer(text: string): string {
  return text
    .split('\n')
    .filter((line) => !CAPTURE_LINE.test(line))
    .join('\n')
    .replace(CHIP, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
