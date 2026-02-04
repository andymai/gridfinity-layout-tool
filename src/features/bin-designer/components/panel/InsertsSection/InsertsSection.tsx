/**
 * Floor inserts section for placing cutouts from the library.
 *
 * Allows users to:
 * - Add cutouts from the cutout library
 * - Add primitive shapes (rectangle, circle, etc.)
 * - Edit position, size, rotation, and cut depth
 * - Remove inserts
 *
 * Note: Library items are passed as props to avoid cross-feature imports.
 * The parent component is responsible for providing cutout library data.
 */

import { useState } from 'react';
import { CollapsibleSection } from '@/shared/components/CollapsibleSection';
import { StepperControl } from '@/shared/components/StepperControl';
import { useInsertsSection } from './useInsertsSection';
import type { InsertShape, Insert } from '../../../types';
import type { InsertLibraryItem } from './useInsertsSection';

const PRIMITIVE_SHAPES: Array<{ shape: Exclude<InsertShape, 'custom'>; icon: string }> = [
  { shape: 'rectangle', icon: '▭' },
  { shape: 'circle', icon: '○' },
  { shape: 'rounded-rect', icon: '▢' },
  { shape: 'slot', icon: '⊂' },
];

const ROTATION_OPTIONS: Array<0 | 90 | 180 | 270> = [0, 90, 180, 270];

export interface InsertsSectionProps {
  /** Cutout templates from the library */
  libraryItems?: InsertLibraryItem[];
  /** Whether the library is currently loading */
  isLibraryLoading?: boolean;
}

