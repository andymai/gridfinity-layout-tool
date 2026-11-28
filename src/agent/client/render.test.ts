import { describe, expect, it } from 'vitest';
import { answerSegments, docsPath, plainAnswer } from './render';
import type { ShowMe } from './render';

const isCapture = (id: string): boolean => id.startsWith('shot');
const html = (text: string, streaming = false): string =>
  answerSegments(text, { streaming, isCapture, isPlan: (handle) => handle === '0a1b2c3d' })
    .map((s) =>
      s.kind === 'html' ? s.html : s.kind === 'capture' ? `[capture ${s.id}]` : `[plan ${s.handle}]`
    )
    .join('');

describe('answerSegments', () => {
  it('draws labels as chips and keeps <kbd>', () => {
    expect(html('Click [[ui:Fit grid]], then press <kbd>Enter</kbd>.')).toBe(
      '<p>Click <span class="ui-label">Fit grid</span>, then press <kbd>Enter</kbd>.</p>\n'
    );
  });

  it('leaves a marker inside a link target alone', () => {
    const out = html(
      '[Fit](https://gridfinitylayouttool.com/docs/x?q=[[ui:Fit]]) and [[ui:Grid <b>]]'
    );
    expect(out).toContain('data-docs-link');
    expect(out).not.toMatch(/href="[^"]*<span/);
    expect(out).toContain('<span class="ui-label">Grid &lt;b&gt;</span>');
  });

  it('puts a copy button on a code block, and escapes the code', () => {
    const out = html('```\ndocker run <image>\n```');
    expect(out).toContain('data-copy-code');
    expect(out).toContain('<pre><code>docker run &lt;image&gt;</code></pre>');
  });

  it('escapes every other tag in the answer', () => {
    const out = html('Hi <script>alert(1)</script> <img src=x onerror=alert(1)> <b>bold</b>');
    expect(out).not.toMatch(/<script|<img|<b>/);
    expect(out).toContain('&lt;script&gt;');
  });

  it('opens docs links in the site and other links in a new tab, and drops other schemes', () => {
    const out = html(
      '[Split](https://gridfinitylayouttool.com/docs/baseplates/splitting#lock) [Forum](https://github.com/x) [Bad](javascript:alert(1)) ![pic](https://x/y.png)'
    );
    expect(out).toContain('<a href="/docs/baseplates/splitting#lock" data-docs-link>Split</a>');
    expect(out).toContain(
      '<a href="https://github.com/x" target="_blank" rel="noopener noreferrer">Forum</a>'
    );
    expect(out).not.toContain('javascript:');
    expect(out).toContain('Bad');
    expect(out).not.toContain('<img');
  });

  it('cuts the answer at each known capture, and keeps at most two', () => {
    const text =
      'One.\n\n[[capture:shot-a]]\n\nTwo.\n[[capture:other]]\n[[capture:shot-b]]\n[[capture:shot-c]]';
    expect(
      answerSegments(text, { streaming: false, isCapture, isPlan: () => false }).map((s) => s.kind)
    ).toEqual(['html', 'capture', 'html', 'capture']);
  });

  it('hides a marker that is still streaming in', () => {
    expect(html('Click [[ui:Fit', true)).toBe('<p>Click </p>\n');
    expect(html('Done.\n[[capt', true)).toBe('<p>Done.</p>\n');
  });
});

describe('docsPath', () => {
  it('turns a docs URL into a site path and leaves the rest', () => {
    expect(docsPath('https://gridfinitylayouttool.com/docs')).toBe('/docs');
    expect(docsPath('/docs/a#b')).toBe('/docs/a#b');
    expect(docsPath('https://gridfinitylayouttool.com/designer')).toBeNull();
    expect(docsPath('/docsx')).toBeNull();
  });
});

it('copies an answer as plain text', () => {
  expect(plainAnswer('Click [[ui:Fit grid]].\n\n[[capture:shot-a]]\n\n\nDone.')).toBe(
    'Click Fit grid.\n\nDone.'
  );
});

describe('plans in an answer', () => {
  it('draws a known plan on its own line and drops an unknown one', () => {
    const text =
      'Here is your drawer.\n\n[[plan:0a1b2c3d]]\n\n[[plan:ffffffff]]\n\nOpen it to edit.';
    const segments = answerSegments(text, {
      streaming: false,
      isCapture: () => false,
      isPlan: (handle) => handle === '0a1b2c3d',
    });
    expect(segments.map((s) => s.kind)).toEqual(['html', 'plan', 'html']);
    expect(segments[1]).toEqual({ kind: 'plan', handle: '0a1b2c3d' });
  });

  it('leaves the plan marker out of copied text', () => {
    expect(plainAnswer('Your drawer:\n[[plan:0a1b2c3d]]\nDone.')).toBe('Your drawer:\nDone.');
  });
});

describe("links after a read of the reader's data", () => {
  it('keeps links to this site and shows every other link as text', () => {
    const text =
      '[Plan](https://gridfinitylayouttool.com/#plan=v1.abc) [Docs](https://gridfinitylayouttool.com/docs/a) [Leak](https://evil.example/?d=Desk) https://evil.example/raw';
    const segment = answerSegments(text, {
      streaming: false,
      isCapture: () => false,
      isPlan: () => false,
      siteLinksOnly: true,
    })[0];
    const out = segment?.kind === 'html' ? segment.html : '';
    expect(out).toContain('href="https://gridfinitylayouttool.com/#plan=v1.abc"');
    expect(out).toContain('href="/docs/a"');
    expect(out).not.toContain('href="https://evil.example');
    expect(out).toContain('Leak');
  });
});

describe('show me', () => {
  const showMe: ShowMe = {
    showMe: (label: string) => label === 'Fit grid',
    title: 'Show it in the app',
  };
  const render = (text: string, chips = showMe): string =>
    answerSegments(text, {
      streaming: false,
      isCapture: () => false,
      isPlan: () => false,
      showMe: chips,
      copyLabel: 'Kopieren',
    })
      .map((s) => (s.kind === 'html' ? s.html : ''))
      .join('');

  it('turns a label with a target into a button that carries the label', () => {
    expect(render('Click [[ui:Fit grid]] or [[ui:Export]].')).toBe(
      '<p>Click <button type="button" class="ui-label ui-label-show" data-show-me="Fit grid" title="Show it in the app">Fit grid</button> or <span class="ui-label">Export</span>.</p>\n'
    );
  });

  it('escapes the label in the attribute, and words the copy button', () => {
    const html = render('[[ui:"><img src=x>]]', { showMe: () => true, title: 'x' });
    expect(html).not.toContain('<img');
    expect(html).toContain('data-show-me="&quot;&gt;&lt;img src=x&gt;"');
    expect(render('```\ncode\n```')).toContain('data-copy-code>Kopieren</button>');
  });
});
