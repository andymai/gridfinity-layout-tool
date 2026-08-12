/**
 * Space-drag / middle-button pan for the Bento canvas, matching the cutout
 * workspace's camera gestures — wheel zoom without pan is a trap once zoomed
 * in. Pointer deltas translate the camera center in world mm (screen px ÷
 * zoom, Y inverted because world Y points up).
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface BentoPanApi {
  readonly spaceHeld: boolean;
  readonly isPanning: boolean;
  /** Returns true when the event started a pan — the caller must then NOT
   *  hand the same event to the draw/move interaction. */
  readonly onPointerDown: (e: React.PointerEvent) => boolean;
}

const isEditableTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement && !!target.closest('input, textarea, [contenteditable="true"]');

export function useBentoPan(
  setCameraCenter: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>,
  zoom: number
): BentoPanApi {
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const spaceHeldRef = useRef(false);
  const lastClientRef = useRef<{ x: number; y: number } | null>(null);
  const zoomRef = useRef(zoom);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    const setSpace = (held: boolean): void => {
      spaceHeldRef.current = held;
      setSpaceHeld(held);
    };
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.code !== 'Space' || e.repeat || isEditableTarget(e.target)) return;
      e.preventDefault();
      setSpace(true);
    };
    const onKeyUp = (e: KeyboardEvent): void => {
      if (e.code === 'Space') setSpace(false);
    };
    // A missed keyup (tab switch mid-hold) must not leave pan mode stuck on.
    const onBlur = (): void => setSpace(false);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  useEffect(() => {
    if (!isPanning) return;
    const onMove = (e: PointerEvent): void => {
      const last = lastClientRef.current;
      if (!last) return;
      const dx = e.clientX - last.x;
      const dy = e.clientY - last.y;
      lastClientRef.current = { x: e.clientX, y: e.clientY };
      const z = zoomRef.current;
      if (z <= 0) return;
      setCameraCenter((prev) => ({ x: prev.x - dx / z, y: prev.y + dy / z }));
    };
    const onEnd = (): void => {
      lastClientRef.current = null;
      setIsPanning(false);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
    };
  }, [isPanning, setCameraCenter]);

  const onPointerDown = useCallback((e: React.PointerEvent): boolean => {
    const isPanStart = e.button === 1 || (e.button === 0 && spaceHeldRef.current);
    if (!isPanStart) return false;
    e.preventDefault();
    lastClientRef.current = { x: e.clientX, y: e.clientY };
    setIsPanning(true);
    return true;
  }, []);

  return { spaceHeld, isPanning, onPointerDown };
}
