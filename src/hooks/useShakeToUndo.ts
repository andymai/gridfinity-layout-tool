import { useEffect, useRef, useCallback } from 'react';
import { useHistoryStore } from '../store';
import { useToastStore } from '../store/toast';

// Shake detection parameters
const SHAKE_THRESHOLD = 15; // Acceleration threshold (m/s²)
const SHAKE_TIMEOUT = 1000; // Minimum time between shakes (ms)
const SHAKE_COUNT_THRESHOLD = 2; // Number of threshold crossings needed

/**
 * Hook that enables shake-to-undo on mobile devices.
 * Uses DeviceMotionEvent to detect shake gestures.
 *
 * @param enabled - Whether shake detection is enabled (typically true only on mobile)
 */
export function useShakeToUndo(enabled: boolean) {
  const canUndo = useHistoryStore(state => state.canUndo);
  const undo = useHistoryStore(state => state.undo);
  const addToast = useToastStore(state => state.addToast);

  const lastShakeRef = useRef<number>(0);
  const shakeCountRef = useRef<number>(0);
  const lastAccelRef = useRef<{ x: number; y: number; z: number } | null>(null);

  const handleShake = useCallback(() => {
    const now = Date.now();
    if (now - lastShakeRef.current < SHAKE_TIMEOUT) {
      return; // Debounce
    }

    if (canUndo) {
      lastShakeRef.current = now;
      undo();
      addToast('Shake detected — Undo', 'info');
    }
  }, [canUndo, undo, addToast]);

  useEffect(() => {
    if (!enabled) return;

    // Check if DeviceMotion is available
    if (typeof DeviceMotionEvent === 'undefined') {
      return;
    }

    const handleMotion = (event: DeviceMotionEvent) => {
      const acceleration = event.accelerationIncludingGravity;
      if (!acceleration) return;

      const { x, y, z } = acceleration;
      if (x === null || y === null || z === null) return;

      const last = lastAccelRef.current;
      if (last) {
        // Calculate acceleration delta
        const deltaX = Math.abs(x - last.x);
        const deltaY = Math.abs(y - last.y);
        const deltaZ = Math.abs(z - last.z);
        const totalDelta = deltaX + deltaY + deltaZ;

        if (totalDelta > SHAKE_THRESHOLD) {
          shakeCountRef.current++;
          if (shakeCountRef.current >= SHAKE_COUNT_THRESHOLD) {
            handleShake();
            shakeCountRef.current = 0;
          }
        } else {
          // Reset count if motion slows down
          shakeCountRef.current = Math.max(0, shakeCountRef.current - 0.5);
        }
      }

      lastAccelRef.current = { x, y, z };
    };

    // Request permission on iOS 13+
    const requestPermission = async () => {
      // iOS 13+ requires permission request
      if (typeof (DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission === 'function') {
        try {
          const permission = await (DeviceMotionEvent as unknown as { requestPermission: () => Promise<string> }).requestPermission();
          if (permission !== 'granted') {
            return false;
          }
        } catch {
          return false;
        }
      }
      return true;
    };

    requestPermission().then(granted => {
      if (granted) {
        window.addEventListener('devicemotion', handleMotion);
      }
    });

    return () => {
      window.removeEventListener('devicemotion', handleMotion);
    };
  }, [enabled, handleShake]);
}
