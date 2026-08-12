/**
 * Inline rename behaviour: focus-and-select on entry, Enter commits, Escape
 * reverts, trim, and skip a commit that would not change anything.
 *
 * This is the only implementation of those rules. {@link InlineEditText} is a
 * styled preset over this hook — a display button that swaps to an input — so
 * the two cannot drift apart.
 *
 * Reach for the hook directly when the caller has to render the display half
 * itself: when rename is triggered from a row menu rather than by clicking the
 * name, or when the display carries more than the value (a badge, a thumbnail,
 * a row that is itself clickable, where a nested display button would be wrong).
 * Reach for {@link InlineEditText} when clicking the name is what starts the
 * rename and the display is only the name.
 *
 * It lives here rather than in `shared/` because the design system may not
 * import from any application layer, and the styled preset needs it.
 */

import type { RefObject, KeyboardEvent } from 'react';
import { useState, useRef, useEffect, useCallback } from 'react';

interface UseInlineEditOptions {
  initialValue: string;
  onSave: (value: string) => void;
  /**
   * Committed when the trimmed input is empty. When omitted, an empty input
   * reverts to {@link initialValue} instead of saving.
   */
  fallback?: string;
}

interface UseInlineEditResult {
  isEditing: boolean;
  editingValue: string;
  inputRef: RefObject<HTMLInputElement | null>;
  startEditing: () => void;
  handleChange: (value: string) => void;
  handleFinish: () => void;
  handleKeyDown: (e: KeyboardEvent) => void;
}

export function useInlineEdit({
  initialValue,
  onSave,
  fallback,
}: UseInlineEditOptions): UseInlineEditResult {
  const [isEditing, setIsEditing] = useState(false);
  const [editingValue, setEditingValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement | null>(null);
  // Browsers (not jsdom) fire a native blur when the focused input is removed
  // from the DOM, and the handler still closes over the pre-Escape draft — so
  // without this an Escape-revert commits the value it was meant to discard.
  const revertedRef = useRef(false);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const startEditing = useCallback(() => {
    revertedRef.current = false;
    setEditingValue(initialValue);
    setIsEditing(true);
  }, [initialValue]);

  const handleChange = useCallback((value: string) => {
    setEditingValue(value);
  }, []);

  const handleFinish = useCallback(() => {
    if (revertedRef.current) return;
    const next = editingValue.trim() || fallback || initialValue;
    if (next !== initialValue) {
      onSave(next);
    }
    setIsEditing(false);
  }, [editingValue, initialValue, fallback, onSave]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleFinish();
      } else if (e.key === 'Escape') {
        revertedRef.current = true;
        setIsEditing(false);
        setEditingValue(initialValue);
      }
    },
    [handleFinish, initialValue]
  );

  return {
    isEditing,
    editingValue,
    inputRef,
    startEditing,
    handleChange,
    handleFinish,
    handleKeyDown,
  };
}
