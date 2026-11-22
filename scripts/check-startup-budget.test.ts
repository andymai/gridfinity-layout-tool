import { describe, expect, it } from 'vitest';
import { budgetErrors, startupFiles } from './check-startup-budget';

const HTML = `<!doctype html><html><head>
<script type="application/ld+json">{"@type":"WebApplication"}</script>
<script>window.inline = true</script>
<script type="module" crossorigin src="/assets/main-abc.js"></script>
<link rel="modulepreload" crossorigin href="/assets/react-vendor-def.js">
<link rel="modulepreload" crossorigin href="/assets/startup-vendor-ghi.js">
<link rel="stylesheet" crossorigin href="/assets/index-jkl.css">
<link rel="preload" href="/fonts/inter-var-latin.woff2" as="font">
<script defer src="/_vercel/insights/script.js"></script>
</head><body><div id="root"></div></body></html>`;

describe('startupFiles', () => {
  it('reads the module entry and every modulepreload, and nothing else', () => {
    expect(startupFiles(HTML)).toEqual([
      'assets/main-abc.js',
      'assets/react-vendor-def.js',
      'assets/startup-vendor-ghi.js',
    ]);
  });

  it('reads attributes in any order and counts a file once', () => {
    const html =
      '<script src="/assets/main-abc.js" type="module"></script>' +
      '<link href="/assets/main-abc.js" rel="modulepreload">';
    expect(startupFiles(html)).toEqual(['assets/main-abc.js']);
  });
});

describe('budgetErrors', () => {
  const budget = { gzipKb: 640, files: 8 };

  it('passes a build inside both limits', () => {
    expect(budgetErrors({ gzipBytes: 640_000, files: 8 }, budget)).toEqual([]);
  });

  it('names each limit that a build passes', () => {
    expect(budgetErrors({ gzipBytes: 680_400, files: 142 }, budget)).toEqual([
      '142 startup JS files, over the limit of 8',
      '680.4 kB of startup JS (gzip), over the limit of 640 kB',
    ]);
  });
});
