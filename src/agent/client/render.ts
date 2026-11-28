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

/**
 * Labels that the panel can show in the app. A label for which `showMe` is
 * true renders as a button that carries the label in `data-show-me`.
 */
export interface ShowMe {
  readonly showMe: (label: string) => boolean;
  /** The button's tooltip, in the reader's language. */
  readonly title: string;
}

function uiChip(chips: ShowMe | null) {
  return {
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
    renderer: (token: Tokens.Generic) => {
      const label = escapeHtml(String(token.label));
      return chips?.showMe(String(token.label))
        ? `<button type="button" class="ui-label ui-label-show" data-show-me="${label}" title="${escapeHtml(chips.title)}">${label}</button>`
        : `<span class="ui-label">${label}</span>`;
    },
  };
}

// The answer is model output, so no raw HTML goes through but <kbd>, and a
// link goes through only to the web or to this site. Once a turn holds the
// reader's own data, only links to this site go through, so a crafted label
// cannot make the model write a link that carries the data away.
function createMarked(siteLinksOnly: boolean, chips: ShowMe | null, copyLabel: string): Marked {
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
        return `<div class="code-block"><button type="button" class="copy-code" data-copy-code>${escapeHtml(copyLabel)}</button><pre><code>${escapeHtml(text)}</code></pre></div>`;
      },
    },
  });
  // A chip is a token of its own, so a marker can only become one in text,
  // never inside a link target or another attribute.
  instance.use({ extensions: [uiChip(chips)] });
  return instance;
}

const NO_CHIPS = {};
const instances = new WeakMap<object, Map<string, Marked>>();

// One parser for each set of options, so a panel that passes the same ShowMe
// object on each render does not build a parser on each render.
function markedFor(siteLinksOnly: boolean, chips: ShowMe | null, copyLabel: string): Marked {
  const owner = chips ?? NO_CHIPS;
  let byOptions = instances.get(owner);
  if (!byOptions) {
    byOptions = new Map();
    instances.set(owner, byOptions);
  }
  const key = `${String(siteLinksOnly)}|${copyLabel}`;
  let instance = byOptions.get(key);
  if (!instance) {
    instance = createMarked(siteLinksOnly, chips, copyLabel);
    byOptions.set(key, instance);
  }
  return instance;
}

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
    showMe?: ShowMe;
    /** The text of each code block's copy button. */
    copyLabel?: string;
  }
): Segment[] {
  const marked = markedFor(
    options.siteLinksOnly === true,
    options.showMe ?? null,
    options.copyLabel ?? 'Copy'
  );
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
