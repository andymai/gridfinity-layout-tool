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

export function useInlineEdit({ initialValue, onSave }: UseInlineEditOptions): UseInlineEditResult {
  const [isEditing, setIsEditing] = useState(false);
  const [editingValue, setEditingValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement | null>(null);

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
