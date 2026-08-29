/**
 * "Extend into drawer margin" toggle for a placed bin + optional wall
 * taper.
 *
 * When a baseplate adds drawer-fit padding, a bin against a padded edge can
 * extend its walls into that margin. The per-bin flag is stored on the Bin; the
 * actual overhang is derived live from the current padding at render/export
 * (see `@/shared/utils/drawerMargin`). The control appears only when the bin
 * abuts a padded edge; it requires a linked design (only linked bins generate
 * geometry), so it's disabled with a hint until one is linked.
 *
 * The taper angles the wall outward from the padding-wide base up to the rim so
 * the bin reaches into a drawer's curved sides; the per-side reach is derived
 * from the padding, so only the profile, band height and flare are stored on the
 * Bin. It composes with an over-tiled baseplate: those overhang feet are framed
 * from the base, which the flare only widens above.
 */

import { CheckboxRow, SegmentedControl, SliderInput } from '@/design-system';
import type { SegmentedControlOption } from '@/design-system';
import { useMutations } from '@/shared/contexts/MutationsContext';
import { binCanExtendToMargin } from '@/shared/utils/drawerMargin';
import { useTranslation } from '@/i18n';
import type { Bin, Drawer, StoredBaseplateParams, WallTaperProfile } from '@/core/types';
import type { Result, LayoutError } from '@/core/result';

interface ExtendToMarginToggleProps {
  bin: Bin;
  drawer: Drawer;
  baseplate: StoredBaseplateParams | undefined;
}

// Default mm per height unit; the generator clamps the band to the exact wall
// height, so an approximate cap here only bounds the slider range.
const HEIGHT_UNIT_MM = 7;
const TAPER_BAND_STEP = 0.5;
// One full grid unit: the flare sits above the drawer's curve, where no extra
// grid cell could fit, so the half-unit overhang ceiling doesn't bound it.
const MAX_FLARE_MM = 42;

export function ExtendToMarginToggle({ bin, drawer, baseplate }: ExtendToMarginToggleProps) {
  const t = useTranslation();
  const { updateBin } = useMutations();

  // No control for interior bins or drawers with no margin — nothing to fill.
  if (!binCanExtendToMargin(bin, drawer, baseplate)) return null;

  const linked = bin.linkedDesignId !== undefined;
  const canTaper = linked && bin.extendToMargin === true;

  const marginTaper = bin.marginTaper;
  const taperOn = marginTaper?.enabled === true;
  const maxBand = Math.max(TAPER_BAND_STEP, Math.round(bin.height * HEIGHT_UNIT_MM));

  const profileOptions: SegmentedControlOption<WallTaperProfile>[] = [
    { value: 'chamfer', label: t('inspector.taper.chamfer') },
    { value: 'fillet', label: t('inspector.taper.fillet') },
  ];

  // Returns the mutation Result (the callers arrow-return it, matching the
  // extend-to-margin toggle) — marginTaper is non-spatial, so it can't fail
  // placement and there is nothing to recover on the UI side.
  const setTaper = (
    partial: Partial<NonNullable<Bin['marginTaper']>>
  ): Result<void, LayoutError> => {
    const prevBand = marginTaper?.bandHeight ?? 0;
    return updateBin(bin.id, {
      marginTaper: {
        profile: marginTaper?.profile ?? 'chamfer',
        bandHeight: prevBand > 0 ? prevBand : Math.max(TAPER_BAND_STEP, Math.round(maxBand / 3)),
        enabled: marginTaper?.enabled ?? true,
        ...partial,
      },
    });
  };

  return (
    <div>
      <CheckboxRow
        label={t('inspector.extendToMargin')}
        checked={linked && bin.extendToMargin === true}
        disabled={!linked}
        onChange={(checked) => updateBin(bin.id, { extendToMargin: checked })}
      />
      <p className="mt-1 px-2 text-micro leading-snug text-content-disabled">
        {linked ? t('inspector.extendToMargin.hint') : t('inspector.extendToMargin.needsLink')}
      </p>

      {canTaper && (
        <div className="mt-2">
          <CheckboxRow
            label={t('inspector.taper')}
            checked={taperOn}
            onChange={(checked) => setTaper({ enabled: checked })}
          />
          {taperOn && (
            <div className="mt-1 flex flex-col gap-2 px-2">
              <SegmentedControl
                options={profileOptions}
                value={marginTaper.profile}
                onChange={(profile) => setTaper({ profile })}
                aria-label={t('inspector.taper.profile')}
                size="sm"
                fullWidth
              />
              <SliderInput
                label={t('inspector.taper.height')}
                value={marginTaper.bandHeight}
                onChange={(bandHeight) => setTaper({ bandHeight })}
                min={0}
                max={maxBand}
                step={TAPER_BAND_STEP}
                unit="mm"
              />
              <SliderInput
                label={t('inspector.taper.flare')}
                value={marginTaper.flare ?? 0}
                onChange={(flare) => setTaper({ flare })}
                min={0}
                max={MAX_FLARE_MM}
                step={TAPER_BAND_STEP}
                unit="mm"
              />
              <p className="text-micro leading-snug text-content-disabled">
                {t('inspector.taper.flare.hint')}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
