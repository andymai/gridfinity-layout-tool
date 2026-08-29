/**
 * The label captions, as the Label Tabs section's leading content.
 *
 * Every row is a tab that will physically exist, so the list is a manifest
 * rather than a form: an empty row means a shelf prints blank, and a row whose
 * caption overflows prints blank too (`buildTextSolid` drops a run that can't
 * reach `minFontSize`, and nothing in the resulting mesh records that it did).
 * Both are surfaced here, at the moment the text is typed, rather than left for
 * the user to discover on the printer.
 *
 * Filled rows are DIMMED rather than filtered out. The row number is only
 * meaningful because it matches the compartment grid, and hiding rows punches
 * holes in that sequence exactly on the large grids where the mapping matters
 * most.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Button, InfoIcon, Select, XIcon } from '@/design-system';
import type { SelectOption } from '@/design-system';
import { labelPlateWidthMm } from '@/shared/constants/labelPlates';
import type { LabelPlateIconId, LabelPlateWidthU } from '@/shared/constants/labelPlates';
import { useResponsive } from '@/shared/hooks/useResponsive';
import { LabelIconPicker } from '../LabelIconPicker';
import { useTranslation } from '@/i18n';
import { getSegmentClass, SEGMENT_GROUP_CLASS } from '@/shared/components/segmentedControlClasses';
import { CompartmentTextInput } from './CompartmentTextInput';

export interface LabelTextRowModel {
  /** Compartment id, or row index under `label.span`. */
  readonly index: number;
  /** 1-based number shown to the user; matches the on-grid badge. */
  readonly displayNumber: number;
  readonly value: string;
  /** The caption overflows its host and will not render. */
  readonly overflows: boolean;
  /** The swappable plate this compartment hosts. Absent in text mode, and in
   *  the socket plan's bin-spanning fallback where there is no per-compartment
   *  plate to size. */
  readonly plate?: {
    readonly fittingWidthsU: readonly LabelPlateWidthU[];
    readonly autoWidthU: LabelPlateWidthU | null;
    readonly overrideU: number | null;
    readonly icon: LabelPlateIconId | null;
  };
}

interface LabelTextListProps {
  readonly rows: readonly LabelTextRowModel[];
  readonly spanning: boolean;
  readonly onToggleSpan: (spanning: boolean) => void;
  readonly onCommit: (index: number, value: string) => void;
  readonly onClearAll: () => void;
  /** Compartment picked on the 2D grid. Focusing follows it, which is what makes
   *  "pick on grid" a picker INTO this list rather than a second editor. */
  readonly focusIndex?: number | null;
  /** Report this list's own navigation back, so the grid highlight follows. */
  readonly onFocusChange?: (index: number) => void;
  /** Turn on the compartment grid's picking mode. Absent when there is no grid
   *  to pick on (a single compartment, or row-indexed spanning labels). */
  readonly onPickOnGrid?: () => void;
  readonly onPlateWidthChange?: (index: number, widthU: number | null) => void;
  readonly onPlateIconChange?: (index: number, icon: LabelPlateIconId | null) => void;
  /** The name of the one placed bin linked to this design, offered as a starting
   *  caption. Absent unless that mapping is unambiguous. */
  readonly suggestedName?: string;
  readonly onApplySuggestedName?: () => void;
  /** Raising `label.width` is the one auto-fix for an overflow; absent when the
   *  tabs are already full width or the caption sits on a plate. */
  readonly onWiden?: () => void;
}