export function InsertsSection({
  libraryItems = [],
  isLibraryLoading = false,
}: InsertsSectionProps) {
  const { state, handlers, meta, t } = useInsertsSection();
  const [showLibrary, setShowLibrary] = useState(false);

  const handleAddFromLibrary = (item: InsertLibraryItem) => {
    handlers.addFromTemplate(item);
    setShowLibrary(false);
  };

  return (
    <CollapsibleSection
      title={t('binDesigner.floorInserts')}
      defaultExpanded
      summary={meta.summary}
    >
      <div className="flex flex-col gap-3">
        {/* Add buttons */}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setShowLibrary(!showLibrary)}
            className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-stroke-subtle bg-surface-secondary px-3 py-2 text-sm text-content-secondary hover:bg-surface-hover transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            {t('binDesigner.addFromLibrary')}
          </button>

          {/* Primitive shapes row */}
          <div className="flex gap-1">
            {PRIMITIVE_SHAPES.map(({ shape, icon }) => (
              <button
                key={shape}
                type="button"
                onClick={() => handlers.addPrimitiveShape(shape)}
                className="flex-1 rounded border border-stroke-subtle bg-surface-elevated px-2 py-1.5 text-sm hover:bg-surface-hover transition-colors"
                title={t(`binDesigner.insertShape.${shape}`)}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>

        {/* Library picker */}
        {showLibrary && (
          <div className="rounded-lg border border-stroke-subtle bg-surface-secondary p-2">
            <div className="text-xs font-medium text-content-secondary mb-2">
              {t('binDesigner.selectCutout')}
            </div>
            {isLibraryLoading ? (
              <div className="text-xs text-content-tertiary py-4 text-center">
                {t('common.loading')}
              </div>
            ) : libraryItems.length === 0 ? (
              <div className="text-xs text-content-tertiary py-4 text-center">
                {t('binDesigner.noCustomCutouts')}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1 max-h-32 overflow-y-auto">
                {libraryItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleAddFromLibrary(item)}
                    className="flex flex-col items-center gap-1 rounded border border-stroke-subtle bg-surface-elevated p-1.5 hover:bg-surface-hover transition-colors"
                  >
                    {item.thumbnail ? (
                      <img
                        src={item.thumbnail}
                        alt={item.name}
                        className="h-8 w-8 object-contain"
                      />
                    ) : (
                      <div className="h-8 w-8 bg-surface-secondary rounded flex items-center justify-center">
                        <svg
                          className="h-4 w-4 text-content-tertiary"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                      </div>
                    )}
                    <span className="text-[10px] text-content-secondary truncate w-full text-center">
                      {item.name}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Inserts list */}
        {state.inserts.length > 0 && (
          <div className="flex flex-col gap-2">
            {state.inserts.map((insert) => (
              <InsertItem
                key={insert.id}
                insert={insert}
                isSelected={insert.id === state.selectedInsertId}
                interiorWidth={state.interiorDimensions.width}
                interiorDepth={state.interiorDimensions.depth}
                onSelect={() => handlers.setSelectedInsertId(insert.id)}
                onDelete={() => handlers.deleteInsert(insert.id)}
                onPositionChange={(x, y) => handlers.setPosition(insert.id, x, y)}
                onSizeChange={(w, d) => handlers.setSize(insert.id, w, d)}
                onRotationChange={(r) => handlers.setRotation(insert.id, r)}
                onCutDepthChange={(d) => handlers.setCutDepth(insert.id, d)}
                t={t}
              />
            ))}

            {/* Clear all button */}
            {state.inserts.length > 1 && (
              <button
                type="button"
                onClick={handlers.clearInserts}
                className="text-xs text-error hover:underline self-end"
              >
                {t('binDesigner.clearAllInserts')}
              </button>
            )}
          </div>
        )}

        {/* Empty state */}
        {state.inserts.length === 0 && !showLibrary && (
          <div className="text-xs text-content-tertiary text-center py-2">
            {t('binDesigner.noInserts')}
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}

interface InsertItemProps {
  insert: Insert;
  isSelected: boolean;
  interiorWidth: number;
  interiorDepth: number;
  onSelect: () => void;
  onDelete: () => void;
  onPositionChange: (x: number, y: number) => void;
  onSizeChange: (width: number, depth: number) => void;
  onRotationChange: (rotation: 0 | 90 | 180 | 270) => void;
  onCutDepthChange: (depth: number) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

function InsertItem({
  insert,
  isSelected,
  interiorWidth,
  interiorDepth,
  onSelect,
  onDelete,
  onPositionChange,
  onSizeChange,
  onRotationChange,
  onCutDepthChange,
  t,
}: InsertItemProps) {
  const shapeLabel =
    insert.shape === 'custom'
      ? insert.label || t('binDesigner.customShape')
      : t(`binDesigner.insertShape.${insert.shape}`);

  return (
    <div
      className={`rounded-lg border p-2 transition-colors ${
        isSelected
          ? 'border-accent bg-accent/5'
          : 'border-stroke-subtle bg-surface-secondary hover:bg-surface-hover'
      }`}
    >
      {/* Header row */}
      <div className="flex w-full items-center justify-between">
        <button
          type="button"
          onClick={onSelect}
          className="flex-1 text-left text-sm font-medium text-content-primary truncate"
        >
          {shapeLabel}
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="p-1 text-content-tertiary hover:text-error transition-colors"
          aria-label={t('common.delete')}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      </div>

      {/* Expanded controls */}
      {isSelected && (
        <div className="mt-2 flex flex-col gap-2 border-t border-stroke-subtle pt-2">
          {/* Position controls */}
          <div className="flex items-end gap-2">
            <div className="flex-1 min-w-0">
              <span className="mb-1 block text-xs text-content-tertiary">
                {t('binDesigner.insertX')}
              </span>
              <StepperControl
                value={Math.round(insert.x * 10) / 10}
                onChange={(x) => onPositionChange(x, insert.y)}
                onStep={(delta) => onPositionChange(insert.x + delta, insert.y)}
                min={0}
                max={Math.max(0, interiorWidth - insert.width)}
                step={1}
                variant="desktop"
                ariaLabel="X position"
              />
            </div>
            <div className="flex-1 min-w-0">
              <span className="mb-1 block text-xs text-content-tertiary">
                {t('binDesigner.insertY')}
              </span>
              <StepperControl
                value={Math.round(insert.y * 10) / 10}
                onChange={(y) => onPositionChange(insert.x, y)}
                onStep={(delta) => onPositionChange(insert.x, insert.y + delta)}
                min={0}
                max={Math.max(0, interiorDepth - insert.depth)}
                step={1}
                variant="desktop"
                ariaLabel="Y position"
              />
            </div>
          </div>

          {/* Size controls */}
          <div className="flex items-end gap-2">
            <div className="flex-1 min-w-0">
              <span className="mb-1 block text-xs text-content-tertiary">
                {t('binDesigner.insertWidth')}
              </span>
              <StepperControl
                value={Math.round(insert.width * 10) / 10}
                onChange={(w) => onSizeChange(w, insert.depth)}
                onStep={(delta) => onSizeChange(insert.width + delta, insert.depth)}
                min={2}
                max={interiorWidth}
                step={1}
                variant="desktop"
                ariaLabel="Width"
              />
            </div>
            <div className="flex-1 min-w-0">
              <span className="mb-1 block text-xs text-content-tertiary">
                {t('binDesigner.insertDepth')}
              </span>
              <StepperControl
                value={Math.round(insert.depth * 10) / 10}
                onChange={(d) => onSizeChange(insert.width, d)}
                onStep={(delta) => onSizeChange(insert.width, insert.depth + delta)}
                min={2}
                max={interiorDepth}
                step={1}
                variant="desktop"
                ariaLabel="Depth"
              />
            </div>
          </div>

          {/* Cut depth */}
          <div>
            <span className="mb-1 block text-xs text-content-tertiary">
              {t('binDesigner.cutDepth')}
            </span>
            <StepperControl
              value={insert.cutDepth}
              onChange={onCutDepthChange}
              onStep={(delta) => onCutDepthChange(insert.cutDepth + delta * 0.5)}
              min={0.5}
              max={20}
              step={0.5}
              variant="desktop"
              ariaLabel="Cut depth"
            />
          </div>

          {/* Rotation */}
          <div>
            <span className="mb-1 block text-xs text-content-tertiary">
              {t('binDesigner.rotation')}
            </span>
            <div className="flex gap-1">
              {ROTATION_OPTIONS.map((rotation) => (
                <button
                  key={rotation}
                  type="button"
                  onClick={() => onRotationChange(rotation)}
                  className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                    insert.rotation === rotation
                      ? 'bg-accent text-white'
                      : 'border border-stroke-subtle bg-surface-elevated text-content-secondary hover:bg-surface-hover'
                  }`}
                >
                  {t('binDesigner.rotationDegrees', { degrees: rotation })}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
