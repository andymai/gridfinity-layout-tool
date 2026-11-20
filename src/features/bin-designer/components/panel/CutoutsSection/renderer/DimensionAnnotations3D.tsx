/**
 * WebGL dimension annotations for selected cutouts.
 *
 * Shows width and depth measurements as crisp HTML text overlays beside the
 * edges they measure. Only visible at high zoom levels to avoid clutter.
 */

import { Html } from '@react-three/drei';

import type { Cutout } from '@/features/bin-designer/types';
import { HTML_OVERLAY_Z_INDEX_RANGE } from './constants';
import { dimensionLabelPositions } from './dimensionLabels';

interface DimensionAnnotations3DProps {
  readonly cutouts: readonly Cutout[];
  readonly selection: ReadonlySet<string>;
  readonly preview: ReadonlyMap<string, Partial<Cutout>>;
  readonly zoom: number;
}

const MIN_ZOOM_TO_SHOW = 4;

export function DimensionAnnotations3D({
  cutouts,
  selection,
  preview,
  zoom,
}: DimensionAnnotations3DProps) {
  // Only show annotations at high zoom levels
  if (zoom < MIN_ZOOM_TO_SHOW || selection.size === 0) return null;

  const selectedCutouts = cutouts.filter((c) => selection.has(c.id));
  // Offset in screen-space (16px converted to world mm)
  const offset = 16 / zoom;

  return (
    <>
      {selectedCutouts.map((cutout) => {
        const updates = preview.get(cutout.id);
        const effective = updates ? { ...cutout, ...updates } : cutout;

        const labels = dimensionLabelPositions(effective, offset);

        return (
          <group key={cutout.id}>
            <Html
              position={[labels.width[0], labels.width[1], 0.1]}
              center
              style={{ pointerEvents: 'none' }}
              zIndexRange={HTML_OVERLAY_Z_INDEX_RANGE}
            >
              <div className="rounded bg-surface-elevated/80 px-1 text-micro font-mono text-content-secondary whitespace-nowrap">
                {effective.width.toFixed(1)}mm
              </div>
            </Html>

            <Html
              position={[labels.depth[0], labels.depth[1], 0.1]}
              center
              style={{ pointerEvents: 'none' }}
              zIndexRange={HTML_OVERLAY_Z_INDEX_RANGE}
            >
              <div className="rounded bg-surface-elevated/80 px-1 text-micro font-mono text-content-secondary whitespace-nowrap">
                {effective.depth.toFixed(1)}mm
              </div>
            </Html>
          </group>
        );
      })}
    </>
  );
}
