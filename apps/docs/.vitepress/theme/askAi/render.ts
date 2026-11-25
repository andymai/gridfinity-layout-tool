import { Marked } from 'marked';
import type { Tokens } from 'marked';

export type Segment =
  | { kind: 'html'; html: string }
  | { kind: 'capture'; id: string }
  | { kind: 'plan'; handle: string };

const SITE = 'https://gridfinitylayouttool.com';
const MAX_CAPTURES = 2;
const CAPTURE_LINE = /^\s*\[\[capture:([A-Za-z0-9._-]+)\]\]\s*$/;
const PLAN_LINE = /^\s*\[\[plan:([0-9a-f]{8})\]\]\s*$/;
const CHIP = /\[\[ui:([^\]]+)\]\]/g;
const OPEN_MARKER = /\[\[[^\]]*\]?$/;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function docsPath(href: string): string | null {
  const local = href.startsWith(SITE) ? href.slice(SITE.length) : href;
  return /^\/docs(?:[/?#]|$)/.test(local) ? local : null;
}

function onSite(href: string): boolean {
  try {
    return new URL(href).origin === SITE;
  } catch {
    return false;
  }
}

const uiChip = {
  name: 'uiChip',
  level: 'inline' as const,
  start: (src: string) => {
    const at = src.indexOf('[[ui:');
    return at < 0 ? undefined : at;
  },
  tokenizer: (src: string) => {
    const match = /^\[\[ui:([^\]]+)\]\]/.exec(src);
    return match ? { type: 'uiChip', raw: match[0], label: match[1] } : undefined;
  },
  renderer: (token: Tokens.Generic) =>
    `<span class="ui-label">${escapeHtml(String(token.label))}</span>`,
};

// The answer is model output, so no raw HTML goes through but <kbd>, and a
// link goes through only to the web or to this site. Once a turn holds the
// reader's own data, only links to this site go through, so a crafted label
// cannot make the model write a link that carries the data away.
function createMarked(siteLinksOnly: boolean): Marked {
  const instance = new Marked({
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
        const docs = docsPath(token.href);
        if (docs) return `<a href="${escapeHtml(docs)}" data-docs-link>${label}</a>`;
        if (!/^https?:\/\//i.test(token.href)) return label;
        if (siteLinksOnly && !onSite(token.href)) return label;
        return `<a href="${escapeHtml(token.href)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
      },
      image({ text }: Tokens.Image): string {
        return escapeHtml(text);
      },
      code({ text }: Tokens.Code): string {
        return `<div class="code-block"><button type="button" class="copy-code" data-copy-code>Copy</button><pre><code>${escapeHtml(text)}</code></pre></div>`;
      },
    },
  });
  // A chip is a token of its own, so a marker can only become one in text,
  // never inside a link target or another attribute.
  instance.use({ extensions: [uiChip] });
  return instance;
}

const markedAll = createMarked(false);
const markedSite = createMarked(true);

/**
 * An answer as HTML runs and the captures between them. While the answer
 * streams, an unfinished marker at its end stays hidden, so `[[ca` never
 * flashes up as text.
 */
export function answerSegments(
  text: string,
  options: {
    streaming: boolean;
    isCapture: (id: string) => boolean;
    isPlan: (handle: string) => boolean;
    /** The turn holds the reader's own data: links go only to this site. */
    siteLinksOnly?: boolean;
  }
): Segment[] {
  const marked = options.siteLinksOnly === true ? markedSite : markedAll;
  const source = options.streaming ? text.replace(OPEN_MARKER, '') : text;
  const segments: Segment[] = [];
  let lines: string[] = [];
  let captures = 0;
  const flush = (): void => {
    const markdown = lines.join('\n');
    if (markdown.trim()) {
      segments.push({ kind: 'html', html: marked.parse(markdown, { async: false }) });
    }
    lines = [];
  };
  for (const line of source.split('\n')) {
    const handle = PLAN_LINE.exec(line)?.[1];
    if (handle !== undefined) {
      if (!options.isPlan(handle)) continue;
      flush();
      segments.push({ kind: 'plan', handle });
      continue;
    }
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

export function plainAnswer(text: string): string {
  return text
    .split('\n')
    .filter((line) => !CAPTURE_LINE.test(line) && !PLAN_LINE.test(line))
    .join('\n')
    .replace(CHIP, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
