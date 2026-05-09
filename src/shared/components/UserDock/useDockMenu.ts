import { useCallback, useEffect, useRef, useState } from 'react';

interface DockMenuApi {
  open: boolean;
  toggle: () => void;
  close: () => void;
  rootRef: React.RefObject<HTMLDivElement | null>;
  triggerProps: {
    'aria-expanded': boolean;
  };
}

export function useDockMenu(): DockMenuApi {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((v) => !v), []);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      const root = rootRef.current;
      if (root && !root.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  return {
    open,
    toggle,
    close,
    rootRef,
    triggerProps: {
      'aria-expanded': open,
    },
  };
}
