/**
 * Wall Cutouts section: Per-side width + depth controls and interior divider cutout.
 *
 * Controls the WallConfig: enable/disable cutouts per wall side with
 * width and depth percentage sliders, plus uniform interior divider cutouts.
 *
 * Guards:
 * - Disabled for solid bins (no cavity to expose)
 * - Corner integrity warning when adjacent walls both have wide cutouts
 * - Stacking lip info text (lip is cut through in the notch region)
 */

import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { CollapsibleSection } from '@/shared/components/CollapsibleSection';
import { FeatureToggle } from './FeatureToggle';
import { SliderInput } from '../controls/SliderInput';
import { WallCutoutsIcon } from './SectionIllustrations';
import { getCompartmentCount } from '../../utils/compartments';
import type { WallCutout, WallConfig } from '../../types';
import { useTranslation } from '@/i18n';

const SIDES = ['front', 'back', 'left', 'right'] as const;
type Side = (typeof SIDES)[number];

const SIDE_LABELS: Record<Side, string> = {
  front: 'Front wall',
  back: 'Back wall',
  left: 'Left wall',
  right: 'Right wall',
};

/** Adjacent wall pairs that share a corner */
const ADJACENT_PAIRS: Array<[Side, Side]> = [
  ['front', 'left'],
  ['front', 'right'],
  ['back', 'left'],
  ['back', 'right'],
];

function cutoutSummary(cutout: WallCutout): string | undefined {
  if (cutout.width <= 0 || cutout.depth <= 0) return undefined;
  return `${cutout.width}% \u00d7 ${cutout.depth}%`;
}

/** Check if two adjacent walls both have wide+deep cutouts that could weaken corners */
function hasCornerConflict(walls: WallConfig): boolean {
  return ADJACENT_PAIRS.some(([a, b]) => {
    const cutA = walls[a];
    const cutB = walls[b];
    return cutA.width >= 80 && cutA.depth >= 60 && cutB.width >= 80 && cutB.depth >= 60;
  });
}

export function WallCutoutsSection() {
  const { walls, compartments, style, stackingLip, setParam } = useDesignerStore(
    useShallow((s) => ({
      walls: s.params.walls,
      compartments: s.params.compartments,
      style: s.params.style,
      stackingLip: s.params.base.stackingLip,
      setParam: s.setParam,
    }))
  );
  const t = useTranslation();

  const isSolid = style === 'solid';
  const compartmentCount = getCompartmentCount(compartments);
  const hasMultipleCompartments = compartmentCount > 1;

  const updateSide = (side: Side | 'interior', updates: Partial<WallCutout>) => {
    const newWalls: WallConfig = {
      ...walls,
      [side]: { ...walls[side], ...updates },
    };
    setParam('walls', newWalls);
  };

  const toggleSide = (side: Side | 'interior') => {
    const current = walls[side];
    if (current.width > 0) {
      updateSide(side, { width: 0, depth: 0 });
    } else {
      updateSide(side, { width: 80, depth: 60 });
    }
  };

  // Count enabled sides for summary
  const enabledSides = SIDES.filter((s) => walls[s].width > 0 && walls[s].depth > 0);
  const summary =
    enabledSides.length > 0
      ? isSolid
        ? 'N/A (solid)'
        : `${enabledSides.length} wall${enabledSides.length > 1 ? 's' : ''}`
      : undefined;

  const cornerWarning = hasCornerConflict(walls);
  const anyEnabled = enabledSides.length > 0;

  return (
    <CollapsibleSection
      title={t('binDesigner.wallCutouts')}
      defaultExpanded={true}
      illustration={<WallCutoutsIcon />}
      summary={summary}
    >
      {isSolid ? (
        <p className="text-[11px] text-content-tertiary">
          Not available for solid bins (no interior cavity).
        </p>
      ) : (
        <div className="space-y-2">
          {SIDES.map((side) => (
            <FeatureToggle
              key={side}
              label={SIDE_LABELS[side]}
              checked={walls[side].width > 0}
              onChange={() => toggleSide(side)}
              valueSummary={cutoutSummary(walls[side])}
            >
              <div className="space-y-2">
                <SliderInput
                  label="Width"
                  value={walls[side].width}
                  onChange={(v) => updateSide(side, { width: v })}
                  min={20}
                  max={100}
                  step={5}
                  unit="%"
                  info="Centered notch width along wall"
                />
                <SliderInput
                  label="Depth"
                  value={walls[side].depth}
                  onChange={(v) => updateSide(side, { depth: v })}
                  min={20}
                  max={100}
                  step={5}
                  unit="%"
                  info="How far down from wall top"
                />
              </div>
            </FeatureToggle>
          ))}

          {/* Warnings */}
          {anyEnabled && stackingLip && (
            <p className="text-[10px] text-content-tertiary mt-1">
              Stacking lip will be cut through in the notch region.
            </p>
          )}
          {cornerWarning && (
            <p className="text-[10px] text-warning mt-1">
              Adjacent walls with wide cutouts may weaken corners.
            </p>
          )}

          {hasMultipleCompartments && (
            <>
              <div className="my-2 border-t border-stroke-subtle" />
              <FeatureToggle
                label="Interior dividers"
                checked={walls.interior.width > 0}
                onChange={() => toggleSide('interior')}
                valueSummary={cutoutSummary(walls.interior)}
              >
                <div className="space-y-2">
                  <SliderInput
                    label="Width"
                    value={walls.interior.width}
                    onChange={(v) => updateSide('interior', { width: v })}
                    min={20}
                    max={100}
                    step={5}
                    unit="%"
                  />
                  <SliderInput
                    label="Depth"
                    value={walls.interior.depth}
                    onChange={(v) => updateSide('interior', { depth: v })}
                    min={20}
                    max={100}
                    step={5}
                    unit="%"
                    info="Divider notch depth from top (no lip on dividers)"
                  />
                </div>
              </FeatureToggle>
            </>
          )}
        </div>
      )}
    </CollapsibleSection>
  );
}
