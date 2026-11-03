import { useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Collapsible } from '@/design-system';
import { useTranslation } from '@/i18n';
import { useDesignerStore } from '@/features/bin-designer/store';
import type { Cutout, PathPoint } from '@/features/bin-designer/types';
import {
  axisIsUpright,
  cleanOutline,
  isNoCleanup,
  mirrorAxis,
  NO_CLEANUP,
  type CleanupSettings,
  type Region,
  type RoundingCache,
} from '@/shared/outlineCleanup';
import { isSelfIntersecting } from '../panel/CutoutsSection/pathGeometrySegments';
import { drawnRegion, storedPatch, type OutlinePatch } from './cleanupFrame';
import { OutlineCleanupControls } from './OutlineCleanupControls';

interface CutoutOutlineSectionProps {
  readonly cutout: Cutout;
  readonly disabled?: boolean;
  readonly onUpdate: (id: string, patch: Partial<Cutout>) => void;
}

interface Baseline {
  /** The outline as it stood, to put back exactly when every setting is undone. */
  readonly original: OutlinePatch;
  /** The same, densely and as drawn, for every setting to start from. */
  readonly region: Region;
  /** Roundings of `region` already made, the slow step, kept while dragging. */
  readonly rounded: RoundingCache;
}

function capture(cutout: Cutout): Baseline | null {
  const region = drawnRegion(cutout);
  if (!region || !cutout.path) return null;
  const { path, holes, x, y, width, depth } = cutout;
  return { original: { path, holes, x, y, width, depth }, region, rounded: new Map() };
}

/** What a baseline is read from: an edit to any of it made elsewhere starts it over. */
interface Shape {
  readonly path: readonly PathPoint[] | undefined;
  readonly holes: readonly (readonly PathPoint[])[] | undefined;
  readonly rotation: number;
}

const shapeOf = (c: Cutout): Shape => ({ path: c.path, holes: c.holes, rotation: c.rotation });

const sameShape = (a: Shape, b: Shape) =>
  a.rotation === b.rotation &&
  (a.path === b.path || JSON.stringify(a.path) === JSON.stringify(b.path)) &&
  (a.holes === b.holes || JSON.stringify(a.holes ?? []) === JSON.stringify(b.holes ?? []));

/**
 * Cleanup for one path cutout. The outline as it stood when the section
 * opened is where every setting starts, so moving a slider back and forth
 * never compounds; an edit made anywhere else becomes the new start.
 */
export function CutoutOutlineSection({
  cutout,
  disabled = false,
  onUpdate,
}: CutoutOutlineSectionProps) {
  const t = useTranslation();
  const { startTransaction, commitTransaction, invalidateGeometry } = useDesignerStore(
    useShallow((s) => ({
      startTransaction: s.startTransaction,
      commitTransaction: s.commitTransaction,
      invalidateGeometry: s.invalidateGeometry,
    }))
  );
  const [baseline, setBaseline] = useState(() => capture(cutout));
  const [settings, setSettings] = useState<CleanupSettings>(NO_CLEANUP);
  const [written, setWritten] = useState<Shape>(() => shapeOf(cutout));
  const [failed, setFailed] = useState(false);
  // A drag holds one undo step open until it is released, counting its steps:
  // only the first change in a transaction regenerates the model.
  const open = useRef(false);
  const steps = useRef(0);

  if (!sameShape(shapeOf(cutout), written)) {
    setWritten(shapeOf(cutout));
    setBaseline(capture(cutout));
    setSettings(NO_CLEANUP);
    setFailed(false);
  }

  useEffect(
    () => () => {
      if (open.current) commitTransaction();
    },
    [commitTransaction]
  );

  const upright = useMemo(() => {
    const axis = settings.mirror?.axis;
    if (!baseline || axis === undefined || axis === 'vertical') return true;
    if (axis === 'horizontal') return false;
    return axisIsUpright(mirrorAxis(baseline.region.outline, 'detected'));
  }, [baseline, settings.mirror?.axis]);

  const apply = (next: CleanupSettings, done: boolean) => {
    if (!baseline) return;
    setSettings(next);
    let patch: OutlinePatch | null = baseline.original;
    if (!isNoCleanup(next)) {
      const cleaned = cleanOutline(baseline.region, next, 0, baseline.rounded);
      patch =
        cleaned && !isSelfIntersecting(cleaned.path) ? storedPatch(cleaned, cutout.rotation) : null;
    }
    setFailed(patch === null);
    if (patch) {
      if (!open.current) {
        startTransaction();
        open.current = true;
        steps.current = 0;
      }
      steps.current += 1;
      setWritten({ path: patch.path, holes: patch.holes, rotation: cutout.rotation });
      onUpdate(cutout.id, patch);
    }
    if (done && open.current) {
      commitTransaction();
      open.current = false;
      if (steps.current > 1) invalidateGeometry();
    }
  };

  return (
    <Collapsible title={t('binDesigner.cutouts.outline.section')} size="sm" defaultExpanded={false}>
      <div className="space-y-2">
        <OutlineCleanupControls
          settings={settings}
          onChange={apply}
          onReset={() => apply(NO_CLEANUP, true)}
          yDown={false}
          upright={upright}
          squareTo="bin"
          disabled={disabled || !baseline}
        />
        {failed && (
          <p role="status" className="text-xs text-warning">
            {t('binDesigner.cutouts.outline.failed')}
          </p>
        )}
      </div>
    </Collapsible>
  );
}
