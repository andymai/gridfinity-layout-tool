/**
 * Figma-style floating inspector panel for cutout properties.
 *
 * Appears near the selection bounding box when 1+ cutouts are selected.
 * Single selection: compact inputs for X/Y/W/H, sliders for R/CR/Depth.
 * Multi selection: shared rotation and depth sliders.
 * Auto-repositions to stay within viewport bounds.
 */

import { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import type { Cutout, CutoutTextSide } from '@/features/bin-designer/types';
import { TEXT_MAX_LENGTH } from '@/features/bin-designer/types';
import { useTranslation } from '@/i18n';
import { SliderInput } from '@/features/bin-designer/components/controls/SliderInput';
import { CompactNumberInput } from '@/shared/components/CompactNumberInput';
import { getSegmentClass, SEGMENT_GROUP_CLASS } from '@/shared/components/segmentedControlClasses';
import { clampRotationToBounds, getRotatedBounds } from '../panel/CutoutsSection/geometry';
import { CutoutScoopControls } from './CutoutScoopControls';
import { Checkbox, Input } from '@/design-system';

const SIDE_OPTIONS: readonly { readonly side: CutoutTextSide; readonly glyph: string }[] = [
  { side: 'top', glyph: '↑' },
  { side: 'bottom', glyph: '↓' },
  { side: 'left', glyph: '←' },
  { side: 'right', glyph: '→' },
] as const;

interface FloatingInspectorProps {
  readonly cutouts: readonly Cutout[];
  readonly selection: ReadonlySet<string>;
  readonly preview: ReadonlyMap<string, Partial<Cutout>>;
  readonly binWidth: number;
  readonly binDepth: number;
  readonly maxCutDepth: number;
  readonly onUpdate: (id: string, updates: Partial<Cutout>) => void;
  readonly onUpdateBatch?: (updates: ReadonlyMap<string, Partial<Cutout>>) => void;
  /** Camera zoom (pixels per mm) — used to position the panel */
  readonly zoom: number;
  /** Camera center in mm world coords */
  readonly cameraCenter: { readonly x: number; readonly y: number };
  /** Canvas size in CSS pixels */
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  /** Whether to hide (during drag/resize/rotate) */
  readonly hidden?: boolean;
  readonly disabled?: boolean;
}

/** Merge preview overrides into a cutout to get the effective state */
function previewOverrides(cutout: Cutout, preview: ReadonlyMap<string, Partial<Cutout>>): Cutout {
  const override = preview.get(cutout.id);
  return override ? { ...cutout, ...override } : cutout;
}

/** Get effective value of a cutout field, merging preview overrides */
function getEffective<K extends keyof Cutout>(
  cutout: Cutout,
  preview: ReadonlyMap<string, Partial<Cutout>>,
  key: K
): Cutout[K] {
  const override = preview.get(cutout.id);
  if (override && key in override) {
    return override[key] as Cutout[K];
  }
  return cutout[key];
}

/** Compute shared value across multiple cutouts for a given field. Returns null if mixed. */
function getSharedValue(
  cutouts: readonly Cutout[],
  preview: ReadonlyMap<string, Partial<Cutout>>,
  key: keyof Cutout
): number | null {
  if (cutouts.length === 0) return null;
  const first = getEffective(cutouts[0], preview, key) as number;
  for (let i = 1; i < cutouts.length; i++) {
    if ((getEffective(cutouts[i], preview, key) as number) !== first) return null;
  }
  return first;
}

export function FloatingInspector({
  cutouts,
  selection,
  preview,
  binWidth,
  binDepth,
  maxCutDepth,
  onUpdate,
  onUpdateBatch,
  zoom,
  cameraCenter,
  canvasWidth,
  canvasHeight,
  hidden = false,
  disabled = false,
}: FloatingInspectorProps) {
  const t = useTranslation();

  const selectedCutouts = useMemo(
    () => cutouts.filter((c) => selection.has(c.id)),
    [cutouts, selection]
  );

  // Compute rotation-aware bounding box of selection in world coords (mm)
  const selectionBounds = useMemo(() => {
    if (selectedCutouts.length === 0) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const c of selectedCutouts) {
      const effective = previewOverrides(c, preview);
      const rb = getRotatedBounds(effective);
      minX = Math.min(minX, rb.minX);
      minY = Math.min(minY, rb.minY);
      maxX = Math.max(maxX, rb.maxX);
      maxY = Math.max(maxY, rb.maxY);
    }
    return { minX, minY, maxX, maxY };
  }, [selectedCutouts, preview]);

  // --- Position lock: prevent panel jitter during input interaction ---
  // When the user interacts with any control inside the panel (e.g. dragging
  // the rotation slider), the cutout bounds change on every frame which causes
  // the panel's computed position to jitter. We "lock" the position at the
  // moment interaction starts, then release it on pointer-up / focus-out so
  // the panel snaps to its new optimal placement.
  const panelRef = useRef<HTMLDivElement>(null);
  const pointerIsDownRef = useRef(false);
  const hasFocusRef = useRef(false);
  const [lockedPos, setLockedPos] = useState<{ x: number; y: number } | null>(null);

  const tryUnlock = useCallback(() => {
    if (!pointerIsDownRef.current && !hasFocusRef.current) {
      setLockedPos(null);
    }
  }, []);

  useEffect(() => {
    const handlePointerEnd = () => {
      pointerIsDownRef.current = false;
      tryUnlock();
    };
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);
    window.addEventListener('blur', handlePointerEnd);
    return () => {
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
      window.removeEventListener('blur', handlePointerEnd);
    };
  }, [tryUnlock]);

  // Reset position lock when the panel is hidden or the selection changes.
  // When hidden, the panel DOM is removed so onBlurCapture never fires,
  // leaving hasFocusRef stuck true and lockedPos stale. The setState call
  // here is safe: it only triggers when hidden/selectionKey change (infrequent
  // prop updates), and is a no-op when the lock was never engaged.
  const selectionKey = [...selection].sort().join(',');

  useEffect(() => {
    pointerIsDownRef.current = false;
    hasFocusRef.current = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing stale lock; DOM removal prevents blur events from firing
    setLockedPos(null);
  }, [hidden, selectionKey]);

  if (selection.size === 0 || hidden || !selectionBounds) return null;

  // Convert world bounds to screen coords
  const PANEL_WIDTH = 220;
  const PANEL_HEIGHT_EST = 200; // conservative panel height estimate
  const PANEL_GAP = 16;
  const EDGE_MARGIN = 10;

  const worldToScreenX = (wx: number) => (wx - cameraCenter.x) * zoom + canvasWidth / 2;
  const worldToScreenY = (wy: number) => -(wy - cameraCenter.y) * zoom + canvasHeight / 2;

  const screenRight = worldToScreenX(selectionBounds.maxX);
  const screenLeft = worldToScreenX(selectionBounds.minX);
  // Note: higher world Y → smaller screen Y (Y is inverted)
  const screenTopEdge = Math.min(
    worldToScreenY(selectionBounds.maxY),
    worldToScreenY(selectionBounds.minY)
  );
  const screenBottomEdge = Math.max(
    worldToScreenY(selectionBounds.maxY),
    worldToScreenY(selectionBounds.minY)
  );

  // Try placements in priority order: right → left → below → above
  // Each placement must fit within canvas without overlapping the selection handles
  let panelX: number;
  let panelY: number;

  const canFitRight = screenRight + PANEL_GAP + PANEL_WIDTH <= canvasWidth - EDGE_MARGIN;
  const canFitLeft = screenLeft - PANEL_GAP - PANEL_WIDTH >= EDGE_MARGIN;
  const canFitBelow = screenBottomEdge + PANEL_GAP + PANEL_HEIGHT_EST <= canvasHeight - EDGE_MARGIN;

  if (canFitRight) {
    panelX = screenRight + PANEL_GAP;
    panelY = screenTopEdge;
  } else if (canFitLeft) {
    panelX = screenLeft - PANEL_WIDTH - PANEL_GAP;
    panelY = screenTopEdge;
  } else if (canFitBelow) {
    // Place below the selection, left-aligned with it
    panelX = Math.max(EDGE_MARGIN, Math.min(screenLeft, canvasWidth - PANEL_WIDTH - EDGE_MARGIN));
    panelY = screenBottomEdge + PANEL_GAP;
  } else {
    // Place above the selection
    panelX = Math.max(EDGE_MARGIN, Math.min(screenLeft, canvasWidth - PANEL_WIDTH - EDGE_MARGIN));
    panelY = screenTopEdge - PANEL_HEIGHT_EST - PANEL_GAP;
  }

  // Clamp Y within canvas bounds
  panelY = Math.max(EDGE_MARGIN, Math.min(panelY, canvasHeight - PANEL_HEIGHT_EST - EDGE_MARGIN));

  // Apply position lock: use locked position during interaction, computed otherwise
  const finalX = lockedPos?.x ?? panelX;
  const finalY = lockedPos?.y ?? panelY;

  const isSingle = selectedCutouts.length === 1;
  const singleCutout = isSingle ? selectedCutouts[0] : null;

  // For multi-select, compute shared values
  const sharedCutDepth = getSharedValue(selectedCutouts, preview, 'cutDepth');
  const sharedRotation = getSharedValue(selectedCutouts, preview, 'rotation');
  const sharedScoopRadiusW = getSharedValue(selectedCutouts, preview, 'scoopRadiusW');
  const sharedScoopRadiusD = getSharedValue(selectedCutouts, preview, 'scoopRadiusD');

  const handleBatchUpdate = (key: keyof Cutout, value: number) => {
    if (onUpdateBatch && selectedCutouts.length > 1) {
      const updates = new Map<string, Partial<Cutout>>();
      for (const c of selectedCutouts) {
        updates.set(c.id, { [key]: value });
      }
      onUpdateBatch(updates);
    }
  };

  // Multi-select scoop axis update. Non-rectangle cutouts have no W/D
  // distinction — the generator collapses W and D to a single value via
  // max() — so writing only one axis would silently no-op if the other axis
  // is larger. Write both axes for circles/paths to keep the slider
  // semantically meaningful for those shapes.
  const handleScoopAxisBatch = (axis: 'scoopRadiusW' | 'scoopRadiusD', value: number) => {
    if (onUpdateBatch && selectedCutouts.length > 1) {
      const updates = new Map<string, Partial<Cutout>>();
      for (const c of selectedCutouts) {
        updates.set(
          c.id,
          c.shape === 'rectangle' ? { [axis]: value } : { scoopRadiusW: value, scoopRadiusD: value }
        );
      }
      onUpdateBatch(updates);
    }
  };

  return (
    <div
      ref={panelRef}
      className="absolute z-50 w-[220px] rounded-lg border border-stroke-subtle bg-surface-elevated shadow-lg p-2 space-y-1.5 transition-opacity duration-150"
      style={{
        left: finalX,
        top: finalY,
        pointerEvents: 'auto',
      }}
      onPointerDown={() => {
        pointerIsDownRef.current = true;
        setLockedPos((prev) => prev ?? { x: panelX, y: panelY });
      }}
      onFocusCapture={() => {
        hasFocusRef.current = true;
        setLockedPos((prev) => prev ?? { x: panelX, y: panelY });
      }}
      onBlurCapture={(e) => {
        const related = e.relatedTarget instanceof Node ? e.relatedTarget : null;
        if (!panelRef.current?.contains(related)) {
          hasFocusRef.current = false;
          tryUnlock();
        }
      }}
    >
      {/* Single selection: compact inputs for position/size, sliders for rotation/depth */}
      {singleCutout && (
        <div className="space-y-1.5">
          {/* Position & size: 2-column compact grid */}
          <div className="grid grid-cols-2 gap-1">
            <CompactNumberInput
              label="X"
              value={getEffective(singleCutout, preview, 'x')}
              onChange={(x) => onUpdate(singleCutout.id, { x })}
              min={0}
              max={binWidth - singleCutout.width}
              step={0.5}
              unit="mm"
              disabled={disabled}
            />
            <CompactNumberInput
              label="Y"
              value={getEffective(singleCutout, preview, 'y')}
              onChange={(y) => onUpdate(singleCutout.id, { y })}
              min={0}
              max={binDepth - singleCutout.depth}
              step={0.5}
              unit="mm"
              disabled={disabled}
            />
            <CompactNumberInput
              label="W"
              value={getEffective(singleCutout, preview, 'width')}
              onChange={(width) => onUpdate(singleCutout.id, { width })}
              min={2}
              max={binWidth}
              step={0.5}
              unit="mm"
              disabled={disabled}
            />
            <CompactNumberInput
              label="H"
              value={getEffective(singleCutout, preview, 'depth')}
              onChange={(depth) => onUpdate(singleCutout.id, { depth })}
              min={2}
              max={binDepth}
              step={0.5}
              unit="mm"
              disabled={disabled}
            />
          </div>
          {/* Rotation, corner radius, depth: full-width sliders */}
          <SliderInput
            label="Rotation"
            value={getEffective(singleCutout, preview, 'rotation')}
            onChange={(rotation) => {
              const clamped = clampRotationToBounds(singleCutout, rotation, binWidth, binDepth);
              onUpdate(singleCutout.id, { rotation: clamped });
            }}
            min={0}
            max={359}
            step={1}
            unit="°"
            disabled={disabled}
          />
          {singleCutout.shape === 'rectangle' && (
            <SliderInput
              label={t('binDesigner.cutouts.cornerRadius')}
              value={singleCutout.cornerRadius}
              onChange={(cornerRadius) => onUpdate(singleCutout.id, { cornerRadius })}
              min={0}
              max={Math.min(singleCutout.width, singleCutout.depth) / 2}
              step={0.5}
              unit="mm"
              disabled={disabled}
            />
          )}
          <SliderInput
            label="Depth"
            value={singleCutout.cutDepth}
            onChange={(cutDepth) => onUpdate(singleCutout.id, { cutDepth })}
            min={0.5}
            max={maxCutDepth}
            step={0.5}
            unit="mm"
            disabled={disabled}
          />
          <CutoutScoopControls
            key={singleCutout.id}
            cutout={singleCutout}
            preview={preview.get(singleCutout.id)}
            disabled={disabled}
            onUpdate={(patch) => onUpdate(singleCutout.id, patch)}
          />
          <CutoutEngraveLabelControls
            key={`${singleCutout.id}-text`}
            cutout={singleCutout}
            disabled={disabled ?? false}
            onUpdate={(patch) => onUpdate(singleCutout.id, patch)}
          />
        </div>
      )}

      {/* Multi selection: shared fields */}
      {!isSingle && selectedCutouts.length > 1 && (
        <>
          <div className="text-[10px] font-medium text-content-secondary">
            {selectedCutouts.length} {t('binDesigner.cutoutEditor.actions').toLowerCase()}
          </div>
          <div className="space-y-0.5">
            <SliderInput
              label="Rotation"
              value={sharedRotation ?? 0}
              onChange={(rotation) => handleBatchUpdate('rotation', rotation)}
              min={0}
              max={359}
              step={1}
              unit="°"
              disabled={disabled}
            />
            <SliderInput
              label="Depth"
              value={sharedCutDepth ?? 5}
              onChange={(cutDepth) => handleBatchUpdate('cutDepth', cutDepth)}
              min={0.5}
              max={maxCutDepth}
              step={0.5}
              unit="mm"
              disabled={disabled}
            />
            <SliderInput
              label={t('binDesigner.cutouts.scoopW')}
              value={sharedScoopRadiusW ?? 0}
              onChange={(scoopRadiusW) => handleScoopAxisBatch('scoopRadiusW', scoopRadiusW)}
              min={0}
              max={sharedCutDepth ?? maxCutDepth}
              step={0.5}
              unit="mm"
              disabled={disabled}
            />
            <SliderInput
              label={t('binDesigner.cutouts.scoopD')}
              value={sharedScoopRadiusD ?? 0}
              onChange={(scoopRadiusD) => handleScoopAxisBatch('scoopRadiusD', scoopRadiusD)}
              min={0}
              max={sharedCutDepth ?? maxCutDepth}
              step={0.5}
              unit="mm"
              disabled={disabled}
            />
          </div>
        </>
      )}

      {/* Lock status indicator */}
      {singleCutout?.locked && (
        <div className="flex gap-1.5 text-[10px] text-content-tertiary">
          <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-400">
            {t('binDesigner.cutoutEditor.locked')}
          </span>
        </div>
      )}
    </div>
  );
}

