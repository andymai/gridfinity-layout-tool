/**
 * Scoop section: Finger scoop toggle with radius and row controls.
 *
 * Controls the ScoopConfig: enable/disable scoops, set radius
 * (auto or manual override), and toggle all-rows mode.
 *
 * Dynamically computes the effective max radius from compartment
 * dimensions and wall height to prevent oversized scoops.
 */

import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { CollapsibleSection } from '@/shared/components/CollapsibleSection';
import { FeatureToggle } from './FeatureToggle';
import { SliderInput } from '../controls/SliderInput';
import { ScoopIcon } from './SectionIllustrations';
import { DESIGNER_CONSTRAINTS, GRIDFINITY } from '../../constants';

export function ScoopSection() {
  const { scoop, width, depth, height, wallThickness, compartments, style, setParam } =
    useDesignerStore(
      useShallow((s) => ({
        scoop: s.params.scoop,
        width: s.params.width,
        depth: s.params.depth,
        height: s.params.height,
        wallThickness: s.params.wallThickness,
        compartments: s.params.compartments,
        style: s.params.style,
        setParam: s.setParam,
      }))
    );

  const isSolid = style === 'solid';

  // Compute the effective max radius the generator will use
  const outerW = width * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE;
  const outerD = depth * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE;
  const innerW = outerW - 2 * wallThickness;
  const innerD = outerD - 2 * wallThickness;
  const wallHeight = height * GRIDFINITY.HEIGHT_UNIT - GRIDFINITY.BASE_HEIGHT;
  const compartmentW = innerW / compartments.cols;
  const compartmentD = innerD / compartments.rows;
  const effectiveMax = Math.min(
    Math.floor(wallHeight * 0.75),
    Math.floor(Math.min(compartmentW / 2, compartmentD / 2)),
    DESIGNER_CONSTRAINTS.MAX_SCOOP_RADIUS
  );
  const clampedMax = Math.max(effectiveMax, DESIGNER_CONSTRAINTS.MIN_SCOOP_RADIUS);

  const handleToggle = () => {
    setParam('scoop', { ...scoop, enabled: !scoop.enabled });
  };

  const handleRadiusChange = (value: number) => {
    setParam('scoop', { ...scoop, radius: value });
  };

  const handleResetRadius = () => {
    setParam('scoop', { ...scoop, radius: 'auto' });
  };

  const handleAllRowsToggle = () => {
    setParam('scoop', { ...scoop, allRows: !scoop.allRows });
  };

  const summary = scoop.enabled
    ? isSolid
      ? 'N/A (solid)'
      : scoop.radius === 'auto'
        ? 'Auto radius'
        : `${scoop.radius}mm radius`
    : undefined;

  const valueSummary = scoop.radius === 'auto' ? 'Auto radius' : `${scoop.radius}mm`;

  // Compute info text for radius
  let radiusInfo: string | undefined;
  if (scoop.radius === 'auto') {
    radiusInfo = 'Auto: sized to compartment';
  } else if (scoop.radius > clampedMax) {
    radiusInfo = `Will be clamped to ${clampedMax}mm (compartment limit)`;
  }

  return (
    <CollapsibleSection
      title="Scoops"
      defaultExpanded={true}
      illustration={<ScoopIcon />}
      summary={summary}
    >
      {isSolid ? (
        <p className="text-[11px] text-content-tertiary">
          Not available for solid bins (no interior cavity).
        </p>
      ) : (
        <FeatureToggle
          label="Finger scoops"
          checked={scoop.enabled}
          onChange={handleToggle}
          valueSummary={valueSummary}
        >
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-content-secondary">Radius</span>
                {scoop.radius !== 'auto' && (
                  <button
                    type="button"
                    onClick={handleResetRadius}
                    className="text-[10px] text-accent hover:text-accent/80 transition-colors"
                  >
                    Reset to auto
                  </button>
                )}
              </div>
              <SliderInput
                label="Radius"
                value={scoop.radius === 'auto' ? Math.min(10, clampedMax) : scoop.radius}
                onChange={handleRadiusChange}
                min={DESIGNER_CONSTRAINTS.MIN_SCOOP_RADIUS}
                max={clampedMax}
                step={1}
                unit="mm"
                info={radiusInfo}
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={scoop.allRows}
                onChange={handleAllRowsToggle}
                className="h-3.5 w-3.5 rounded border-stroke-subtle text-accent focus:ring-accent"
              />
              <span className="text-xs text-content-secondary">All rows</span>
              <span className="text-[10px] text-content-tertiary">(not just front)</span>
            </label>
          </div>
        </FeatureToggle>
      )}
    </CollapsibleSection>
  );
}