export function LabelTextList({
  rows,
  spanning,
  onToggleSpan,
  onCommit,
  onClearAll,
  onWiden,
  focusIndex = null,
  onFocusChange,
  onPickOnGrid,
  onPlateWidthChange,
  onPlateIconChange,
  suggestedName,
  onApplySuggestedName,
}: LabelTextListProps) {
  const { isMobile } = useResponsive();
  const t = useTranslation();
  const listId = useId();
  const [focus, setFocus] = useState<{ index: number; token: number } | null>(null);

  // A single compartment has nothing to be numbered against, so the column is
  // pure noise there.
  const showNumbers = rows.length > 1;

  const blankCount = useMemo(() => rows.filter((r) => !r.value.trim()).length, [rows]);
  const overflowCount = useMemo(() => rows.filter((r) => r.overflows).length, [rows]);
  const filledCount = rows.length - blankCount;

  const focusRow = useCallback(
    (index: number) => {
      setFocus((prev) => ({ index, token: (prev?.token ?? 0) + 1 }));
      onFocusChange?.(index);
    },
    [onFocusChange]
  );

  // Follow a pick made on the grid. Keyed on the incoming index alone (not on a
  // token) so this fires once per pick and never fights the list's own focus.
  const pickedRef = useRef<number | null>(focusIndex);
  useEffect(() => {
    if (focusIndex === null || focusIndex === pickedRef.current) return;
    pickedRef.current = focusIndex;
    setFocus((prev) => ({ index: focusIndex, token: (prev?.token ?? 0) + 1 }));
  }, [focusIndex]);

  const navigate = useCallback(
    (from: number, direction: 'next' | 'prev') => {
      const at = rows.findIndex((r) => r.index === from);
      if (at === -1) return;
      // Clamp instead of wrapping: running off the last row back to the first
      // reads as a glitch when ripping down a long list with Enter.
      const next = Math.min(rows.length - 1, Math.max(0, at + (direction === 'next' ? 1 : -1)));
      focusRow(rows[next].index);
    },
    [rows, focusRow]
  );

  const jumpToNextBlank = useCallback(() => {
    const from = focus === null ? -1 : rows.findIndex((r) => r.index === focus.index);
    const blank =
      rows.find((r, i) => i > from && !r.value.trim()) ?? rows.find((r) => !r.value.trim());
    if (blank) focusRow(blank.index);
  }, [rows, focus, focusRow]);

  if (rows.length === 0) return null;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-content-secondary">
          {t('binDesigner.labelText')}
        </span>
        <span className="text-xs tabular-nums text-content-tertiary">
          {t('binDesigner.labelTextFilled', { filled: filledCount, total: rows.length })}
        </span>
      </div>

      <div
        role="group"
        aria-label={t('binDesigner.labelTextLayout')}
        className={`mb-2 ${SEGMENT_GROUP_CLASS}`}
      >
        <Button
          type="button"
          variant="ghost"
          touchTarget={false}
          onClick={() => onToggleSpan(false)}
          aria-pressed={!spanning}
          className={`flex-1 ${getSegmentClass(!spanning)}`}
        >
          {t('binDesigner.labelTextPerCompartment')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          touchTarget={false}
          onClick={() => onToggleSpan(true)}
          aria-pressed={spanning}
          className={`flex-1 ${getSegmentClass(spanning)}`}
        >
          {t('binDesigner.labelTextPerRow')}
        </Button>
      </div>

      {/* Blank is a fact, not a fault — a bare shelf still takes a paper label —
          so this stays informational. The overflow below is the defect. */}
      {blankCount > 0 && (
        <p className="mb-2 flex items-start gap-1 text-xs text-content-tertiary">
          <InfoIcon size="xs" className="mt-0.5 shrink-0" />
          <span className="flex-1">
            {t(
              blankCount === 1
                ? 'binDesigner.labelTextBlankCount.one'
                : 'binDesigner.labelTextBlankCount.other',
              { count: blankCount }
            )}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            touchTarget={false}
            onClick={jumpToNextBlank}
            className="shrink-0 px-0 font-medium text-accent hover:bg-transparent hover:text-accent/80"
          >
            {t('binDesigner.labelTextNextBlank')}
          </Button>
        </p>
      )}

      {suggestedName !== undefined && onApplySuggestedName && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          touchTarget={false}
          onClick={onApplySuggestedName}
          className="mb-2 rounded-full border border-stroke-subtle px-2 py-0.5 text-label font-medium text-content-secondary hover:bg-surface-hover"
        >
          {t('binDesigner.labelTextUseBinName', { name: suggestedName })}
        </Button>
      )}

      <ul className="flex flex-col gap-1.5">
        {rows.map((row) => {
          const filled = row.value.trim().length > 0;
          const messageId = `${listId}-overflow-${row.index}`;
          return (
            <li key={row.index} className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                {showNumbers && (
                  <span
                    className="w-6 shrink-0 text-right text-xs tabular-nums text-content-tertiary"
                    aria-hidden="true"
                  >
                    {row.displayNumber}
                  </span>
                )}
                <div className={`min-w-0 flex-1 ${filled && !row.overflows ? 'opacity-70' : ''}`}>
                  <CompartmentTextInput
                    multiline
                    minRows={1}
                    committedValue={row.value}
                    compartmentId={row.index}
                    onCommit={onCommit}
                    onNavigate={(direction) => navigate(row.index, direction)}
                    focusToken={focus?.index === row.index ? focus.token : undefined}
                    invalid={row.overflows}
                    describedBy={row.overflows ? messageId : undefined}
                    placeholder={
                      row.index === rows[0]?.index
                        ? t('binDesigner.tabEngravedTextPlaceholder')
                        : ''
                    }
                    ariaLabel={
                      spanning
                        ? t('binDesigner.rowEngravedTextAriaLabel', { n: row.displayNumber })
                        : t('binDesigner.tabEngravedTextAriaLabel', { n: row.displayNumber })
                    }
                  />
                </div>
                {/* Out of the tab order so Tab keeps stepping input to input,
                    which is the fast path for filling a long list. */}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  touchTarget={false}
                  tabIndex={-1}
                  disabled={!filled}
                  onClick={() => onCommit(row.index, '')}
                  aria-label={t('binDesigner.labelTextClearRow', { n: row.displayNumber })}
                  className={`shrink-0 px-1 hover:bg-transparent ${
                    filled ? 'text-content-tertiary hover:text-content' : 'invisible'
                  }`}
                >
                  <XIcon size="xs" />
                </Button>
              </div>
              {row.plate && onPlateWidthChange && onPlateIconChange && (
                <div
                  className={`flex items-center gap-2 ${showNumbers ? 'pl-8' : ''} ${
                    isMobile ? 'flex-wrap' : ''
                  }`}
                >
                  {row.plate.fittingWidthsU.length === 0 || row.plate.autoWidthU === null ? (
                    <span className="text-label text-warning">
                      {t('binDesigner.plateWidthNoFit')}
                    </span>
                  ) : (
                    <>
                      <Select
                        size="sm"
                        value={
                          row.plate.overrideU !== null &&
                          row.plate.fittingWidthsU.some((u) => u === row.plate?.overrideU)
                            ? String(row.plate.overrideU)
                            : 'auto'
                        }
                        onChange={(e) =>
                          onPlateWidthChange(
                            row.index,
                            e.target.value === 'auto' ? null : Number(e.target.value)
                          )
                        }
                        aria-label={t('binDesigner.plateWidthAria', { n: row.displayNumber })}
                        options={[
                          {
                            id: 'auto',
                            name: t('binDesigner.plateWidthAuto', {
                              width: `${row.plate.autoWidthU}U`,
                            }),
                          },
                          ...row.plate.fittingWidthsU.map((u): SelectOption => ({
                            id: String(u),
                            // Technical readout, deliberately untranslated.
                            name: `${u}U · ${labelPlateWidthMm(u)} mm`,
                          })),
                        ]}
                      />
                      <LabelIconPicker
                        value={row.plate.icon}
                        onChange={(icon) => onPlateIconChange(row.index, icon)}
                        ownerName={t('binDesigner.plateIconOwnerCompartment', {
                          n: row.displayNumber,
                        })}
                      />
                    </>
                  )}
                </div>
              )}
              {row.overflows && (
                <p
                  id={messageId}
                  className={`flex items-start gap-1 text-label leading-snug text-error ${
                    showNumbers ? 'pl-8' : ''
                  }`}
                >
                  <span className="flex-1">{t('binDesigner.labelTextTooLong')}</span>
                  {onWiden && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      touchTarget={false}
                      onClick={onWiden}
                      className="shrink-0 px-0 font-medium text-accent hover:bg-transparent hover:text-accent/80"
                    >
                      {t('binDesigner.labelTextWidenTabs')}
                    </Button>
                  )}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-2 flex items-center justify-between">
        {onPickOnGrid && showNumbers ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            touchTarget={false}
            onClick={onPickOnGrid}
            className="h-auto rounded border border-stroke-subtle bg-surface-elevated px-1.5 py-0.5 text-micro font-medium text-content-secondary hover:bg-surface-hover"
          >
            {t('binDesigner.labelTextPickOnGrid')}
          </Button>
        ) : (
          <span />
        )}
        {filledCount > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            touchTarget={false}
            onClick={onClearAll}
            className="px-0 text-label font-medium text-content-tertiary hover:bg-transparent hover:text-content"
          >
            {t('binDesigner.labelTextClearAll')}
          </Button>
        )}
      </div>

      {/* One live region for the whole list: per-row announcements would fire on
          every keystroke that crosses the fit boundary. */}
      <span className="sr-only" aria-live="polite">
        {overflowCount > 0
          ? t(
              overflowCount === 1
                ? 'binDesigner.labelTextOverflowCount.one'
                : 'binDesigner.labelTextOverflowCount.other',
              { count: overflowCount }
            )
          : ''}
      </span>
    </div>
  );
}