interface CutoutEngraveLabelControlsProps {
  readonly cutout: Cutout;
  readonly disabled: boolean;
  readonly onUpdate: (patch: Partial<Cutout>) => void;
}

/**
 * Compact engraved-label controls for a single selected cutout — toggle,
 * text input, and side picker. Mode + font + depth use the design-level
 * `textDefaults`; per-instance overrides are deferred to a follow-up.
 *
 * Layout mirrors the rest of the inspector (compact rows, small icon-only
 * segmented control for the side direction) so it slots into the existing
 * visual rhythm without a heavyweight new section.
 */
function CutoutEngraveLabelControls({
  cutout,
  disabled,
  onUpdate,
}: CutoutEngraveLabelControlsProps) {
  const t = useTranslation();
  const enabled = cutout.engraveLabel ?? false;
  const side: CutoutTextSide = cutout.textSide ?? 'top';

  return (
    <div className="flex flex-col gap-1.5 border-t border-stroke-subtle pt-2">
      <label className="flex items-center gap-2 text-xs text-content-secondary cursor-pointer">
        <Checkbox
          checked={enabled}
          onChange={(checked) => onUpdate({ engraveLabel: checked })}
          disabled={disabled}
          aria-label={t('binDesigner.cutoutEngraveLabel')}
        />
        <span>{t('binDesigner.cutoutEngraveLabel')}</span>
      </label>
      {enabled && (
        <>
          <Input
            type="text"
            size="sm"
            value={cutout.label}
            maxLength={TEXT_MAX_LENGTH}
            onChange={(e) => onUpdate({ label: e.target.value })}
            disabled={disabled}
            placeholder={t('binDesigner.cutoutEngraveLabelPlaceholder')}
            aria-label={t('binDesigner.cutoutEngraveLabel')}
          />
          <div>
            <span className="mb-1 block text-[10px] uppercase tracking-wide text-content-tertiary">
              {t('binDesigner.cutoutTextSide')}
            </span>
            <div
              role="group"
              aria-label={t('binDesigner.cutoutTextSide')}
              className={SEGMENT_GROUP_CLASS}
            >
              {SIDE_OPTIONS.map(({ side: opt, glyph }) => (
                <button
                  key={opt}
                  type="button"
                  disabled={disabled}
                  onClick={() => onUpdate({ textSide: opt })}
                  aria-pressed={side === opt}
                  aria-label={t(`binDesigner.cutoutTextSide.${opt}`)}
                  title={t(`binDesigner.cutoutTextSide.${opt}`)}
                  className={`flex-1 leading-none ${getSegmentClass(side === opt)}`}
                >
                  {glyph}
                </button>
              ))}
            </div>
          </div>
          <p className="text-[10px] text-content-tertiary">
            {t('binDesigner.cutoutEngraveLabelEngraveOnly')}
          </p>
        </>
      )}
    </div>
  );
}
