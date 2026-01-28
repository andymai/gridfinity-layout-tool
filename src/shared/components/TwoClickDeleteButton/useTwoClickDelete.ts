import { useState, useCallback } from 'react';

/**
 * Hook to manage two-click delete state externally.
 * Useful when the button is part of a larger component that needs
 * to coordinate the confirming state (e.g., keep a menu open).
 */
export function useTwoClickDelete(onDelete: () => void) {
  const [isConfirming, setIsConfirming] = useState(false);

  const handleClick = useCallback(() => {
    if (isConfirming) {
      onDelete();
      setIsConfirming(false);
    } else {
      setIsConfirming(true);
    }
  }, [isConfirming, onDelete]);

  const reset = useCallback(() => {
    setIsConfirming(false);
  }, []);

  return { isConfirming, handleClick, reset };
}
