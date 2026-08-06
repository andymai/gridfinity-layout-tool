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

import { useCallback, useId, useMemo, useState } from 'react';
import { Button, InfoIcon, XIcon } from '@/design-system';
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
}

interface LabelTextListProps {
  readonly rows: readonly LabelTextRowModel[];
  readonly spanning: boolean;
  readonly onToggleSpan: (spanning: boolean) => void;
  readonly onCommit: (index: number, value: string) => void;
  readonly onClearAll: () => void;
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
}: LabelTextListProps) {
  const t = useTranslation();
  const listId = useId();
  const [focus, setFocus] = useState<{ index: number; token: number } | null>(null);

  // A single compartment has nothing to be numbered against, so the column is
  // pure noise there.
  const showNumbers = rows.length > 1;

  const blankCount = useMemo(() => rows.filter((r) => !r.value.trim()).length, [rows]);
  const overflowCount = useMemo(() => rows.filter((r) => r.overflows).length, [rows]);
  const filledCount = rows.length - blankCount;

  const focusRow = useCallback((index: number) => {
    setFocus((prev) => ({ index, token: (prev?.token ?? 0) + 1 }));
  }, []);

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
            {t('binDesigner.labelTextBlankCount', { count: blankCount })}
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
                    committedValue={row.value}
                    compartmentId={row.index}
                    onCommit={onCommit}
                    onNavigate={(direction) => navigate(row.index, direction)}
                    focusToken={focus?.index === row.index ? focus.token : undefined}
                    invalid={row.overflows}
                    describedBy={row.overflows ? messageId : undefined}
                    placeholder={t('binDesigner.tabEngravedTextPlaceholder')}
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
              {row.overflows && (
                <p
                  id={messageId}
                  className={`flex items-start gap-1 text-[11px] leading-snug text-error ${
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

      <div className="mt-2 flex items-center justify-end">
        {filledCount > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            touchTarget={false}
            onClick={onClearAll}
            className="px-0 text-[11px] font-medium text-content-tertiary hover:bg-transparent hover:text-content"
          >
            {t('binDesigner.labelTextClearAll')}
          </Button>
        )}
      </div>

      {/* One live region for the whole list: per-row announcements would fire on
          every keystroke that crosses the fit boundary. */}
      <span className="sr-only" aria-live="polite">
        {overflowCount > 0 ? t('binDesigner.labelTextOverflowCount', { count: overflowCount }) : ''}
      </span>
    </div>
  );
}
