import type { ExampleDesign, ExampleTechnique } from '@/features/bin-designer/types/exampleGallery';

export type GallerySort = 'recommended' | 'popular' | 'size' | 'complexity';

export interface GalleryFilters {
  search: string;
  technique: ExampleTechnique | null;
  sort: GallerySort;
  favoritesOnly: boolean;
  favoriteIds: readonly string[];
}

export function filterAndSortExamples(
  examples: readonly ExampleDesign[],
  f: GalleryFilters
): ExampleDesign[] {
  const q = f.search.trim().toLowerCase();
  const filtered = examples.filter((e) => {
    if (f.technique && !e.techniques.includes(f.technique)) return false;
    if (f.favoritesOnly && !f.favoriteIds.includes(e.id)) return false;
    if (q) {
      const hay = [e.id, ...e.tags].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const out = [...filtered];
  switch (f.sort) {
    case 'popular':
      out.sort((a, b) => Number(b.popular) - Number(a.popular));
      break;
    case 'size':
      out.sort((a, b) => a.params.width * a.params.depth - b.params.width * b.params.depth);
      break;
    case 'complexity':
      out.sort((a, b) => a.complexity - b.complexity);
      break;
    case 'recommended':
    default:
      break;
  }
  return out;
}
