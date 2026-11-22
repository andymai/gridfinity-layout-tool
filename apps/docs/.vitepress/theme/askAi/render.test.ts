import { describe, expect, it } from 'vitest';
import { answerSegments, docsPath, plainAnswer } from './render';

const isCapture = (id: string): boolean => id.startsWith('shot');
const html = (text: string, streaming = false): string =>
  answerSegments(text, { streaming, isCapture })
    .map((s) => (s.kind === 'html' ? s.html : `[capture ${s.id}]`))
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
    expect(answerSegments(text, { streaming: false, isCapture }).map((s) => s.kind)).toEqual([
      'html',
      'capture',
      'html',
      'capture',
    ]);
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
