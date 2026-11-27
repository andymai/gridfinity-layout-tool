import sample from './sample/sample.json';
import type { SampleSource } from '../utils/sampleYear';

// `?url` keeps only hashed URL strings in the bundle; the bytes load when the
// sample plays.
const thumbnails: Record<string, string> = import.meta.glob('./sample/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
});
const meshes: Record<string, string> = import.meta.glob('./sample/meshes.glb', {
  eager: true,
  query: '?url',
  import: 'default',
});

export const SAMPLE_SOURCE: SampleSource = sample;

export function sampleThumbnail(id: string): string | null {
  return thumbnails[`./sample/${id}.webp`] ?? null;
}

export function sampleMeshesUrl(): string {
  const url = meshes['./sample/meshes.glb'];
  if (!url) throw new Error('Missing baked sample meshes');
  return url;
}
