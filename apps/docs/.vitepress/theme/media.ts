export type Theme = 'light' | 'dark';

export interface MediaEntry {
  kind: 'still' | 'clip';
  /** CSS px the capture was framed at; the files hold twice as many. */
  width: number;
  height: number;
}

const entries = import.meta.glob<MediaEntry>('../../media/*.json', {
  eager: true,
  import: 'default',
});

const urls = import.meta.glob<string>('../../media/*.{webp,mp4}', {
  eager: true,
  query: '?url',
  import: 'default',
});

export function mediaEntry(id: string): MediaEntry | undefined {
  return entries[`../../media/${id}.json`];
}

export function mediaUrl(id: string, theme: Theme, ext: 'webp' | 'mp4'): string {
  const url = urls[`../../media/${id}.${theme}.${ext}`];
  if (!url) throw new Error(`apps/docs/media has no ${id}.${theme}.${ext}`);
  return url;
}
