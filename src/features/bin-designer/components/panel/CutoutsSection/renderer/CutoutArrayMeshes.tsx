/**
 * Renders a parametric array master as its full set of instance meshes. Every
 * instance is a real cut (solid), so they all use the normal CutoutShapeMesh;
 * a small ring marks the master (instance 0) so the user knows which one's
 * parameters drive the array. Clicking any instance selects the master — the
 * caller's `onSelect` is invoked with the master id.
 *
 * The master's live preview override (drag/resize/rotate) is merged before
 * expansion, so the whole array follows the interaction.
 */

import { memo, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { Cutout } from '@/features/bin-designer/types';
import { expandCutoutArray } from '@/shared/utils/cutoutArray';
import { CutoutShapeMesh } from './CutoutShapeMesh';
import { RENDER_ORDER, ACCENT_COLOR_HEX } from './constants';

const ACCENT = new THREE.Color(ACCENT_COLOR_HEX);

interface CutoutArrayMeshesProps {
  readonly master: Cutout;
  readonly isSelected: boolean;
  readonly isDragging: boolean;
  readonly previewOverride?: Partial<Cutout>;
  readonly binColor: string;
  readonly onSelect: (id: string, additive: boolean) => void;
  readonly onDoubleClick?: (id: string) => void;
  readonly onDragStart?: (id: string, mmX: number, mmY: number, altKey?: boolean) => void;
  readonly disablePointerEvents?: boolean;
}

/** Small accent ring drawn over the master instance center. */
function MasterMarker({ cx, cy }: { readonly cx: number; readonly cy: number }) {
  const ring = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const r = 1.6;
    for (let i = 0; i <= 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      pts.push(new THREE.Vector3(cx + r * Math.cos(a), cy + r * Math.sin(a), 0.06));
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [cx, cy]);
  useEffect(() => () => ring.dispose(), [ring]);
  return (
    <lineLoop geometry={ring} renderOrder={RENDER_ORDER.SHAPES + 2}>
      <lineBasicMaterial color={ACCENT} transparent opacity={0.9} depthTest={false} />
    </lineLoop>
  );
}

export const CutoutArrayMeshes = memo(function CutoutArrayMeshes({
  master,
  isSelected,
  isDragging,
  previewOverride,
  binColor,
  onSelect,
  onDoubleClick,
  onDragStart,
  disablePointerEvents,
}: CutoutArrayMeshesProps) {
  const instances = useMemo(
    () => expandCutoutArray(previewOverride ? { ...master, ...previewOverride } : master),
    [master, previewOverride]
  );
  const first = instances.at(0);

  return (
    <>
      {instances.map((inst) => (
        <CutoutShapeMesh
          key={inst.id}
          cutout={inst}
          isSelected={isSelected}
          isGrouped={false}
          isDragging={isDragging}
          binColor={binColor}
          onSelect={(_id, additive) => onSelect(master.id, additive)}
          onDoubleClick={() => onDoubleClick?.(master.id)}
          onDragStart={
            onDragStart
              ? (_id, mmX, mmY, altKey) => onDragStart(master.id, mmX, mmY, altKey)
              : undefined
          }
          disablePointerEvents={disablePointerEvents}
        />
      ))}
      {first && <MasterMarker cx={first.x + first.width / 2} cy={first.y + first.depth / 2} />}
    </>
  );
});
