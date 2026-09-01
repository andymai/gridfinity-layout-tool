import { meshUrl } from '@/features/bin-designer/data/examples/meshes';
import { thumbnailUrl } from '@/features/bin-designer/data/examples/thumbnails';
import { GradientBackground } from '@/features/bin-designer/components/preview/GradientBackground/GradientBackground';
import type { ExampleDesign } from '@/features/bin-designer/types/exampleGallery';
import { GlbViewer } from '@/shared/components/GlbViewer';
import { useTranslation } from '@/i18n';

interface Example3DViewerProps {
  example: ExampleDesign;
}

export function Example3DViewer({ example }: Example3DViewerProps) {
  const t = useTranslation();
  const url = meshUrl(example.id);
  const thumb = thumbnailUrl(example.id) ?? '';

  if (!url) {
    return (
      <img
        src={thumb}
        alt={t(example.nameKey)}
        className="max-w-full max-h-[40vh] object-contain"
      />
    );
  }

  return (
    <div className="relative w-full" style={{ aspectRatio: '1 / 1', maxHeight: '40vh' }}>
      {/* Always hosted in ExamplePreviewOverlay (a dialog over the designer's live
          preview), so claim the puck or it keeps driving the canvas behind. */}
      <GlbViewer
        meshUrl={url}
        posterUrl={thumb}
        alt={t(example.nameKey)}
        className="h-full w-full"
        modal
      >
        {/* Bin-designer-local 2-stop gradient, same one the thumbnails were captured with. */}
        <GradientBackground />
      </GlbViewer>
    </div>
  );
}
