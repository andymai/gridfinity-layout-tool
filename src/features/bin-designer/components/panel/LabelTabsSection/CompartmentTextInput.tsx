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
import { Input } from '@/design-system';
import { TEXT_MAX_LENGTH } from '../../../types';

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
}

export function CompartmentTextInput({
  committedValue,
  compartmentId,
  placeholder,
  ariaLabel,
  onCommit,
}: CompartmentTextInputProps) {
  const [draft, setDraft] = useState(committedValue);
  const focusedRef = useRef(false);
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

  return (
    <Input
      type="text"
      size="sm"
      value={draft}
      maxLength={TEXT_MAX_LENGTH}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={placeholder}
      aria-label={ariaLabel}
    />
  );
}
