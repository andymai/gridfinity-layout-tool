import { useState, useRef, useEffect, useCallback } from 'react';

interface UseInlineEditOptions {
  initialValue: string;
  onSave: (value: string) => void;
}

interface UseInlineEditResult {
  isEditing: boolean;
  editingValue: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  startEditing: () => void;
  handleChange: (value: string) => void;
  handleFinish: () => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
}

/**
 * Hook for inline text editing with keyboard support.
 * Used by LayoutListItem and LayoutGridItem for rename functionality.
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
    (e: React.KeyboardEvent) => {
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
