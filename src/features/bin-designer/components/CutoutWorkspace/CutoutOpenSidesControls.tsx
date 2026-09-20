import type { Cutout, CutoutOpenSide, CutoutOpenSideSpec } from '@/features/bin-designer/types';
import { CUTOUT_OPEN_SIDES, MIN_OPEN_SIDE_WIDTH_MM } from '@/features/bin-designer/types';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useTranslation } from '@/i18n';
import { Button, NumberField } from '@/design-system';
import {
  getSegmentClass,
  SEGMENT_ACTIVE,
  SEGMENT_GROUP_CLASS,
  SEGMENT_INACTIVE,
} from '@/shared/components/segmentedControlClasses';
import { normalizeOpenSides, openSideBlocker } from '@/shared/utils/cutoutOpenSides';
import type { OpenSideBlocker } from '@/shared/utils/cutoutOpenSides';
import { cutoutOutlineRing, meshOutlineRings, ringBounds } from '@/shared/utils/cutoutOutline';

interface CutoutOpenSidesControlsProps {
  readonly cutout: Cutout;
  readonly disabled?: boolean;
  readonly onUpdate: (patch: Partial<Cutout>) => void;
}

const SIDE_LABEL_KEY: Record<CutoutOpenSide, string> = {
  front: 'binDesigner.cutouts.openSide.front',
  back: 'binDesigner.cutouts.openSide.back',
  left: 'binDesigner.cutouts.openSide.left',
  right: 'binDesigner.cutouts.openSide.right',
};

const SIDE_ARIA_KEY: Record<CutoutOpenSide, string> = {
  front: 'binDesigner.cutouts.openSide.frontAria',
  back: 'binDesigner.cutouts.openSide.backAria',
  left: 'binDesigner.cutouts.openSide.leftAria',
  right: 'binDesigner.cutouts.openSide.rightAria',
};

/** `shape` never reaches the row: it is only rendered for shapes that cut a pocket. */
const BLOCKER_HINT_KEY: Partial<Record<OpenSideBlocker, string>> = {
  host: 'binDesigner.cutouts.openSidesBlocked.host',
  grouped: 'binDesigner.cutouts.openSidesBlocked.grouped',
  lean: 'binDesigner.cutouts.openSidesBlocked.lean',
  taper: 'binDesigner.cutouts.openSidesBlocked.taper',
};

const FORMS: readonly { readonly tunnel: boolean; readonly key: string }[] = [
  { tunnel: false, key: 'binDesigner.cutouts.openSideForm.open' },
  { tunnel: true, key: 'binDesigner.cutouts.openSideForm.tunnel' },
];

const CHIP_CLASS =
  'h-5 min-w-[20px] rounded px-1 text-micro font-medium leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset disabled:cursor-not-allowed disabled:opacity-50';

/**
 * Which bin walls a pocket runs out through, and how. Chips stay pressed
 * while a blocker holds them inert, so ungrouping or clearing the lean
 * restores the breach the user already asked for. Each opened side unfolds
 * one row: the channel width (the pocket's own by default) and whether the
 * wall above the pocket stays.
 */
