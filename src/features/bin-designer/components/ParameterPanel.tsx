/**
 * Parameter panel for replicad-based bin generation.
 * Contains tabbed sections: Dimensions, Base, Compartments, Walls.
 */

import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { GRIDFINITY, DESIGNER_CONSTRAINTS } from '@/features/bin-designer/constants';
import { SliderInput } from './controls/SliderInput';
import { ThicknessSelector } from './controls/ThicknessSelector';
import { CompartmentEditor } from './CompartmentEditor';
import type { BaseConfig, BaseStyle, BinStyle, DesignerTab } from '@/features/bin-designer/types';

/** Derive base style from individual magnet/screw booleans */
function computeBaseStyle(magnet: boolean, screw: boolean): BaseStyle {
  if (magnet && screw) return 'magnet_and_screw';
  if (magnet) return 'magnet';
  if (screw) return 'screw';
  return 'standard';
}

const TAB_LABELS: Record<DesignerTab, string> = {
  dimensions: 'Size',
  base: 'Base',
  compartments: 'Compartments',
  walls: 'Walls',
  style: 'Style',
};

const ACTIVE_TABS: DesignerTab[] = ['dimensions', 'base', 'compartments', 'walls'];

export function ParameterPanel() {
  const { width, depth, height, wallThickness, base, style, activeTab, setParam, setActiveTab } = useDesignerStore(
    useShallow((s) => ({
      width: s.params.width,
      depth: s.params.depth,
      height: s.params.height,
      wallThickness: s.params.wallThickness,
      base: s.params.base,
      style: s.params.style,
      activeTab: s.ui.activeTab,
      setParam: s.setParam,
      setActiveTab: s.setActiveTab,
    }))
  );

  const hasMagnet = base.style === 'magnet' || base.style === 'magnet_and_screw';
  const hasScrew = base.style === 'screw' || base.style === 'magnet_and_screw';
  const keepFull = style === 'solid';

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

  const toggleKeepFull = useCallback(() => {
    const newStyle: BinStyle = keepFull ? 'standard' : 'solid';
    setParam('style', newStyle);
  }, [keepFull, setParam]);

  const setMagnetRadius = useCallback(
    (radius: number) => {
      const newBase: BaseConfig = { ...base, magnetDiameter: radius * 2 };
      setParam('base', newBase);
    },
    [base, setParam]
  );

  const setMagnetHeight = useCallback(
    (depth: number) => {
      const newBase: BaseConfig = { ...base, magnetDepth: depth };
      setParam('base', newBase);
    },
    [base, setParam]
  );

  const setScrewRadius = useCallback(
    (radius: number) => {
      const newBase: BaseConfig = { ...base, screwDiameter: radius * 2 };
      setParam('base', newBase);
    },
    [base, setParam]
  );

  return (
    <div className="flex h-full flex-col">
      {/* Tab bar */}
      <div className="flex border-b border-stroke-subtle bg-surface-tertiary">
        {ACTIVE_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-2 py-2 text-xs font-medium transition-colors ${
              activeTab === tab
                ? 'border-b-2 border-accent text-accent'
                : 'text-content-tertiary hover:text-content-secondary'
            }`}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'dimensions' && (
        <div className="flex-1 overflow-y-auto px-4 py-3">
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
        </div>
      )}

      {activeTab === 'base' && (
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <div className="space-y-2">
            <ToggleRow
              label="Magnet holes"
              checked={hasMagnet}
              onChange={toggleMagnet}
            />
            {hasMagnet && (
              <div className="ml-4 space-y-3 border-l border-stroke-subtle pl-3 pt-1">
                <SliderInput
                  label="Magnet radius"
                  value={base.magnetDiameter / 2}
                  onChange={setMagnetRadius}
                  min={DESIGNER_CONSTRAINTS.MIN_MAGNET_RADIUS}
                  max={DESIGNER_CONSTRAINTS.MAX_MAGNET_RADIUS}
                  step={DESIGNER_CONSTRAINTS.MAGNET_RADIUS_STEP}
                  unit="mm"
                />
                <SliderInput
                  label="Magnet height"
                  value={base.magnetDepth}
                  onChange={setMagnetHeight}
                  min={DESIGNER_CONSTRAINTS.MIN_MAGNET_HEIGHT}
                  max={DESIGNER_CONSTRAINTS.MAX_MAGNET_HEIGHT}
                  step={DESIGNER_CONSTRAINTS.MAGNET_HEIGHT_STEP}
                  unit="mm"
                />
              </div>
            )}
            <ToggleRow
              label="Screw holes"
              checked={hasScrew}
              onChange={toggleScrew}
            />
            {hasScrew && (
              <div className="ml-4 space-y-3 border-l border-stroke-subtle pl-3 pt-1">
                <SliderInput
                  label="Screw radius"
                  value={base.screwDiameter / 2}
                  onChange={setScrewRadius}
                  min={DESIGNER_CONSTRAINTS.MIN_SCREW_RADIUS}
                  max={DESIGNER_CONSTRAINTS.MAX_SCREW_RADIUS}
                  step={DESIGNER_CONSTRAINTS.SCREW_RADIUS_STEP}
                  unit="mm"
                />
              </div>
            )}
            <ToggleRow
              label="Stacking lip"
              checked={base.stackingLip}
              onChange={toggleStackingLip}
            />
          </div>
        </div>
      )}

      {activeTab === 'compartments' && <CompartmentEditor />}

      {activeTab === 'walls' && (
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <div className="space-y-2">
            <ToggleRow
              label="Keep full (solid)"
              checked={keepFull}
              onChange={toggleKeepFull}
            />
            {!keepFull && (
              <div className="ml-4 space-y-3 border-l border-stroke-subtle pl-3 pt-1">
                <ThicknessSelector
                  label="Wall thickness"
                  value={wallThickness}
                  onChange={(v) => setParam('wallThickness', v)}
                />
              </div>
            )}
          </div>
        </div>
      )}
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
