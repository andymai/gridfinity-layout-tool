/**
 * Inserts section for the bin designer parameter panel.
 *
 * Shows placed inserts (with edit/remove controls) and a template browser
 * for adding new inserts from predefined templates.
 */

import { useCallback } from 'react';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { useShallow } from 'zustand/react/shallow';
import { useToastStore } from '@/core/store/toast';
import { InsertFloorPlan } from './InsertFloorPlan';
import { TemplateBrowser } from './TemplateBrowser';
import type { Insert } from '@/features/bin-designer/types';

/** Shape display names and icons */
const SHAPE_LABELS: Record<Insert['shape'], string> = {
  rectangle: 'Rect',
  circle: 'Circle',
  hexagon: 'Hex',
  'rounded-rect': 'Rounded',
  slot: 'Slot',
};

/**
 * Render the Inserts panel containing placed inserts, a 2D floor plan, and a template browser.
 *
 * Reads placed inserts and the remove/clear actions from the designer store and exposes:
 * - A placed inserts list showing count, per-item remove controls, and a "Clear all" action (rendered only when inserts exist).
 * - An InsertFloorPlan for 2D positioning of inserts.
 * - A TemplateBrowser for adding new inserts from templates.
 *
 * @returns The UI for managing inserts, including the placed inserts list (with per-item remove and "Clear all"), the 2D floor plan, and the template browser.
 */
export function InsertsSection() {
  const { inserts, removeInsert, clearInserts } = useDesignerStore(
    useShallow((s) => ({
      inserts: s.params.inserts,
      removeInsert: s.removeInsert,
      clearInserts: s.clearInserts,
    }))
  );
  const addToast = useToastStore((s) => s.addToast);

  const handleClearAll = useCallback(() => {
    if (!window.confirm(`Remove all ${inserts.length} inserts? This cannot be undone.`)) return;
    clearInserts();
    addToast({ message: 'All inserts removed', type: 'success', duration: 2000 });
  }, [inserts.length, clearInserts, addToast]);

  return (
    <div className="space-y-3">
      {/* Placed inserts list */}
      {inserts.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-content-secondary">
              Placed ({inserts.length})
            </span>
            <button
              onClick={handleClearAll}
              className="text-xs text-content-tertiary hover:text-red-400"
              aria-label="Remove all inserts"
            >
              Clear all
            </button>
          </div>
          <ul className="space-y-1" role="list" aria-label="Placed inserts">
            {inserts.map((insert) => (
              <InsertListItem
                key={insert.id}
                insert={insert}
                onRemove={() => removeInsert(insert.id)}
              />
            ))}
          </ul>
        </div>
      )}

      {/* 2D floor plan for positioning */}
      <InsertFloorPlan />

      {/* Template browser */}
      <TemplateBrowser />
    </div>
  );
}

/**
 * Renders a single insert as a list item showing its shape icon, display label, dimensions, and a remove button.
 *
 * The displayed label is `insert.label` if present; otherwise it combines the shape label and dimensions.
 *
 * @param insert - The insert to display (shape, dimensions, and optional label).
 * @param onRemove - Callback invoked when the item's remove button is clicked.
 * @returns A list item element representing the insert with an interactive remove control.
 */
function InsertListItem({
  insert,
  onRemove,
}: {
  insert: Insert;
  onRemove: () => void;
}) {
  const label = insert.label || `${SHAPE_LABELS[insert.shape]} ${insert.width}×${insert.depth}`;

  return (
    <li className="flex items-center justify-between rounded-md bg-surface-tertiary px-2.5 py-1.5">
      <div className="flex items-center gap-2 min-w-0">
        <ShapeIcon shape={insert.shape} />
        <span className="truncate text-xs text-content" title={label}>
          {label}
        </span>
        <span className="shrink-0 text-[10px] text-content-tertiary">
          {insert.width}×{insert.depth}mm
        </span>
      </div>
      <button
        onClick={onRemove}
        className="ml-2 shrink-0 rounded p-0.5 text-content-tertiary hover:bg-surface-hover hover:text-red-400"
        aria-label={`Remove ${label}`}
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </li>
  );
}

/**
 * Render a small inline SVG icon that visually represents the provided insert shape.
 *
 * @param shape - The insert shape to render; expected values include `"rectangle"`, `"circle"`, `"hexagon"`, `"rounded-rect"`, and `"slot"`.
 * @returns An inline SVG element styled to match surrounding text (uses `currentColor` and a shared sizing class).
 */
function ShapeIcon({ shape }: { shape: Insert['shape'] }) {
  const className = "h-3.5 w-3.5 text-content-secondary";

  switch (shape) {
    case 'circle':
      return (
        <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true">
          <circle cx="8" cy="8" r="6" strokeWidth="1.5" />
        </svg>
      );
    case 'hexagon':
      return (
        <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true">
          <path d="M8 2L13.2 5v6L8 14 2.8 11V5z" strokeWidth="1.5" />
        </svg>
      );
    case 'rounded-rect':
      return (
        <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true">
          <rect x="3" y="4" width="10" height="8" rx="2.5" strokeWidth="1.5" />
        </svg>
      );
    case 'slot':
      return (
        <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true">
          <rect x="5" y="3" width="6" height="10" rx="3" strokeWidth="1.5" />
        </svg>
      );
    default: // rectangle
      return (
        <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true">
          <rect x="3" y="4" width="10" height="8" strokeWidth="1.5" />
        </svg>
      );
  }
}