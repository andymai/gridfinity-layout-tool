/**
 * Live readout above the part being dragged or rotated — the cutout editor's
 * dimension-tooltip idiom, so a gesture always shows the number it commits.
 */
import { Html } from '@react-three/drei';
import type { PlacedPart } from './workshopPlacement';
import { storeToScene } from './workshopPlacement';

const TIP_LIFT_MM = 18;

function fmt(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

interface WorkshopDragTipProps {
  readonly placed: PlacedPart;
  readonly mode: 'move' | 'rotate';
  readonly baseW: number;
  readonly baseD: number;
}

export function WorkshopDragTip({ placed, mode, baseW, baseD }: WorkshopDragTipProps) {
  const text =
    mode === 'rotate'
      ? `${fmt(placed.node.transform.rotZDeg)}°`
      : `${fmt(placed.node.transform.x)}, ${fmt(placed.node.transform.y)}`;
  return (
    <Html
      position={[
        storeToScene(placed.x, baseW),
        storeToScene(placed.y, baseD),
        placed.topZ + TIP_LIFT_MM,
      ]}
      center
      style={{ pointerEvents: 'none' }}
    >
      <div className="whitespace-nowrap rounded bg-surface-elevated/95 px-1.5 py-0.5 font-mono text-label text-content shadow-sm ring-1 ring-stroke-subtle">
        {text}
      </div>
    </Html>
  );
}
