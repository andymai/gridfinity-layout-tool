import { useState } from 'react';
import { useLayoutStore, useUndoableAction } from '../../store';
import { calcMaxGridUnits } from '../../constants';
import { ConfirmDialog } from '../modals/ConfirmDialog';
import { DeferredNumberInput } from '../DeferredNumberInput';

/**
 * Mobile settings panel with grid configuration and app actions.
 */
export function MobileSettingsPanel() {
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const layout = useLayoutStore(state => state.layout);
  const setGridUnitMm = useLayoutStore(state => state.setGridUnitMm);
  const setHeightUnitMm = useLayoutStore(state => state.setHeightUnitMm);
  const setPrintBedSize = useLayoutStore(state => state.setPrintBedSize);
  const updateDrawer = useLayoutStore(state => state.updateDrawer);
  const reset = useLayoutStore(state => state.reset);

  const maxGridUnits = calcMaxGridUnits(layout.printBedSize, layout.gridUnitMm);
  const { execute } = useUndoableAction();

  const handleDrawerHeightChange = (delta: number) => {
    const newHeight = Math.max(1, layout.drawer.height + delta);
    execute(() => updateDrawer({ height: newHeight }));
  };

  return (
    <div className="pb-4 space-y-6">
      {/* Drawer Dimensions */}
      <section>
        <h3 className="text-xs font-medium uppercase tracking-wide mb-3 text-content-tertiary">
          Drawer Dimensions
        </h3>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1 text-content-secondary">
              Width (units)
            </label>
            <DeferredNumberInput
              value={layout.drawer.width}
              onChange={(v) => updateDrawer({ width: v })}
              className="input w-full h-12"
              min={1}
              max={50}
            />
          </div>
          <div>
            <label className="block text-sm mb-1 text-content-secondary">
              Depth (units)
            </label>
            <DeferredNumberInput
              value={layout.drawer.depth}
              onChange={(v) => updateDrawer({ depth: v })}
              className="input w-full h-12"
              min={1}
              max={50}
            />
          </div>
        </div>

        {/* Drawer Height */}
        <div className="flex items-center justify-between mt-3 p-3 rounded-lg bg-surface-elevated">
          <span className="text-content-secondary text-sm">
            Height (units)
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleDrawerHeightChange(-1)}
              disabled={layout.drawer.height <= 1}
              className="btn btn-secondary w-10 h-10 p-0"
              aria-label="Decrease drawer height"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <span className="w-12 text-center font-semibold text-content text-lg">
              {layout.drawer.height}u
            </span>
            <button
              onClick={() => handleDrawerHeightChange(1)}
              className="btn btn-secondary w-10 h-10 p-0"
              aria-label="Increase drawer height"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>
      </section>

      {/* Grid Settings */}
      <section>
        <h3 className="text-xs font-medium uppercase tracking-wide mb-3 text-content-tertiary">
          Grid Settings
        </h3>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm text-content-secondary">
              1 grid unit
            </label>
            <div className="flex items-center gap-2">
              <DeferredNumberInput
                value={layout.gridUnitMm}
                onChange={setGridUnitMm}
                className="input w-20 h-10 text-center"
                min={1}
                max={200}
              />
              <span className="text-content-tertiary">mm</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm text-content-secondary">
              1u height
            </label>
            <div className="flex items-center gap-2">
              <DeferredNumberInput
                value={layout.heightUnitMm}
                onChange={setHeightUnitMm}
                className="input w-20 h-10 text-center"
                min={1}
                max={50}
              />
              <span className="text-content-tertiary">mm</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm text-content-secondary">
              Print bed size
            </label>
            <div className="flex items-center gap-2">
              <DeferredNumberInput
                value={layout.printBedSize}
                onChange={setPrintBedSize}
                className="input w-20 h-10 text-center"
                min={42}
                max={500}
                step={10}
              />
              <span className="text-content-tertiary">mm</span>
            </div>
          </div>

          <div className="text-sm text-right text-content-disabled">
            Max bin size: {maxGridUnits}×{maxGridUnits}
          </div>
        </div>
      </section>

      {/* Actions */}
      <section>
        <h3 className="text-xs font-medium uppercase tracking-wide mb-3 text-content-tertiary">
          Actions
        </h3>

        <div className="space-y-2">
          <button
            onClick={() => setShowResetConfirm(true)}
            className="btn btn-danger w-full"
          >
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Reset to Defaults
          </button>
        </div>
      </section>

      {/* Info */}
      <section className="pt-4 text-center border-t border-stroke-subtle">
        <div className="text-xs text-content-disabled leading-relaxed">
          <a
            href="https://www.youtube.com/c/ZackFreedman"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline text-content-tertiary"
          >
            Gridfinity
          </a>
          {' '}by Zack Freedman
          <br />
          Tool by{' '}
          <a
            href="https://www.linkedin.com/in/andyhmai/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline text-content-tertiary"
          >
            Andy Aragon
          </a>
        </div>
      </section>

      <ConfirmDialog
        isOpen={showResetConfirm}
        title="Reset to Defaults"
        message="This will clear your layout and restore all default settings. This cannot be undone."
        confirmText="Reset"
        destructive
        onConfirm={() => { reset(); setShowResetConfirm(false); }}
        onCancel={() => setShowResetConfirm(false)}
      />
    </div>
  );
}
