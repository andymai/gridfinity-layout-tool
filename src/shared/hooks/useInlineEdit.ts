import type { RefObject, KeyboardEvent } from 'react';
import { useState, useRef, useEffect, useCallback } from 'react';

interface UseInlineEditOptions {
  initialValue: string;
  onSave: (value: string) => void;
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

/**
 * Hook for inline text editing with keyboard support.
 *
 * Provides a complete editing state machine:
 * - startEditing() enters edit mode (focuses and selects input)
 * - handleChange() updates the editing value
 * - handleFinish() commits changes (on blur or Enter)
 * - handleKeyDown() handles Enter (commit) and Escape (cancel)
 *
 * Used by list/grid items that support inline rename functionality.
 */
export function useInlineEdit({ initialValue, onSave }: UseInlineEditOptions): UseInlineEditResult {
  const [isEditing, setIsEditing] = useState(false);
  const [editingValue, setEditingValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Focus and select input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const startEditing = useCallback(() => {
    setEditingValue(initialValue);
    setIsEditing(true);
  }, [initialValue]);

  const handleChange = useCallback((value: string) => {
    setEditingValue(value);
  }, []);

  const handleFinish = useCallback(() => {
    const trimmed = editingValue.trim();
    if (trimmed && trimmed !== initialValue) {
      onSave(trimmed);
    }
    setIsEditing(false);
  }, [editingValue, initialValue, onSave]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleFinish();
      } else if (e.key === 'Escape') {
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
