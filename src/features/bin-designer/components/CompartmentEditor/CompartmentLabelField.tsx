/**
 * Deferred-commit editor for the selected compartment's label: keystrokes stay
 * local so they don't bump `generation.epoch` (each commit re-serializes the
 * whole text array and rebuilds every label tab). The inner input is keyed by
 * compartment id so each remounts with a fresh draft.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Input } from '@/design-system';
import { useTranslation } from '@/i18n';
import { TEXT_MAX_LENGTH } from '../../types';
import type { CompartmentLabeling } from './useCompartmentLabeling';

const COMMIT_IDLE_MS = 450;

export function CompartmentLabelField({ labeling }: { labeling: CompartmentLabeling }) {
  const t = useTranslation();
  const { editingId, displayNumberOf } = labeling;

  if (editingId === null) return null;
  const n = displayNumberOf(editingId);

  return (
    <div className="mt-3 flex items-center gap-2">
      <span className="w-16 shrink-0 text-xs font-medium tabular-nums text-content-secondary">
        {t('binDesigner.compartmentNumberLabel', { n })}
      </span>
      <LabelInput
        key={editingId}
        compartmentId={editingId}
        committed={labeling.textOf(editingId)}
        ariaLabel={t('binDesigner.tabEngravedTextAriaLabel', { n })}
        placeholder={t('binDesigner.tabEngravedTextPlaceholder')}
        labeling={labeling}
      />
    </div>
  );
}

function LabelInput({
  compartmentId,
  committed,
  ariaLabel,
  placeholder,
  labeling,
}: {
  compartmentId: number;
  committed: string;
  ariaLabel: string;
  placeholder: string;
  labeling: CompartmentLabeling;
}) {
  const { commitText, advance, moveByGrid } = labeling;
  const [draft, setDraft] = useState(committed);
  const inputRef = useRef<HTMLInputElement>(null);
  const focusedRef = useRef(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current !== null) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  // Re-sync only an external change (undo/redo) while not focused, so it can't
  // clobber the active draft.
  useEffect(() => {
    if (!focusedRef.current) setDraft(committed);
  }, [committed]);

  const commit = useCallback(
    (value: string) => commitText(compartmentId, value),
    [commitText, compartmentId]
  );

  // Flush an uncommitted draft on unmount: clicking another cell within the idle
  // window can't rely on blur, since GridCell's pointerDown preventDefault (for
  // divider drag) suppresses it. The ref keeps the unmount-only cleanup current;
  // setCompartmentText no-ops unchanged values, so this never over-regenerates.
  const flushRef = useRef({ commit, draft });
  useEffect(() => {
    flushRef.current = { commit, draft };
  });
  useEffect(
    () => () => {
      clearIdleTimer();
      flushRef.current.commit(flushRef.current.draft);
    },
    [clearIdleTimer]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value;
      setDraft(next);
      clearIdleTimer();
      idleTimerRef.current = setTimeout(() => {
        idleTimerRef.current = null;
        commit(next);
      }, COMMIT_IDLE_MS);
    },
    [clearIdleTimer, commit]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Arrows only navigate when the caret can't move within the text, so
      // editing mid-label still works. Left/right need the caret at the
      // boundary; up/down always navigate (single-line input).
      const el = e.currentTarget;
      const atStart = el.selectionStart === 0 && el.selectionEnd === 0;
      const atEnd = el.selectionStart === draft.length && el.selectionEnd === draft.length;

      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        clearIdleTimer();
        commit(draft);
        advance(e.shiftKey ? 'prev' : 'next');
        return;
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        clearIdleTimer();
        commit(draft);
        moveByGrid(e.key === 'ArrowUp' ? 'up' : 'down');
        return;
      }
      if (e.key === 'ArrowLeft' && atStart) {
        e.preventDefault();
        clearIdleTimer();
        commit(draft);
        moveByGrid('left');
        return;
      }
      if (e.key === 'ArrowRight' && atEnd) {
        e.preventDefault();
        clearIdleTimer();
        commit(draft);
        moveByGrid('right');
      }
    },
    [draft, clearIdleTimer, commit, advance, moveByGrid]
  );

  const handleBlur = useCallback(() => {
    focusedRef.current = false;
    clearIdleTimer();
    commit(draft);
  }, [clearIdleTimer, commit, draft]);

  return (
    <Input
      ref={inputRef}
      type="text"
      size="sm"
      value={draft}
      maxLength={TEXT_MAX_LENGTH}
      onChange={handleChange}
      onFocus={() => (focusedRef.current = true)}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      placeholder={placeholder}
      aria-label={ariaLabel}
    />
  );
}
