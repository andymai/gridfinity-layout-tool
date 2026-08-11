/**
 * Full-workspace bento editor layout shell.
 *
 * Replaces the sidebar when `bentoWorkspaceOpen` is true, giving the
 * compartment grid the room the 288px panel could not. The grid, its editing
 * model and every merge/split rule are shared with the sidebar editor via
 * `useCompartmentGrid` / `CompartmentGridView`; what this adds is size, mm
 * rulers, and the 3D preview sitting alongside (wired by DesignerMainContent).
 *
 * Escape closes it, matching the cutout workspace and the editor's other modes.
 */

import { useEffect, useRef } from 'react';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useTranslation } from '@/i18n';
import { useCompartmentGrid } from '../CompartmentEditor/useCompartmentGrid';
import { CompartmentGridView } from '../CompartmentEditor/CompartmentGridView';
import { TopRuler, LeftRuler, RulerCorner } from '../CutoutWorkspace/Rulers';
import { BentoWorkspaceHeader } from './BentoWorkspaceHeader';
import { useBentoCanvasBox } from './useBentoCanvasBox';

export function BentoWorkspace() {
  const t = useTranslation();
  const setBentoWorkspaceOpen = useDesignerStore((s) => s.setBentoWorkspaceOpen);
  const grid = useCompartmentGrid();
  const { aspectRatio, interiorW, interiorD, isDragging, selectionAction, hoveredIsSplittable } =
    grid;

  const containerRef = useRef<HTMLDivElement>(null);
  const box = useBentoCanvasBox(containerRef, aspectRatio, interiorW, interiorD);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setBentoWorkspaceOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setBentoWorkspaceOpen]);

  return (
    <div className="flex h-full flex-col bg-surface">
      <BentoWorkspaceHeader grid={grid} onClose={() => setBentoWorkspaceOpen(false)} />

      <div ref={containerRef} className="relative flex flex-1 items-center justify-center p-6">
        {box.width > 0 && (
          <div className="flex flex-col">
            <div className="flex">
              <RulerCorner />
              <TopRuler
                extent={interiorW}
                scale={box.scaleX}
                zoom={1}
                panOffset={0}
                length={box.width}
              />
            </div>
            <div className="flex">
              <LeftRuler
                extent={interiorD}
                scale={box.scaleY}
                zoom={1}
                panOffset={0}
                length={box.height}
              />
              <CompartmentGridView
                grid={grid}
                style={{ width: `${box.width}px`, height: `${box.height}px` }}
                describedById="bento-workspace-instructions"
              />
            </div>
          </div>
        )}
      </div>

      <footer className="flex flex-shrink-0 items-center gap-3 border-t border-stroke-subtle bg-surface-secondary px-4 py-2">
        <p
          id="bento-workspace-instructions"
          className={`text-xs transition-colors duration-150 ${
            isDragging && selectionAction !== 'none'
              ? 'font-medium text-accent'
              : hoveredIsSplittable
                ? 'text-content-secondary'
                : 'text-content-tertiary'
          }`}
          aria-live={isDragging ? 'off' : 'polite'}
        >
          {grid.instructionText}
        </p>
        <p className="ml-auto text-xs tabular-nums text-content-tertiary">
          {t('binDesigner.bento.interiorReadout', {
            width: Math.round(interiorW),
            depth: Math.round(interiorD),
          })}
        </p>
      </footer>
    </div>
  );
}
