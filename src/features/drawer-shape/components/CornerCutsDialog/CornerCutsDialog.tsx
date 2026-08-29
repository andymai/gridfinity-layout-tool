import { useCallback, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Dialog, Button, Select, Stepper } from '@/design-system';
import { ConfirmDialog } from '@/shared/components';
import { useLayoutStore, useToastStore } from '@/core/store';
import { useTranslation } from '@/i18n';
import { useMutations } from '@/shared/contexts/MutationsContext';
import { isOk } from '@/core/result';
import { computeDisplacedBins } from '@/core/cqrs/v2/domain/drawer/displacement';
import { trackDrawerShapeApplied } from '@/shared/analytics/posthog';
import type { CornerCut, CornerCutParams, DrawerOutline } from '@/core/types';
import { effectiveGridUnitMmY } from '@/core/types';
import { cornerCutsMatchVertices } from '@/shared/utils/cornerCutOutline';
import { cornersToOutline, maxCutExtentMm, NO_CUTS } from '../../utils/cornersToOutline';

interface CornerCutsDialogProps {
  open: boolean;
  onClose: () => void;
}

type CornerKey = keyof CornerCutParams;
type CutKind = CornerCut['kind'];

/** Corners laid out as they appear on the grid (back row first). */
const CORNER_LAYOUT: ReadonlyArray<readonly [CornerKey, string]> = [
  ['tl', 'drawerShape.corners.backLeft'],
  ['tr', 'drawerShape.corners.backRight'],
  ['bl', 'drawerShape.corners.frontLeft'],
  ['br', 'drawerShape.corners.frontRight'],
];

function clampMm(value: number, maxMm: number): number {
  return Math.min(maxMm, Math.max(1, value));
}

/**
 * The corner params this dialog may seed from, or undefined when the authoring
 * echo cannot be trusted. The echo goes stale when the drawer resizes under it
 * (keeps the outline byte-identical), so it counts only while it still
 * reproduces the stored vertices at the CURRENT size — re-inscribing a stale
 * echo on the new rectangle would silently replace the actual shape.
 */
function reproducibleCorners(
  outline: DrawerOutline | undefined,
  widthMm: number,
  depthMm: number
): CornerCutParams | undefined {
  if (outline === undefined) return undefined;
  const authoring = outline.authoring;
  if (authoring?.kind !== 'corners' || authoring.corners === undefined) return undefined;
  if (!cornerCutsMatchVertices(outline.vertices, widthMm, depthMm, authoring.corners)) {
    return undefined;
  }
  return authoring.corners;
}

function defaultCut(kind: CutKind, maxMm: number): CornerCut {
  const size = Math.min(21, maxMm);
  switch (kind) {
    case 'none':
      return { kind: 'none' };
    case 'chamfer':
      return { kind: 'chamfer', size };
    case 'radius':
      return { kind: 'radius', r: size };
    case 'notch':
      return { kind: 'notch', w: size, d: size };
  }
}

/**
 * Per-corner cuts editor (, 'corners' authoring surface): chamfer,
 * radius (real arcs), or rectangular notch per corner, applied to the drawer
 * rectangle. Round-trips via the outline's authoring annotation; applying
 * over a shape drawn with a different editor asks first.
 */
