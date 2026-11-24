import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Input } from '@/design-system';
import { PencilIcon } from '@/design-system/Icon';
import { clamp as clampRange } from '@/shared/utils/math';
import { formatLength, fromMm, toMm } from '@/shared/utils/lengthUnit';
import type { LengthUnit } from '@/shared/utils/lengthUnit';

interface EditableDimensionsProps {
  /** Total width in mm (grid + padding) when hasPadding, or grid-only mm otherwise. */
  readonly widthMm: number;
  /** Total depth in mm (grid + padding) when hasPadding, or grid-only mm otherwise. */
  readonly depthMm: number;
  /** Optional third (height) value in mm; rendering it adds a third input. */
  readonly heightMm?: number;
  /** Minimum allowed mm value (derived from GRID_MIN * gridUnitMm). */
  readonly minMm: number;
  /** Maximum allowed mm value (derived from GRID_MAX * gridUnitMm + max padding headroom). */
  readonly maxMm: number;
  /** Height bounds; default to minMm/maxMm when omitted. */
  readonly minHeightMm?: number;
  readonly maxHeightMm?: number;
  /** Called when the user commits new mm values. heightMm rides along only when the height field is shown. */
  readonly onCommit: (widthMm: number, depthMm: number, heightMm?: number) => void;
  /** Extra CSS classes for the outer wrapper. */
  readonly className?: string;
  /** Visual weight. 'primary' (default) matches the section headline; 'secondary' is a smaller/lighter companion to another primary value. */
  readonly variant?: 'primary' | 'secondary';
  /** Accessible label for the editable region. */
  readonly 'aria-label': string;
  /** Accessible label for the width input. */
  readonly widthLabel: string;
  /** Accessible label for the depth input. */
  readonly depthLabel: string;
  /** Accessible label for the height input; required when heightMm is set. */
  readonly heightLabel?: string;
  /** Mount already in edit mode, seeded with the current values. */
  readonly initialEditing?: boolean;
  /** Called when edit mode opens or closes (commit or cancel). */
  readonly onEditingChange?: (editing: boolean) => void;
  /** Unit the values show and are typed in; props and onCommit stay in mm. */
  readonly unit?: LengthUnit;
  /** Symbol shown after the values, in the reader's language. */
  readonly unitSymbol?: string;
}

/**
 * Click-to-edit inline display for measured dimensions.
 *
 * At rest: shows "{width} × {depth} {unit}" as styled text.
 * On click: swaps to number inputs in that unit.
 * Commits on Enter or blur; cancels on Escape.
 */
