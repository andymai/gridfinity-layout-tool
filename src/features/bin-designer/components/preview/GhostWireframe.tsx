/**
 * Ghost wireframe box shown during mesh generation.
 *
 * Renders 12 edges only (no faces) for minimal visual weight.
 * Provides immediate visual feedback of target dimensions while
 * the actual mesh is being generated in the worker.
 */

import { useMemo, useEffect, useRef, useState, useCallback, useLayoutEffect } from 'react';
import * as THREE from 'three';
import { useThree, useFrame } from '@react-three/fiber';
import { useShallow } from 'zustand/react/shallow';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';
import { useDesignerStore } from '@/features/bin-designer/store';

/** Subtle gray color for the wireframe */
const GHOST_COLOR = '#c8d0d8';

/** Duration of the morph-out animation in ms */
const MORPH_DURATION = 200;

/** Minimum time ghost must be visible before morphing (ms) */
const MIN_DISPLAY_TIME = 150;

/** Maximum scale increase during morph (3% larger) */
const MORPH_SCALE_FACTOR = 0.03;

/** Pulse animation frequency in Hz */
const PULSE_FREQUENCY = 1.2;

/** Opacity range for pulse: oscillates between (1 - PULSE_AMPLITUDE) and 1 */
const PULSE_AMPLITUDE = 0.25;

interface AnimatedState {
  visible: boolean;
  opacity: number;
  scale: number;
  /** Pulse phase for smooth animation (0-1) */
  pulsePhase: number;
}

/**
 * Ghost wireframe with integrated animation.
 * Reads dimensions and ghost phase from store, handles morph animation internally.
 */
export function GhostWireframe() {
  const { invalidate } = useThree();

  const { width, depth, height, ghostTransition } = useDesignerStore(
    useShallow((s) => ({
      width: s.params.width,
      depth: s.params.depth,
      height: s.params.height,
      ghostTransition: s.generation.ghostTransition,
    }))
  );

  const setGhostPhase = useDesignerStore((s) => s.setGhostPhase);

  // Track when ghost started showing (for minimum display time enforcement)
  const showStartTimeRef = useRef<number>(0);
  const prevPhaseRef = useRef<string>(ghostTransition.phase);

  // Animated state - initialize based on current phase for correct SSR/first render
  const [animated, setAnimated] = useState<AnimatedState>(() => {
    if (ghostTransition.phase === 'showing') {
      return { visible: true, opacity: 1, scale: 1, pulsePhase: 0 };
    }
    return { visible: false, opacity: 0, scale: 1, pulsePhase: 0 };
  });

  // Initialize showStartTime if already in 'showing' phase on mount
  useLayoutEffect(() => {
    if (ghostTransition.phase === 'showing' && showStartTimeRef.current === 0) {
      showStartTimeRef.current = performance.now();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Stable callback for updating animated state (avoids stale closure in useFrame)
  const updateAnimated = useCallback((updater: (prev: AnimatedState) => AnimatedState) => {
    setAnimated(updater);
  }, []);

  // Calculate box dimensions in mm
  const boxDimensions = useMemo(
    () => ({
      w: width * GRIDFINITY.GRID_SIZE,
      d: depth * GRIDFINITY.GRID_SIZE,
      h: height * GRIDFINITY.HEIGHT_UNIT,
    }),
    [width, depth, height]
  );

  // Create edges geometry from a box (12 edges only, no face diagonals)
  const edgesGeometry = useMemo(() => {
    const box = new THREE.BoxGeometry(boxDimensions.w, boxDimensions.d, boxDimensions.h);
    const edges = new THREE.EdgesGeometry(box);
    box.dispose(); // Don't need the box faces
    return edges;
  }, [boxDimensions]);

  // Dispose geometry on unmount or change
  useEffect(() => {
    return () => {
      edgesGeometry.dispose();
    };
  }, [edgesGeometry]);

  // Handle all animation in useFrame (not useEffect) to avoid setState warnings
  useFrame(() => {
    const { phase, startTime } = ghostTransition;

    // Detect phase transitions
    if (phase !== prevPhaseRef.current) {
      prevPhaseRef.current = phase;

      if (phase === 'hidden') {
        updateAnimated(() => ({ visible: false, opacity: 0, scale: 1, pulsePhase: 0 }));
      } else if (phase === 'showing') {
        showStartTimeRef.current = performance.now();
        updateAnimated(() => ({ visible: true, opacity: 1, scale: 1, pulsePhase: 0 }));
      }
      invalidate();
      return;
    }

    // Handle pulse animation during 'showing' phase
    if (phase === 'showing') {
      const elapsed = performance.now() - showStartTimeRef.current;
      // Smooth sine wave pulse: oscillates opacity between (1 - PULSE_AMPLITUDE) and 1
      const pulsePhase = (elapsed / 1000) * PULSE_FREQUENCY * Math.PI * 2;
      const pulseOpacity = 1 - PULSE_AMPLITUDE * (0.5 + 0.5 * Math.sin(pulsePhase));

      updateAnimated((prev) => ({
        ...prev,
        opacity: pulseOpacity,
        pulsePhase,
      }));
      invalidate();
      return;
    }

    // Handle morphing animation
    if (phase === 'morphing') {
      const now = performance.now();

      // Enforce minimum display time before starting morph animation
      const displayTime = now - showStartTimeRef.current;
      if (displayTime < MIN_DISPLAY_TIME) {
        invalidate(); // Keep checking
        return;
      }

      // Calculate morph progress from when morph was requested
      const morphElapsed = now - startTime;
      const progress = Math.min(morphElapsed / MORPH_DURATION, 1);
      // Ease-out quadratic for smooth deceleration
      const eased = 1 - Math.pow(1 - progress, 2);

      updateAnimated(() => ({
        visible: progress < 1,
        opacity: 1 - eased,
        scale: 1 + eased * MORPH_SCALE_FACTOR,
        pulsePhase: 0,
      }));
      invalidate();

      if (progress >= 1) {
        setGhostPhase('hidden');
      }
    }
  });

  // Invalidate frame when dimensions change during 'showing' phase
  useEffect(() => {
    if (ghostTransition.phase === 'showing') {
      invalidate();
    }
  }, [boxDimensions, ghostTransition.phase, invalidate]);

  if (!animated.visible || animated.opacity <= 0) return null;

  // Position: centered XY at origin, base at Z=0.15 (slightly in front of mesh at Z=0.1)
  const centerZ = boxDimensions.h / 2;

  return (
    <lineSegments
      geometry={edgesGeometry}
      position={[0, 0, centerZ + 0.15]}
      scale={[animated.scale, animated.scale, animated.scale]}
    >
      <lineBasicMaterial color={GHOST_COLOR} transparent opacity={animated.opacity} linewidth={1} />
    </lineSegments>
  );
}