export function CornerCutsDialog({ open, onClose }: CornerCutsDialogProps) {
  const t = useTranslation();
  const mutations = useMutations();
  const addToast = useToastStore((s) => s.addToast);
  const { layout, gridUnitMmY } = useLayoutStore(
    useShallow((s) => ({
      layout: s.layout,
      gridUnitMmY: effectiveGridUnitMmY(s.layout),
    }))
  );

  const existing = layout.drawer.outline;
  const echoCorners = reproducibleCorners(
    existing,
    layout.drawer.width * layout.gridUnitMm,
    layout.drawer.depth * gridUnitMmY
  );
  const seeded: CornerCutParams = echoCorners ?? NO_CUTS;
  const [cuts, setCuts] = useState<CornerCutParams | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const active = cuts ?? seeded;

  const maxMm = maxCutExtentMm(layout.drawer, layout.gridUnitMm, gridUnitMmY);
  // A shape this dialog cannot reproduce — drawn with another editor, an
  // annotation stripped by an older server, or a stale echo — must confirm
  // before being replaced; the seeded pickers don't represent it.
  const replacesForeignShape = existing !== undefined && echoCorners === undefined;

  const setCorner = useCallback(
    (key: CornerKey, cut: CornerCut) => {
      setCuts((prev) => ({ ...(prev ?? seeded), [key]: cut }));
    },
    [seeded]
  );

  const outline = useMemo(
    () => cornersToOutline(layout.drawer, active, layout.gridUnitMm, gridUnitMmY),
    [layout.drawer, active, layout.gridUnitMm, gridUnitMmY]
  );

  const doApply = useCallback(() => {
    const displaced =
      outline === null
        ? 0
        : computeDisplacedBins(
            layout.bins,
            { ...layout.drawer, outline },
            layout.baseplateParams,
            layout.gridUnitMm,
            gridUnitMmY
          ).length;
    const result = mutations.setDrawerOutline(outline);
    if (!isOk(result)) return;
    trackDrawerShapeApplied({
      editor: 'corners',
      displaced_bins: displaced,
      used_trace: false,
      cleared: outline === null,
    });
    if (displaced > 0) {
      addToast(t('toast.binsDisplacedByShape', { count: displaced }), 'info');
    }
    setCuts(null);
    onClose();
  }, [outline, layout, gridUnitMmY, mutations, addToast, t, onClose]);

  const handleApply = useCallback(() => {
    if (replacesForeignShape) {
      setConfirmReplace(true);
    } else {
      doApply();
    }
  }, [replacesForeignShape, doApply]);

  const handleClose = useCallback(() => {
    setCuts(null);
    onClose();
  }, [onClose]);

  const kindOptions = useMemo(
    () => [
      { id: 'none', name: t('drawerShape.corners.kindNone') },
      { id: 'chamfer', name: t('drawerShape.corners.kindChamfer') },
      { id: 'radius', name: t('drawerShape.corners.kindRadius') },
      { id: 'notch', name: t('drawerShape.corners.kindNotch') },
    ],
    [t]
  );

  return (
    <Dialog.Root open={open} onClose={handleClose} size="md">
      <Dialog.Header title={t('drawerShape.corners.title')} />
      <Dialog.Body>
        <div className="grid grid-cols-2 gap-3">
          {CORNER_LAYOUT.map(([key, labelKey]) => {
            const cut = active[key];
            return (
              <div key={key} className="space-y-2 rounded border border-stroke-subtle p-2">
                <div className="text-label font-medium uppercase tracking-wide text-content-tertiary">
                  {t(labelKey)}
                </div>
                <Select
                  aria-label={t(labelKey)}
                  size="sm"
                  options={kindOptions}
                  value={cut.kind}
                  onChange={(e) => setCorner(key, defaultCut(e.target.value as CutKind, maxMm))}
                />
                {cut.kind === 'chamfer' && (
                  <Stepper
                    value={cut.size}
                    onChange={(v) => setCorner(key, { kind: 'chamfer', size: v })}
                    onStep={(d) =>
                      setCorner(key, { kind: 'chamfer', size: clampMm(cut.size + d, maxMm) })
                    }
                    min={1}
                    max={maxMm}
                    step={1}
                    size="sm"
                    fullWidth
                    aria-label={t('drawerShape.corners.sizeAria')}
                  />
                )}
                {cut.kind === 'radius' && (
                  <Stepper
                    value={cut.r}
                    onChange={(v) => setCorner(key, { kind: 'radius', r: v })}
                    onStep={(d) => setCorner(key, { kind: 'radius', r: clampMm(cut.r + d, maxMm) })}
                    min={1}
                    max={maxMm}
                    step={1}
                    size="sm"
                    fullWidth
                    aria-label={t('drawerShape.corners.sizeAria')}
                  />
                )}
                {cut.kind === 'notch' && (
                  <div className="grid grid-cols-2 gap-1.5">
                    <Stepper
                      value={cut.w}
                      onChange={(v) => setCorner(key, { ...cut, w: v })}
                      onStep={(d) => setCorner(key, { ...cut, w: clampMm(cut.w + d, maxMm) })}
                      min={1}
                      max={maxMm}
                      step={1}
                      size="sm"
                      fullWidth
                      aria-label={t('drawerShape.corners.widthAria')}
                    />
                    <Stepper
                      value={cut.d}
                      onChange={(v) => setCorner(key, { ...cut, d: v })}
                      onStep={(delta) =>
                        setCorner(key, { ...cut, d: clampMm(cut.d + delta, maxMm) })
                      }
                      min={1}
                      max={maxMm}
                      step={1}
                      size="sm"
                      fullWidth
                      aria-label={t('drawerShape.corners.depthAria')}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Dialog.Body>
      <Dialog.Footer>
        <Button variant="secondary" onClick={handleClose} type="button">
          {t('common.cancel')}
        </Button>
        <Button variant="primary" onClick={handleApply} type="button">
          {t('drawerShape.editor.apply')}
        </Button>
      </Dialog.Footer>
      <ConfirmDialog
        isOpen={confirmReplace}
        title={t('drawerShape.corners.replaceTitle')}
        message={t('drawerShape.corners.replaceBody')}
        confirmText={t('drawerShape.editor.apply')}
        destructive
        onConfirm={doApply}
        onCancel={() => setConfirmReplace(false)}
      />
    </Dialog.Root>
  );
}
