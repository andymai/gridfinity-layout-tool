import { useEffect, useRef, useImperativeHandle, forwardRef, useMemo, useState } from 'react';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { OrthographicCamera, Spherical, Vector3 } from 'three';
import { useUIStore } from '../../../store';
import type { OrbitControls as OrbitControlsType } from 'three-stdlib';
import { FloorGrid } from './FloorGrid';
import { FrontLabel } from './FrontLabel';
import { AxisLabels } from './AxisLabels';
import { DrawerDimensions } from './DrawerDimensions';
import { ScaleIndicator } from './ScaleIndicator';

interface SceneProps {
  children: React.ReactNode;
  drawerWidth: number;
  drawerDepth: number;
  drawerHeight: number;
  gridUnitMm: number;
  layoutName: string;
  isExpanded?: boolean;
}

export type CameraPreset = 'isometric' | 'front' | 'side';

export interface SceneHandle {
  resetView: () => void;
  setPreset: (preset: CameraPreset) => void;
}

/**
 * Main scene component with camera, lights, orbit controls, and environment.
 * Handles rotation sync with UI store and renders floor grid.
 */
export const Scene = forwardRef<SceneHandle, SceneProps>(
  ({ children, drawerWidth, drawerDepth, drawerHeight, gridUnitMm, layoutName, isExpanded }, ref) => {
    const controlsRef = useRef<OrbitControlsType>(null);
    const prevExpandedRef = useRef<boolean | undefined>(undefined);
    const { camera, size } = useThree();

    const setIsometricRotation = useUIStore((state) => state.setIsometricRotation);

    // Calculate scene center for camera target
    const centerX = drawerWidth / 2;
    const centerY = drawerDepth / 2;
    const centerZ = (drawerHeight * 7 / 42) / 2; // Convert height units to grid units

    // Calculate default camera position - front-right view so FRONT is at bottom-left
    const defaultCameraPosition = useMemo(() => {
      const maxDimension = Math.max(drawerWidth, drawerDepth);
      const cameraDistance = maxDimension * 0.8;
      return [
        centerX + cameraDistance,
        centerY - cameraDistance,
        centerZ + cameraDistance * 0.7,
      ] as [number, number, number];
    }, [drawerWidth, drawerDepth, centerX, centerY, centerZ]);

    // Calculate preset camera positions
    const cameraPresets = useMemo(() => {
      const maxDimension = Math.max(drawerWidth, drawerDepth);
      const distance = maxDimension * 0.8;

      return {
        isometric: [
          centerX + distance,
          centerY - distance,
          centerZ + distance * 0.7,
        ] as [number, number, number],
        front: [
          centerX,
          centerY - distance * 1.2,
          centerZ,
        ] as [number, number, number],
        side: [
          centerX + distance * 1.2,
          centerY,
          centerZ,
        ] as [number, number, number],
      };
    }, [drawerWidth, drawerDepth, centerX, centerY, centerZ]);

    // Set camera up vector to Z-up and position to default view
    useEffect(() => {
      camera.up.set(0, 0, 1);
      camera.position.set(...defaultCameraPosition);
      camera.updateProjectionMatrix();
    }, [camera, defaultCameraPosition]);

    // Auto-zoom when transitioning to/from expanded mode
    // Only recalculates zoom on expand/collapse transitions, not on every size change
    // This preserves manual zoom adjustments from OrbitControls
    useEffect(() => {
      if (!camera || !(camera instanceof OrthographicCamera)) return;

      const wasExpanded = prevExpandedRef.current;
      const justExpanded = wasExpanded === false && isExpanded;
      const justCollapsed = wasExpanded === true && !isExpanded;

      if (justExpanded) {
        // Scale zoom proportionally with canvas size
        // Baseline: zoom=30 for 280px canvas
        const baseCanvasSize = 280;
        const scaleFactor = Math.min(size.width, size.height) / baseCanvasSize;
        // eslint-disable-next-line react-hooks/immutability -- Three.js requires direct mutation of camera properties
        camera.zoom = 30 * scaleFactor;
        camera.updateProjectionMatrix();
      } else if (justCollapsed) {
         
        camera.zoom = 30;
        camera.updateProjectionMatrix();
      }

      prevExpandedRef.current = isExpanded;
    }, [isExpanded, size, camera]);

    // Track rotation in ref during interaction (no React re-renders)
    const rotationRef = useRef(0);
    // Track if user is interacting (for shadow optimization)
    const [isInteracting, setIsInteracting] = useState(false);

    // Start interaction - pause shadows for performance
    const handleStart = () => {
      setIsInteracting(true);
    };

    // Handle rotation changes - just update ref, don't trigger React re-renders
    const handleChange = () => {
      if (!controlsRef.current) return;
      rotationRef.current = controlsRef.current.getAzimuthalAngle();
    };

    // Sync rotation to Zustand and resume shadows when interaction ends
    const handleEnd = () => {
      const degrees = (rotationRef.current * 180) / Math.PI;
      setIsometricRotation(degrees);
      setIsInteracting(false);
    };

    // Expose reset function and preset setter to parent
    useImperativeHandle(ref, () => ({
      resetView: () => {
        if (!controlsRef.current || !camera) return;

        // Reset camera position to default front-right view
        camera.position.set(...defaultCameraPosition);
        controlsRef.current.target.set(centerX, centerY, centerZ);
        controlsRef.current.update();
        setIsometricRotation(0);
      },
      setPreset: (preset: CameraPreset) => {
        if (!controlsRef.current || !camera) return;

        const target = new Vector3(centerX, centerY, centerZ);
        const targetPosition = new Vector3(...cameraPresets[preset]);
        const startPosition = camera.position.clone();

        // Convert to spherical coordinates for smooth arc interpolation
        const startSpherical = new Spherical().setFromVector3(
          startPosition.clone().sub(target)
        );
        const targetSpherical = new Spherical().setFromVector3(
          targetPosition.clone().sub(target)
        );

        const duration = 500; // ms - slightly longer for smoother feel
        const startTime = Date.now();

        const animate = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);

          // Smooth ease-out cubic for natural deceleration
          const eased = 1 - Math.pow(1 - progress, 3);

          // Interpolate in spherical coordinates for smooth arc
          const currentSpherical = new Spherical(
            startSpherical.radius + (targetSpherical.radius - startSpherical.radius) * eased,
            startSpherical.phi + (targetSpherical.phi - startSpherical.phi) * eased,
            startSpherical.theta + (targetSpherical.theta - startSpherical.theta) * eased
          );

          // Convert back to Cartesian and apply
          const newPosition = new Vector3().setFromSpherical(currentSpherical).add(target);
          camera.position.copy(newPosition);
          camera.lookAt(target); // Keep camera oriented toward target during animation

          if (progress < 1) {
            requestAnimationFrame(animate);
          } else {
            // Sync controls with final camera state
            controlsRef.current?.update();
            const angle = controlsRef.current?.getAzimuthalAngle() ?? 0;
            const degrees = (angle * 180) / Math.PI;
            setIsometricRotation(degrees);
          }
        };

        animate();
      },
    }), [defaultCameraPosition, cameraPresets, camera, centerX, centerY, centerZ, setIsometricRotation]);

  return (
    <>
      {/* Orbit controls with full 3D rotation, zoom, and pan */}
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enablePan={true}
        enableZoom={true}
        target={[centerX, centerY, centerZ]}
        onStart={handleStart}
        onChange={handleChange}
        onEnd={handleEnd}
      />

      {/* Hemisphere light - sky color from above, dark ground bounce from below
          Creates natural shadowing where interiors facing down get darker */}
      <hemisphereLight
        args={['#ffffff', '#1a1a2e', 0.65]}
      />

      {/* Key light - main directional for depth and shadows */}
      <directionalLight
        position={[-4, 6, 7]}
        intensity={0.85}
        color="#fff8f0"
      />

      {/* Fill light - subtle cool light from opposite side to prevent pitch black */}
      <directionalLight
        position={[4, -4, 3]}
        intensity={0.15}
        color="#e0e8ff"
      />

      {/* Contact shadows for ground connection - paused during interaction for performance */}
      <ContactShadows
        position={[centerX, centerY, 0.01]}
        opacity={0.20}
        scale={Math.max(drawerWidth, drawerDepth) * 1.2}
        blur={3.5}
        far={drawerHeight * 7/42}
        resolution={128}
        color="#000000"
        frames={isInteracting ? 0 : Infinity}
      />

      {/* Floor grid, axis labels, and front label */}
      <FloorGrid width={drawerWidth} depth={drawerDepth} />
      <AxisLabels width={drawerWidth} depth={drawerDepth} />
      <FrontLabel drawerWidth={drawerWidth} label={layoutName} />

      {/* Architectural dimension lines and scale indicator */}
      <DrawerDimensions
        width={drawerWidth}
        depth={drawerDepth}
        height={drawerHeight}
        gridUnitMm={gridUnitMm}
      />
      <ScaleIndicator gridUnitMm={gridUnitMm} drawerDepth={drawerDepth} />

      {/* Bins */}
      {children}
    </>
  );
});
