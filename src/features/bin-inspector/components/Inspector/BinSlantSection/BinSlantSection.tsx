/**
 * Slant for one placed bin: its own, which replaces its design's, plus what
 * the row it stands in needs. Linked copies of one design lean alike through
 * the design; the last bin of a row takes the end support as its own slant.
 */

import { SLANT_MAX_DEG } from '@/core/types';
import type { Bin, Layout, SlantSide } from '@/core/types';
import { Button, CheckboxRow, SegmentedControl, Stepper } from '@/design-system';
import type { SegmentedControlOption } from '@/design-system';
import { useTranslation } from '@/i18n';
import { SLANT_MIN_DEG, useBinSlantSection } from './useBinSlantSection';

const SIDES: readonly SlantSide[] = ['back', 'front', 'left', 'right'];
const ANGLE_STEP_DEG = 5;

interface BinSlantSectionProps {
  bin: Bin;
  layout: Layout;
  variant: 'desktop' | 'mobile';
}

export function BinSlantSection({ bin, layout, variant }: BinSlantSectionProps) {
  const t = useTranslation();
  const { state, handlers } = useBinSlantSection(bin, layout);
  if (!state.visible) return null;

  const isMobile = variant === 'mobile';
  const { config, designSlant } = state;
  const sideLabel = (side: SlantSide): string => t(`binDesigner.overhang.side.${side}`);
  const sides: SegmentedControlOption<SlantSide>[] = SIDES.map((side) => ({
    value: side,
    label: sideLabel(side),
  }));
  const hint = 'mt-1 px-2 text-micro leading-snug';

  return (
    <div data-testid="bin-slant-section">
      {designSlant ? (
        <>
          <div className={`${isMobile ? 'text-sm' : 'text-xs'} px-2 text-content-tertiary`}>
            {t('binDesigner.slant.title')}
          </div>
          <p className={`${hint} text-content-disabled`}>
            {t('inspector.slant.fromDesign', {
              angle: designSlant.angleDeg,
              side: sideLabel(designSlant.side),
            })}
          </p>
        </>
      ) : (
        <CheckboxRow
          label={t('binDesigner.slant.title')}
          checked={state.placed !== undefined}
          disabled={state.heldBy !== null && state.placed === undefined}
          onChange={handlers.toggle}
        />
      )}

      {state.heldBy !== null && (
        <p className={`${hint} text-content-disabled`}>
          {t(`inspector.slant.heldBy.${state.heldBy}`)}
        </p>
      )}

      {config && state.heldBy === null && (
        <div className="mt-2 flex flex-col gap-2 px-2">
          <div>
            <div className="mb-1 text-micro text-content-tertiary">
              {t('binDesigner.slant.angle')}
            </div>
            {/* The stepper keeps what was typed until its value changes, which a refused edit does not. */}
            <Stepper
              key={state.refusals}
              value={config.angleDeg}
              onChange={handlers.setAngle}
              onStep={(delta) => handlers.setAngle(config.angleDeg + delta * ANGLE_STEP_DEG)}
              min={SLANT_MIN_DEG}
              max={SLANT_MAX_DEG}
              step={1}
              size={isMobile ? 'lg' : 'md'}
              fullWidth
              aria-label={t('binDesigner.slant.angleAria')}
            />
          </div>
          <SegmentedControl
            options={sides}
            value={config.side}
            onChange={handlers.setSide}
            aria-label={t('binDesigner.slant.side')}
            size="sm"
            fullWidth
          />
          <CheckboxRow
            label={t('binDesigner.slant.endSupport')}
            checked={config.endSupport === true}
            onChange={handlers.setEndSupport}
          />
          {state.steep && <p className="text-micro text-warning">{t('binDesigner.slant.steep')}</p>}
        </div>
      )}

      {/* Reachable while the bin stands upright, or the override would wait unseen. */}
      {state.placed && designSlant && (
        <div className="mt-2 px-2">
          <Button variant="ghost" size="sm" type="button" onClick={handlers.useDesign}>
            {t('inspector.slant.useDesign')}
          </Button>
        </div>
      )}

      {state.refused && <p className={`${hint} text-warning`}>{t('inspector.slant.noRoom')}</p>}

      {state.issue && (
        <div className="mt-2 flex items-center gap-2 px-2">
          <p className="flex-1 text-micro leading-snug text-warning">
            {t(`inspector.slant.issue.${state.issue}`)}
          </p>
          {state.canMatchRow && (
            <Button variant="secondary" size="sm" type="button" onClick={handlers.matchRow}>
              {t('inspector.slant.matchRow')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
