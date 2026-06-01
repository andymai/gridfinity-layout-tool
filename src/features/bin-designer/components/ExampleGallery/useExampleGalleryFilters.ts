import type { ExampleDesign, ExampleTechnique } from '@/features/bin-designer/types/exampleGallery';

export interface GalleryFilters {
  search: string;
  technique: ExampleTechnique | null;
}

export function filterExamples(
  examples: readonly ExampleDesign[],
  f: GalleryFilters
): ExampleDesign[] {
  const q = f.search.trim().toLowerCase();
  return examples.filter((e) => {
    if (f.technique && !e.techniques.includes(f.technique)) return false;
    if (q) {
      const hay = [e.id, ...e.tags].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
