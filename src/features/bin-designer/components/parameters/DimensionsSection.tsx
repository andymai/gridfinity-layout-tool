/**
 * Dimensions section: Width, Depth, and Height sliders with quick-select presets.
 * Shows computed mm values below each slider.
 */

import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { GRIDFINITY, DESIGNER_CONSTRAINTS } from '@/features/bin-designer/constants';
import { SliderInput } from '../controls/SliderInput';
import { QuickSelect } from '../controls/QuickSelect';

const DIMENSION_PRESETS = [1, 2, 3, 4];
const HEIGHT_PRESETS = [3, 6, 9, 12];

export function DimensionsSection() {
  const { width, depth, height, setParam } = useDesignerStore(
    useShallow((s) => ({
      width: s.params.width,
      depth: s.params.depth,
      height: s.params.height,
      setParam: s.setParam,
    }))
  );

  return (
    <div className="space-y-4">
      {/* Width */}
      <div className="space-y-1.5">
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
        <QuickSelect
          value={width}
          options={DIMENSION_PRESETS}
          onChange={(v) => setParam('width', v)}
          ariaLabel="Width presets"
        />
      </div>

      {/* Depth */}
      <div className="space-y-1.5">
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
        <QuickSelect
          value={depth}
          options={DIMENSION_PRESETS}
          onChange={(v) => setParam('depth', v)}
          ariaLabel="Depth presets"
        />
      </div>

      {/* Height */}
      <div className="space-y-1.5">
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
        <QuickSelect
          value={height}
          options={HEIGHT_PRESETS}
          onChange={(v) => setParam('height', v)}
          ariaLabel="Height presets"
        />
      </div>
    </div>
  );
}
