// Resolve gallery thumbnails to bundled, hashed URLs. A raw '/src/...png' path
// is a filesystem location, not a servable URL — only assets Vite sees (imported
// or via import.meta.glob) get emitted, so string paths 404 at runtime.
const modules: Record<string, string> = import.meta.glob('./thumbnails/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
});

const URL_BY_ID: Record<string, string> = {};
for (const [path, url] of Object.entries(modules)) {
  const file = path.split('/').pop() ?? '';
  const id = file.replace(/\.png$/, '');
  if (id) URL_BY_ID[id] = url;
}

/** Bundled URL for an example's thumbnail, or undefined if no asset is committed. */
export function thumbnailUrl(id: string): string | undefined {
  return URL_BY_ID[id];
}
