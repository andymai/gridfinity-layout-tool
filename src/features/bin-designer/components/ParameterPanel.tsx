/**
 * Simplified parameter panel for replicad-based bin generation.
 * Contains dimension sliders (width, depth, height) and base feature toggles
 * (magnet holes, screw holes, stacking lip).
 */

import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { GRIDFINITY, DESIGNER_CONSTRAINTS } from '@/features/bin-designer/constants';
import { SliderInput } from './controls/SliderInput';
import type { BaseConfig, BaseStyle } from '@/features/bin-designer/types';

/** Derive base style from individual magnet/screw booleans */
function computeBaseStyle(magnet: boolean, screw: boolean): BaseStyle {
  if (magnet && screw) return 'magnet_and_screw';
  if (magnet) return 'magnet';
  if (screw) return 'screw';
  return 'standard';
}

export function ParameterPanel() {
  const { width, depth, height, base, setParam } = useDesignerStore(
    useShallow((s) => ({
      width: s.params.width,
      depth: s.params.depth,
      height: s.params.height,
      base: s.params.base,
      setParam: s.setParam,
    }))
  );

  const hasMagnet = base.style === 'magnet' || base.style === 'magnet_and_screw';
  const hasScrew = base.style === 'screw' || base.style === 'magnet_and_screw';

  const toggleMagnet = useCallback(() => {
    const newMagnet = !hasMagnet;
    const newBase: BaseConfig = {
      ...base,
      style: computeBaseStyle(newMagnet, hasScrew),
    };
    setParam('base', newBase);
  }, [base, hasMagnet, hasScrew, setParam]);

  const toggleScrew = useCallback(() => {
    const newScrew = !hasScrew;
    const newBase: BaseConfig = {
      ...base,
      style: computeBaseStyle(hasMagnet, newScrew),
    };
    setParam('base', newBase);
  }, [base, hasMagnet, hasScrew, setParam]);

  const toggleStackingLip = useCallback(() => {
    const newBase: BaseConfig = {
      ...base,
      stackingLip: !base.stackingLip,
    };
    setParam('base', newBase);
  }, [base, setParam]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="space-y-6">
          {/* Dimensions */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-content-tertiary">
              Dimensions
            </h3>
            <div className="space-y-4">
              <SliderInput
                label="Width"
                value={width}
                onChange={(v) => setParam('width', v)}
                min={DESIGNER_CONSTRAINTS.MIN_DIMENSION}
                max={DESIGNER_CONSTRAINTS.MAX_DIMENSION}
                step={DESIGNER_CONSTRAINTS.DIMENSION_STEP}
                unit="u"
                info={`${(width * GRIDFINITY.GRID_SIZE).toFixed(0)}mm`}
              />
              <SliderInput
                label="Depth"
                value={depth}
                onChange={(v) => setParam('depth', v)}
                min={DESIGNER_CONSTRAINTS.MIN_DIMENSION}
                max={DESIGNER_CONSTRAINTS.MAX_DIMENSION}
                step={DESIGNER_CONSTRAINTS.DIMENSION_STEP}
                unit="u"
                info={`${(depth * GRIDFINITY.GRID_SIZE).toFixed(0)}mm`}
              />
              <SliderInput
                label="Height"
                value={height}
                onChange={(v) => setParam('height', v)}
                min={DESIGNER_CONSTRAINTS.MIN_HEIGHT}
                max={DESIGNER_CONSTRAINTS.MAX_HEIGHT}
                step={DESIGNER_CONSTRAINTS.HEIGHT_STEP}
                unit="u"
                info={`${(height * GRIDFINITY.HEIGHT_UNIT).toFixed(0)}mm body + ${GRIDFINITY.LIP_HEIGHT}mm lip`}
              />
            </div>
          </section>

          {/* Base Features */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-content-tertiary">
              Base
            </h3>
            <div className="space-y-2">
              <ToggleRow
                label="Magnet holes"
                checked={hasMagnet}
                onChange={toggleMagnet}
              />
              <ToggleRow
                label="Screw holes"
                checked={hasScrew}
                onChange={toggleScrew}
              />
              <ToggleRow
                label="Stacking lip"
                checked={base.stackingLip}
                onChange={toggleStackingLip}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/** Simple labeled toggle switch */
function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between py-1">
      <span className="text-xs text-content-secondary">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${
          checked ? 'bg-accent' : 'bg-stroke-subtle'
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </button>
    </label>
  );
}
