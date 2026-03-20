import { Html } from '@react-three/drei';
import type { LayerId } from '@/core/types';

interface LayerLabelProps {
  layerId: LayerId;
  layerName: string;
  layerHeightMm: number;
  isActive: boolean;
  drawerWidth: number;
  layerCenterZ: number;
  onLayerClick: (layerId: LayerId) => void;
}

/**
 * HTML overlay label positioned next to a layer in the exploded 3D view.
 * Anchored at the front-right corner of the drawer (closest to isometric camera)
 * so labels stay visually connected to their layer content.
 */
export function LayerLabel({
  layerId,
  layerName,
  layerHeightMm,
  isActive,
  drawerWidth,
  layerCenterZ,
  onLayerClick,
}: LayerLabelProps) {
  return (
    <Html
      position={[drawerWidth + 0.3, -0.3, layerCenterZ]}
      zIndexRange={[50, 0]}
      style={{ pointerEvents: 'none' }}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onLayerClick(layerId);
        }}
        className={`rounded-md px-2 py-1 text-xs font-medium cursor-pointer whitespace-nowrap border transition-all ${
          isActive
            ? 'bg-accent text-on-dark border-accent shadow-sm'
            : 'bg-surface-elevated/80 text-content-tertiary border-stroke-subtle hover:bg-surface-hover hover:text-content-secondary'
        }`}
        style={{
          pointerEvents: 'auto',
          opacity: isActive ? 1 : 0.7,
          backdropFilter: 'blur(4px)',
        }}
      >
        {layerName} · {layerHeightMm}mm
      </button>
    </Html>
  );
}
