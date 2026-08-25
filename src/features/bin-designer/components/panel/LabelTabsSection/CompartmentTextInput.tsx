/**
 * Per-compartment engraved-text input with deferred commit.
 *
 * Typing updates only this input's local `draft` state — it does NOT touch the
 * store, so it never bumps `generation.epoch` or triggers a 3D regeneration.
 * The value commits (via `onCommit`, which writes `compartmentTexts` and pushes
 * one history entry) only when the user pauses for `COMMIT_IDLE_MS` or blurs.
 *
 * Without this, every keystroke regenerated the bin — and because the label-tab
 * cache key serializes the whole text array, each regen rebuilt *every* label's
 * engraved geometry. Deferring the commit collapses a whole word's worth of
 * regenerations into one.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Input, Textarea } from '@/design-system';
import {
  TEXT_MAX_LENGTH,
  TEXT_MAX_LINES,
  TEXT_MAX_TOTAL_LENGTH,
  normalizeTextInput,
} from '../../../types';

/** Idle gap after the last keystroke before an edit commits (and regenerates).
 *  Long enough to skip intra-word keystrokes, short enough to feel responsive
 *  on pause. Blur commits immediately regardless. */
const COMMIT_IDLE_MS = 450;

interface CompartmentTextInputProps {
  /** The committed store value; the source of truth between edits. */
  readonly committedValue: string;
  /** Compartment id passed straight back to `onCommit`. Kept a separate prop
   *  (rather than baked into an `onCommit` closure by the parent) so the parent
   *  can pass the store action by reference and this component's handlers stay
   *  referentially stable across parent re-renders. */
  readonly compartmentId: number;
  readonly placeholder: string;
  readonly ariaLabel: string;
  /** Writes the value to the store (clamps + dedups + pushes history). */
  readonly onCommit: (compartmentId: number, value: string) => void;
  /** Move editing to the adjacent row. Enter and Up/Down commit first, so the
   *  next row opens against a settled store rather than a pending draft. */
  readonly onNavigate?: (direction: 'next' | 'prev') => void;
  /** Take focus whenever this value CHANGES. A token rather than a boolean so
   *  the same row can be re-targeted (repeated "next empty" presses land on the
   *  same input while it stays empty). */
  readonly focusToken?: number;
  /** The caption overflows its tab and will not render. Styled and announced. */
  readonly invalid?: boolean;
  /** Id of the element explaining {@link invalid}, for screen readers. */
  readonly describedBy?: string;
  /**
   * Accept line breaks, up to {@link TEXT_MAX_LINES}.
   *
   * Opt-in rather than the default because it changes what Enter means. With
   * {@link onNavigate} set the field is one row of a list, so Enter keeps moving
   * between rows and Shift+Enter takes the line break; a standalone wall or lid
   * caption has nowhere to navigate, so Enter breaks the line directly.
   */
  readonly multiline?: boolean;
  /** Rows to show before the caption has grown into them. */
  readonly minRows?: number;
}

export function CompartmentTextInput({
  committedValue,
  compartmentId,
  placeholder,
  ariaLabel,
  onCommit,
  onNavigate,
  focusToken,
  invalid = false,
  describedBy,
  multiline = false,
  minRows = 2,
}: CompartmentTextInputProps) {
  const [draft, setDraft] = useState(committedValue);
  const focusedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stable as long as the store action and id are stable, so `onBlur`/`onChange`
  // identities don't churn on every parent render.
  const commit = useCallback(
    (value: string) => onCommit(compartmentId, value),
    [onCommit, compartmentId]
  );

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current !== null) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  // Re-sync the draft when the committed value changes from OUTSIDE this input
  // (undo/redo, auto-fix, loading a design). Guarded on focus so an external
  // change can't clobber what the user is actively typing.
  useEffect(() => {
    if (!focusedRef.current) setDraft(committedValue);
  }, [committedValue]);

  // Clear any pending idle timer on unmount. Deliberately does NOT commit — blur
  // fires before unmount in normal flows, and committing here would regenerate
  // geometry when the user merely collapses the section or navigates away.
  useEffect(() => clearIdleTimer, [clearIdleTimer]);

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

  const handleFocus = useCallback(() => {
    focusedRef.current = true;
  }, []);

  const handleBlur = useCallback(() => {
    focusedRef.current = false;
    clearIdleTimer();
    commit(draft);
  }, [clearIdleTimer, draft, commit]);

  // Tab is deliberately NOT intercepted: the rows are siblings in the DOM, so
  // the browser already moves to the next input (the clear buttons opt out of
  // the tab order to keep that true). Enter and Up/Down are the additions.
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!onNavigate) return;
      const direction =
        e.key === 'Enter' ? (e.shiftKey ? 'prev' : 'next') : e.key === 'ArrowUp' ? 'prev' : 'next';
      if (e.key !== 'Enter' && e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      e.preventDefault();
      clearIdleTimer();
      commit(draft);
      onNavigate(direction);
    },
    [onNavigate, clearIdleTimer, commit, draft]
  );

  useEffect(() => {
    if (focusToken === undefined) return;
    const field = multiline ? areaRef.current : inputRef.current;
    field?.focus();
    field?.select();
  }, [focusToken, multiline]);

  // In a list, Enter stays row navigation. Filling captions one after another is
  // the common case and losing it would cost more than a second line is worth,
  // so the line break moves to Shift+Enter. A standalone field has no rows to
  // move between, so there Enter breaks the line as it always did.
  //
  // Enter is swallowed at the cap rather than passed through: that is what stops
  // a paste-and-hold from silently losing the tail to the normaliser.
  const handleAreaKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter') {
        if (onNavigate && !e.shiftKey) {
          e.preventDefault();
          clearIdleTimer();
          commit(draft);
          onNavigate('next');
          return;
        }
        if (draft.split('\n').length >= TEXT_MAX_LINES) e.preventDefault();
        return;
      }
      if (!onNavigate || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
      // Leave the field only from its outer edges, so the arrows still walk the
      // caret through a caption that has grown a second line.
      const el = e.currentTarget;
      const leaving =
        e.key === 'ArrowUp'
          ? !el.value.slice(0, el.selectionStart).includes('\n')
          : !el.value.slice(el.selectionEnd).includes('\n');
      if (!leaving) return;
      e.preventDefault();
      clearIdleTimer();
      commit(draft);
      onNavigate(e.key === 'ArrowUp' ? 'prev' : 'next');
    },
    [draft, onNavigate, clearIdleTimer, commit]
  );

  // Normalising on the way in keeps the field showing exactly what will be
  // stored, rather than letting the store silently truncate a paste later.
  const handleAreaChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      handleChange({
        ...e,
        target: { ...e.target, value: normalizeTextInput(e.target.value) },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
    },
    [handleChange]
  );

  if (multiline) {
    return (
      <Textarea
        ref={areaRef}
        // Grows with the caption so a list of one-line labels keeps the height
        // it had as a single-line field.
        rows={Math.min(TEXT_MAX_LINES, Math.max(minRows, draft.split('\n').length))}
        resize="none"
        value={draft}
        maxLength={TEXT_MAX_TOTAL_LENGTH}
        onChange={handleAreaChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleAreaKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
      />
    );
  }

  return (
    <Input
      ref={inputRef}
      type="text"
      size="sm"
      value={draft}
      maxLength={TEXT_MAX_LENGTH}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      aria-label={ariaLabel}
      error={invalid}
      aria-describedby={describedBy}
    />
  );
}
