// Resolve pre-generated gallery meshes to bundled, hashed URLs. As with
// thumbnails, only assets Vite sees (via import.meta.glob) get emitted, so a
// raw '/src/...glb' path would 404 at runtime. The `?url` query keeps only the
// URL string in the bundle — the GLB bytes are fetched on demand by the viewer.
const modules: Record<string, string> = import.meta.glob('./meshes/*.glb', {
  eager: true,
  query: '?url',
  import: 'default',
});

const URL_BY_ID: Record<string, string> = {};
for (const [path, url] of Object.entries(modules)) {
  const file = path.split('/').pop() ?? '';
  const id = file.replace(/\.glb$/, '');
  if (id) URL_BY_ID[id] = url;
}

/** Bundled URL for an example's pre-generated GLB, or undefined if none committed. */
export function meshUrl(id: string): string | undefined {
  return URL_BY_ID[id];
}