export function CutoutOpenSidesControls({
  cutout,
  disabled,
  onUpdate,
}: CutoutOpenSidesControlsProps) {
  const t = useTranslation();
  const params = useDesignerStore((s) => s.params);
  const blocker = openSideBlocker(cutout, params);
  const hintKey = blocker ? BLOCKER_HINT_KEY[blocker] : undefined;
  const specs = normalizeOpenSides(cutout.openSides) ?? [];
  // A mesh whose asset is missing still has the footprint the editor drew,
  // so its rows keep a real width rather than a zero.
  const meshRings =
    cutout.shape === 'mesh'
      ? meshOutlineRings(cutout, params.meshAssets?.[cutout.meshId ?? ''])
      : [];
  const rings =
    meshRings.length > 0
      ? meshRings
      : [
          cutoutOutlineRing(cutout.shape === 'mesh' ? { ...cutout, shape: 'rectangle' } : cutout),
        ].filter((r) => r !== null);
  const bounds =
    rings.length === 0
      ? null
      : rings.map(ringBounds).reduce((a, b) => ({
          minX: Math.min(a.minX, b.minX),
          minY: Math.min(a.minY, b.minY),
          maxX: Math.max(a.maxX, b.maxX),
          maxY: Math.max(a.maxY, b.maxY),
        }));

  const commit = (next: readonly CutoutOpenSideSpec[]): void => {
    onUpdate({ openSides: normalizeOpenSides(next) });
  };
  const toggle = (side: CutoutOpenSide): void => {
    commit(
      specs.some((s) => s.side === side)
        ? specs.filter((s) => s.side !== side)
        : [...specs, { side }]
    );
  };
  const patch = (side: CutoutOpenSide, change: Partial<CutoutOpenSideSpec>): void => {
    commit(
      specs.map((s) => {
        if (s.side !== side) return s;
        const merged: { side: CutoutOpenSide; widthMm?: number; tunnel?: boolean } = {
          ...s,
          ...change,
        };
        if (merged.widthMm === undefined) delete merged.widthMm;
        if (merged.tunnel !== true) delete merged.tunnel;
        return merged;
      })
    );
  };
  const fullWidth = (side: CutoutOpenSide): number => {
    if (!bounds) return 0;
    return side === 'left' || side === 'right'
      ? bounds.maxY - bounds.minY
      : bounds.maxX - bounds.minX;
  };

  return (
    <div className="space-y-0.5 pt-0.5">
      <div className="flex items-center gap-1.5">
        <span className="text-micro text-content-tertiary">
          {t('binDesigner.cutouts.openSides')}
        </span>
        {CUTOUT_OPEN_SIDES.map((side) => {
          const on = specs.some((s) => s.side === side);
          return (
            <Button
              key={side}
              type="button"
              variant="ghost"
              onClick={() => toggle(side)}
              disabled={disabled || blocker !== null}
              aria-label={t(SIDE_ARIA_KEY[side])}
              aria-pressed={on}
              className={`${CHIP_CLASS} ${on ? SEGMENT_ACTIVE : SEGMENT_INACTIVE}`}
            >
              {t(SIDE_LABEL_KEY[side])}
            </Button>
          );
        })}
      </div>
      <p className="text-micro text-content-tertiary">
        {hintKey ? t(hintKey) : t('binDesigner.cutouts.openSidesHint')}
      </p>
      {blocker === null &&
        specs.map((spec) => {
          const full = fullWidth(spec.side);
          return (
            <div
              key={spec.side}
              className="space-y-1 pl-2"
              data-testid={`open-side-row-${spec.side}`}
            >
              <div className="flex items-center gap-1.5">
                <span className="w-10 text-micro text-content-tertiary">
                  {t(SIDE_LABEL_KEY[spec.side])}
                </span>
                <div
                  role="group"
                  aria-label={t('binDesigner.cutouts.openSideForm')}
                  className={`${SEGMENT_GROUP_CLASS} flex-1`}
                >
                  {FORMS.map(({ tunnel, key }) => {
                    const active = (spec.tunnel === true) === tunnel;
                    return (
                      <Button
                        key={key}
                        type="button"
                        variant="ghost"
                        disabled={disabled}
                        onClick={() => patch(spec.side, { tunnel: tunnel || undefined })}
                        aria-pressed={active}
                        className={`flex-1 py-0.5 text-micro leading-none ${getSegmentClass(active)}`}
                      >
                        {t(key)}
                      </Button>
                    );
                  })}
                </div>
              </div>
              <NumberField
                label={`${t('binDesigner.cutouts.openSideWidth')} · ${t(SIDE_LABEL_KEY[spec.side])}`}
                value={spec.widthMm ?? Number(full.toFixed(1))}
                onChange={(widthMm) =>
                  patch(spec.side, { widthMm: widthMm >= full ? undefined : widthMm })
                }
                min={MIN_OPEN_SIDE_WIDTH_MM}
                max={Math.max(MIN_OPEN_SIDE_WIDTH_MM, Number(full.toFixed(1)))}
                step={0.5}
                unit="mm"
                disabled={disabled}
              />
            </div>
          );
        })}
    </div>
  );
}
