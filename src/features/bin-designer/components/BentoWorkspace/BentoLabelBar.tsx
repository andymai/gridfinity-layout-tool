/**
 * Inline label editing for the Bento workspace.
 *
 * The sidebar editor deliberately has no text field on the grid: clicking a
 * cell there focuses that compartment's row in the Label tabs list, which is
 * the single editor, and a second field would be the same data with its own
 * draft state. The workspace has no such list beside it, so the field lives
 * here instead — still the only editor on this surface.
 *
 * Enter moves to the next compartment so a whole tray can be labelled without
 * reaching for the mouse.
 */

import { useEffect, useRef } from 'react';
import { Button, Input } from '@/design-system';
import { useTranslation } from '@/i18n';
import { getSegmentClass, SEGMENT_GROUP_CLASS } from '@/shared/components/segmentedControlClasses';
import type { CompartmentGridApi } from '../CompartmentEditor/useCompartmentGrid';

export interface BentoLabelBarProps {
  readonly grid: CompartmentGridApi;
}

export function BentoLabelBar({ grid }: BentoLabelBarProps) {
  const t = useTranslation();
  const { labeling } = grid;
  const inputRef = useRef<HTMLInputElement>(null);

  const editingId = labeling.editingId;

  useEffect(() => {
    if (labeling.labelMode && editingId !== null) inputRef.current?.focus();
  }, [labeling.labelMode, editingId]);

  if (!labeling.canLabel) return null;

  return (
    <div className="flex flex-shrink-0 items-center gap-3 border-t border-stroke-subtle bg-surface-secondary px-4 py-2">
      <div
        role="group"
        aria-label={t('binDesigner.compartmentEditor.modeLabel')}
        className={SEGMENT_GROUP_CLASS}
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          touchTarget={false}
          onClick={() => labeling.setLabelMode(false)}
          aria-pressed={!labeling.labelMode}
          className={getSegmentClass(!labeling.labelMode)}
        >
          {t('binDesigner.compartmentEditor.modeDividers')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          touchTarget={false}
          onClick={() => labeling.setLabelMode(true)}
          aria-pressed={labeling.labelMode}
          className={getSegmentClass(labeling.labelMode)}
        >
          {t('binDesigner.compartmentEditor.modeLabels')}
        </Button>
      </div>

      {labeling.labelMode &&
        (editingId === null ? (
          <p className="text-xs text-content-tertiary">
            {t('binDesigner.compartmentEditor.clickToLabel')}
          </p>
        ) : (
          <label className="flex flex-1 items-center gap-2">
            <span className="text-xs text-content-tertiary">
              {labeling.displayNumberOf(editingId)}
            </span>
            <Input
              ref={inputRef}
              value={labeling.textOf(editingId)}
              onChange={(e) => labeling.commitText(editingId, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  labeling.advance(e.shiftKey ? 'prev' : 'next');
                }
              }}
              maxLength={24}
              className="max-w-xs"
              aria-label={t('binDesigner.bento.labelFor', {
                number: labeling.displayNumberOf(editingId),
              })}
            />
          </label>
        ))}
    </div>
  );
}
