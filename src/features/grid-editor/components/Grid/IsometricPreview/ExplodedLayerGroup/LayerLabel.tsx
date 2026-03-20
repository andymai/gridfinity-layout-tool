import { Html } from '@react-three/drei';
import type { LayerId } from '@/core/types';

interface LayerLabelProps {
  layerId: LayerId;
  layerName: string;
  layerHeightMm: number;
  isActive: boolean;
  drawerWidth: number;
  drawerDepth: number;
  layerCenterZ: number;
  onLayerClick: (layerId: LayerId) => void;
}

/**
 * HTML overlay label positioned next to a layer in the exploded 3D view.
 * Shows the layer name and height. Highlights when active.
 * Uses drei's Html component to anchor DOM elements to 3D positions.
 */
export function LayerLabel({
  layerId,
  layerName,
  layerHeightMm,
  isActive,
  drawerWidth,
  drawerDepth,
  layerCenterZ,
  onLayerClick,
}: LayerLabelProps) {
  return (
    <Html
      position={[drawerWidth + 0.5, drawerDepth / 2, layerCenterZ]}
      zIndexRange={[50, 0]}
      style={{ pointerEvents: 'none' }}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onLayerClick(layerId);
        }}
        className={`rounded px-1.5 py-0.5 text-[11px] cursor-pointer whitespace-nowrap border transition-colors ${
          isActive
            ? 'bg-accent text-on-dark border-accent'
            : 'bg-surface-elevated text-content-secondary border-stroke-subtle hover:bg-surface-hover'
        }`}
        style={{ pointerEvents: 'auto' }}
      >
        {layerName} · {layerHeightMm}mm
      </button>
    </Html>
  );
}
