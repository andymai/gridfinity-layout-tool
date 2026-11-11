import { describe, expect, it } from 'vitest';
import { docsUrls, precacheUrls } from './copy-docs';

describe('precacheUrls', () => {
  it('reads the minified manifest that generateSW writes', () => {
    const sw =
      'define(["./workbox-fc82761a"],(function(s){s.precacheAndRoute([' +
      '{url:"assets/main-abc.js",revision:null},' +
      '{url:"index.html",revision:"0f3b6a1e"}],{}),' +
      's.registerRoute(new s.NavigationRoute(s.createHandlerBoundToURL("/index.html")))}));';
    expect(precacheUrls(sw)).toEqual(['assets/main-abc.js', 'index.html']);
  });

  it('reads quoted keys in either order', () => {
    const sw =
      'precacheAndRoute([{"revision":"abc","url":"index.html"}, {"url":"sw-icon.png"}], {})';
    expect(precacheUrls(sw)).toEqual(['index.html', 'sw-icon.png']);
  });

  it('stops at the end of the manifest', () => {
    const sw = 'precacheAndRoute([{url:"index.html",revision:"a"}],{});later({url:"docs/x.js"})';
    expect(precacheUrls(sw)).toEqual(['index.html']);
  });

  it('returns nothing when there is no manifest', () => {
    expect(precacheUrls('self.skipWaiting();')).toEqual([]);
    expect(precacheUrls('precacheAndRoute([],{})')).toEqual([]);
  });
});

describe('docsUrls', () => {
  it('keeps only URLs under the docs prefix, with or without a leading slash', () => {
    expect(
      docsUrls([
        'index.html',
        'docs/index.html',
        '/docs/assets/app.abc.js',
        'docsx/a.js',
        'assets/docs/a.js',
        'docs',
      ])
    ).toEqual(['docs/index.html', '/docs/assets/app.abc.js']);
  });
});
