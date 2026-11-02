import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import type { Cutout } from '@/features/bin-designer/types';
import { useTranslation } from '@/i18n';
import type { SplitPt } from '@/shared/utils/cutoutSplit';
import type { PreviewMap } from '../useCutoutInteraction';
import { HTML_OVERLAY_Z_INDEX_RANGE, RENDER_ORDER, SPLIT_COLOR } from './constants';
import { placeSplits } from './splitLinePlacement';

interface SplitLines3DProps {
  readonly cutouts: readonly Cutout[];
  readonly preview: PreviewMap;
  /** Pockets whose sides are named on the board. */
  readonly selection: ReadonlySet<string>;
}

/** Each split pocket's line, and on a selected pocket which side is A and which B. */
export function SplitLines3D({ cutouts, preview, selection }: SplitLines3DProps) {
  const t = useTranslation();
  const splits = useMemo(() => placeSplits(cutouts, preview), [cutouts, preview]);
  return (
    <>
      {splits.map((s) => (
        <group key={`split-${s.key}`}>
          <SplitLine from={s.from} to={s.to} dashed={!s.live} />
          {selection.has(s.ownerId) && (
            <>
              <SideBadge at={s.sideA} label={t('binDesigner.cutouts.split.sideA')} />
              <SideBadge at={s.sideB} label={t('binDesigner.cutouts.split.sideB')} />
            </>
          )}
        </group>
      ))}
    </>
  );
}

function SplitLine({ from, to, dashed }: { from: SplitPt; to: SplitPt; dashed: boolean }) {
  const line = useMemo(() => {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(from.x, from.y, 0.06),
      new THREE.Vector3(to.x, to.y, 0.06),
    ]);
    const style = { color: new THREE.Color(SPLIT_COLOR), transparent: true, depthTest: false };
    const material = dashed
      ? new THREE.LineDashedMaterial({ ...style, opacity: 0.6, dashSize: 1.5, gapSize: 1 })
      : new THREE.LineBasicMaterial({ ...style, opacity: 0.95 });
    const obj = new THREE.Line(geometry, material);
    if (dashed) obj.computeLineDistances();
    obj.renderOrder = RENDER_ORDER.OFF_BOARD;
    return obj;
  }, [from.x, from.y, to.x, to.y, dashed]);

  // <primitive> does not dispose what it is handed.
  useEffect(
    () => () => {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    },
    [line]
  );

  return <primitive object={line} />;
}

function SideBadge({ at, label }: { at: SplitPt; label: string }) {
  return (
    <Html
      position={[at.x, at.y, 0.1]}
      style={{ pointerEvents: 'none' }}
      center
      zIndexRange={HTML_OVERLAY_Z_INDEX_RANGE}
    >
      <span
        className="flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-micro font-semibold text-on-accent shadow-sm"
        style={{ backgroundColor: SPLIT_COLOR }}
      >
        {label}
      </span>
    </Html>
  );
}
