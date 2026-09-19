import type { Cutout, CutoutOpenSide } from '@/features/bin-designer/types';
import { CUTOUT_OPEN_SIDES } from '@/features/bin-designer/types';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useTranslation } from '@/i18n';
import { Button } from '@/design-system';
import { SEGMENT_ACTIVE, SEGMENT_INACTIVE } from '@/shared/components/segmentedControlClasses';
import { normalizeOpenSides, openSideBlocker } from '@/shared/utils/cutoutOpenSides';
import type { OpenSideBlocker } from '@/shared/utils/cutoutOpenSides';

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

/**
 * The reasons a rectangle can carry. `shape` never reaches the row (it is only
 * rendered for rectangles) and `host` is the solid-style gate that hides the
 * whole cutout editor, so neither needs copy.
 */
const BLOCKER_HINT_KEY: Partial<Record<OpenSideBlocker, string>> = {
  grouped: 'binDesigner.cutouts.openSidesBlocked.grouped',
  rotation: 'binDesigner.cutouts.openSidesBlocked.rotation',
  lean: 'binDesigner.cutouts.openSidesBlocked.lean',
  taper: 'binDesigner.cutouts.openSidesBlocked.taper',
};

/**
 * Which bin walls a rectangle pocket runs out through. Chips stay pressed
 * while a blocker holds them inert, so squaring the rotation or ungrouping
 * restores the breach the user already asked for.
 */
export function CutoutOpenSidesControls({
  cutout,
  disabled,
  onUpdate,
}: CutoutOpenSidesControlsProps) {
  const t = useTranslation();
  const base = useDesignerStore((s) => s.params.base);
  const overhang = useDesignerStore((s) => s.params.overhang);
  const cellMask = useDesignerStore((s) => s.params.cellMask);
  const blocker = openSideBlocker(cutout, { base, overhang, cellMask });
  const hintKey = blocker ? BLOCKER_HINT_KEY[blocker] : undefined;
  const sides = normalizeOpenSides(cutout.openSides) ?? [];

  const toggle = (side: CutoutOpenSide): void => {
    const next = sides.includes(side) ? sides.filter((s) => s !== side) : [...sides, side];
    onUpdate({ openSides: normalizeOpenSides(next) });
  };

  return (
    <div className="space-y-0.5 pt-0.5">
      <div className="flex items-center gap-1.5">
        <span className="text-micro text-content-tertiary">
          {t('binDesigner.cutouts.openSides')}
        </span>
        {CUTOUT_OPEN_SIDES.map((side) => {
          const on = sides.includes(side);
          return (
            <Button
              key={side}
              type="button"
              variant="ghost"
              onClick={() => toggle(side)}
              disabled={disabled || blocker !== null}
              aria-label={t(SIDE_ARIA_KEY[side])}
              aria-pressed={on}
              className={`h-5 min-w-[20px] rounded px-1 text-micro font-medium leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset disabled:cursor-not-allowed disabled:opacity-50 ${
                on ? SEGMENT_ACTIVE : SEGMENT_INACTIVE
              }`}
            >
              {t(SIDE_LABEL_KEY[side])}
            </Button>
          );
        })}
      </div>
      <p className="text-micro text-content-tertiary">
        {hintKey ? t(hintKey) : t('binDesigner.cutouts.openSidesHint')}
      </p>
    </div>
  );
}