export function EditableDimensions({
  widthMm,
  depthMm,
  heightMm,
  minMm,
  maxMm,
  minHeightMm,
  maxHeightMm,
  onCommit,
  className,
  variant = 'primary',
  'aria-label': ariaLabel,
  widthLabel,
  depthLabel,
  heightLabel,
  initialEditing = false,
  onEditingChange,
  unit = 'mm',
  unitSymbol = unit,
}: EditableDimensionsProps) {
  const show = useCallback((mm: number) => formatLength(mm, unit), [unit]);
  const restClass =
    variant === 'secondary'
      ? 'text-xs font-normal tabular-nums text-content-secondary'
      : 'text-sm font-semibold tabular-nums text-content';
  const separatorClass =
    variant === 'secondary' ? 'text-xs text-content-tertiary' : 'text-sm text-content-secondary';
  const suffixClass =
    variant === 'secondary'
      ? 'text-xs text-content-secondary'
      : 'text-sm font-semibold text-content';
  // The accent border and ring are kept on the wrapper rather than left to
  // `focus-within`: these only render while editing, and all of them carried
  // the accent at once even though just one holds focus.
  const inputWrapperClass = 'w-14 border-accent ring-1 ring-accent';
  const inputTextClass =
    variant === 'secondary'
      ? 'text-center text-xs tabular-nums'
      : 'text-center text-sm font-semibold tabular-nums';
  const hasHeight = heightMm !== undefined;
  const [editing, setEditing] = useState(initialEditing);
  const [localWidth, setLocalWidth] = useState(() => (initialEditing ? show(widthMm) : ''));
  const [localDepth, setLocalDepth] = useState(() => (initialEditing ? show(depthMm) : ''));
  const [localHeight, setLocalHeight] = useState(() =>
    initialEditing && heightMm !== undefined ? show(heightMm) : ''
  );
  const widthRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // When entering edit mode, seed inputs with current rounded values
  const enterEditMode = useCallback(() => {
    setLocalWidth(show(widthMm));
    setLocalDepth(show(depthMm));
    setLocalHeight(heightMm !== undefined ? show(heightMm) : '');
    setEditing(true);
    onEditingChange?.(true);
  }, [widthMm, depthMm, heightMm, onEditingChange, show]);

  const stopEditing = useCallback(() => {
    setEditing(false);
    onEditingChange?.(false);
  }, [onEditingChange]);

  // Focus width input when edit mode activates
  useEffect(() => {
    if (editing) {
      widthRef.current?.select();
    }
  }, [editing]);

  const clamp = useCallback((v: number) => clampRange(v, minMm, maxMm), [minMm, maxMm]);
  const clampHeight = useCallback(
    (v: number) => clampRange(v, minHeightMm ?? minMm, maxHeightMm ?? maxMm),
    [minHeightMm, maxHeightMm, minMm, maxMm]
  );

  const commit = useCallback(() => {
    // A field left as seeded keeps its exact mm. The seed is rounded to the
    // field's precision, so converting it back would move a value the user
    // never touched.
    const read = (typed: string, current: number): number => {
      const mm = toMm(parseFloat(typed), unit);
      return show(mm) === show(current) ? current : mm;
    };
    const w = read(localWidth, widthMm);
    const d = read(localDepth, depthMm);
    if (Number.isNaN(w) || Number.isNaN(d)) {
      stopEditing();
      return;
    }
    const h = heightMm !== undefined ? read(localHeight, heightMm) : undefined;
    // Opening the field and clicking away is not an edit. Committing it anyway
    // ran the caller's snap-to-grid on values the user never typed, which on a
    // baseplate synced to a shaped drawer dropped the sync and the shape.
    // Compared as displayed rather than as typed, so a re-entry of the same
    // measurement ("441.00" over "441") reads as the no-op it is; `show` is
    // the precision the field shows, so anything it rounds away was never on
    // screen to change.
    const same = (typed: number, current: number): boolean => show(typed) === show(current);
    if (
      same(w, widthMm) &&
      same(d, depthMm) &&
      (heightMm === undefined || h === undefined || Number.isNaN(h) || same(h, heightMm))
    ) {
      stopEditing();
      return;
    }
    if (hasHeight) {
      if (h !== undefined && !Number.isNaN(h)) {
        onCommit(clamp(w), clamp(d), clampHeight(h));
      }
    } else {
      onCommit(clamp(w), clamp(d));
    }
    stopEditing();
  }, [
    localWidth,
    localDepth,
    localHeight,
    hasHeight,
    unit,
    show,
    widthMm,
    depthMm,
    heightMm,
    clamp,
    clampHeight,
    onCommit,
    stopEditing,
  ]);

  const cancel = useCallback(() => {
    stopEditing();
  }, [stopEditing]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancel();
      }
    },
    [commit, cancel]
  );

  // Commit when focus leaves the container entirely
  const handleBlur = useCallback(
    (e: React.FocusEvent) => {
      // relatedTarget is the element receiving focus — if it's still inside our
      // container, the user is tabbing between width/depth inputs, so don't commit yet.
      if (containerRef.current?.contains(e.relatedTarget)) {
        return;
      }
      commit();
    },
    [commit]
  );

  if (editing) {
    return (
      <div
        ref={containerRef}
        className={`inline-flex items-baseline gap-1 ${className ?? ''}`}
        onBlur={handleBlur}
        role="group"
        aria-label={ariaLabel}
      >
        <Input
          ref={widthRef}
          type="number"
          inputMode="decimal"
          step={0.1}
          value={localWidth}
          onChange={(e) => setLocalWidth(e.target.value)}
          onKeyDown={handleKeyDown}
          min={fromMm(minMm, unit)}
          max={fromMm(maxMm, unit)}
          size="sm"
          wrapperClassName={inputWrapperClass}
          className={inputTextClass}
          aria-label={widthLabel}
        />
        <span className={separatorClass}>&times;</span>
        <Input
          type="number"
          inputMode="decimal"
          step={0.1}
          value={localDepth}
          onChange={(e) => setLocalDepth(e.target.value)}
          onKeyDown={handleKeyDown}
          min={fromMm(minMm, unit)}
          max={fromMm(maxMm, unit)}
          size="sm"
          wrapperClassName={inputWrapperClass}
          className={inputTextClass}
          aria-label={depthLabel}
        />
        {hasHeight && (
          <>
            <span className={separatorClass}>&times;</span>
            <Input
              type="number"
              inputMode="decimal"
              step={0.1}
              value={localHeight}
              onChange={(e) => setLocalHeight(e.target.value)}
              onKeyDown={handleKeyDown}
              min={fromMm(minHeightMm ?? minMm, unit)}
              max={fromMm(maxHeightMm ?? maxMm, unit)}
              size="sm"
              wrapperClassName={inputWrapperClass}
              className={inputTextClass}
              aria-label={heightLabel}
            />
          </>
        )}
        <span className={suffixClass}>{unitSymbol}</span>
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      type="button"
      onClick={enterEditMode}
      className={`group inline-flex cursor-pointer items-center gap-1 !px-0 !py-0 underline decoration-dotted decoration-content-tertiary underline-offset-4 hover:bg-transparent hover:text-content-secondary hover:decoration-content-secondary focus-visible:decoration-accent ${restClass} ${className ?? ''}`}
      aria-label={ariaLabel}
    >
      <span>
        {show(widthMm)} &times; {show(depthMm)}
        {heightMm !== undefined ? <> &times; {show(heightMm)}</> : null} {unitSymbol}
      </span>
      <PencilIcon
        size="xs"
        className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
      />
    </Button>
  );
}
