import { useEffect, useRef, useImperativeHandle, forwardRef, useMemo } from 'react';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { OrthographicCamera } from 'three';
import { useUIStore } from '../../../store';
import type { OrbitControls as OrbitControlsType } from 'three-stdlib';
import { FloorGrid } from './FloorGrid';
import { FrontLabel } from './FrontLabel';
import { AxisLabels } from './AxisLabels';

interface SceneProps {
  children: React.ReactNode;
  drawerWidth: number;
  drawerDepth: number;
  drawerHeight: number;
  layoutName: string;
  isExpanded?: boolean;
}

export type CameraPreset = 'isometric' | 'top' | 'front' | 'side';

export interface SceneHandle {
  resetView: () => void;
  setPreset: (preset: CameraPreset) => void;
}

/**
 * Main scene component with camera, lights, orbit controls, and environment.
 * Handles rotation sync with UI store and renders floor grid.
 */
export const Scene = forwardRef<SceneHandle, SceneProps>(
  ({ children, drawerWidth, drawerDepth, drawerHeight, layoutName, isExpanded }, ref) => {
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
        top: [
          centerX,
          centerY,
          centerZ + distance * 1.2,
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

    // Handle rotation changes from OrbitControls
    const handleChange = () => {
      if (!controlsRef.current) return;

      // Convert radians back to degrees for UI store
      const angle = controlsRef.current.getAzimuthalAngle();
      const degrees = (angle * 180) / Math.PI;
      setIsometricRotation(degrees);
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

        const targetPosition = cameraPresets[preset];
        const startPosition = [camera.position.x, camera.position.y, camera.position.z];
        const duration = 400; // ms
        const startTime = Date.now();

        const animate = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);

          // Ease-in-out function
          const eased = progress < 0.5
            ? 2 * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;

          // Interpolate position
          camera.position.x = startPosition[0] + (targetPosition[0] - startPosition[0]) * eased;
          camera.position.y = startPosition[1] + (targetPosition[1] - startPosition[1]) * eased;
          camera.position.z = startPosition[2] + (targetPosition[2] - startPosition[2]) * eased;

          controlsRef.current?.update();

          if (progress < 1) {
            requestAnimationFrame(animate);
          } else {
            // Update rotation state when animation completes
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
        onChange={handleChange}
      />

      {/* Ambient light - brighter to preserve category colors */}
      <ambientLight intensity={0.5} />

      {/* Hemisphere light - ambient fill with sky/ground colors */}
      <hemisphereLight
        color="#4a5a6a"      // Lighter cool blue (sky)
        groundColor="#3a3530" // Lighter warm (ground)
        intensity={0.4}
      />

      {/* Directional light - main lighting direction */}
      <directionalLight
        position={[-4, 6, 7]}
        intensity={0.8}
      />

      {/* Contact shadows for ground connection */}
      <ContactShadows
        position={[centerX, centerY, 0.01]}
        opacity={0.20}
        scale={Math.max(drawerWidth, drawerDepth) * 1.2}
        blur={3.5}
        far={drawerHeight * 7/42}
        resolution={256}
        color="#000000"
      />

      {/* Floor grid, axis labels, and front label */}
      <FloorGrid width={drawerWidth} depth={drawerDepth} />
      <AxisLabels width={drawerWidth} depth={drawerDepth} />
      <FrontLabel drawerWidth={drawerWidth} label={layoutName} />

      {/* Bins */}
      {children}
    </>
  );
});
