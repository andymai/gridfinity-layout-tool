/**
 * Three.js 3D preview canvas for the standalone baseplate page.
 *
 * Renders the generated baseplate mesh with lighting, gradient background,
 * footprint grid, axis labels, dimension annotations, and orbit controls.
 *
 * Pockets are always centered at origin (aligned with the FootprintGrid).
 * The slab extends asymmetrically when padding differs per side.
 */

import { useRef, useEffect, useMemo, useCallback, useState } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import { useShallow } from 'zustand/react/shallow';
import { Vector3, Spherical } from 'three';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsType } from 'three-stdlib';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';
import { FootprintGrid } from '@/shared/components/preview/FootprintGrid';
import { BinAxisLabels } from '@/shared/components/preview/BinAxisLabels';
import { GradientBackground } from '@/shared/components/preview/GradientBackground';
import { Spinner } from '@/shared/components/preview/Spinner';
import { useBaseplatePageStore } from '../../store/baseplatePageStore';
import { SplitBaseplateMeshes } from './SplitBaseplateMeshes';
import { GhostPaddingOutline } from './GhostPaddingOutline';
import { useMeshGeometry } from './useMeshGeometry';
import { useResponsive } from '@/shared/hooks/useResponsive';
import { useThreeColors } from '@/hooks/useThemeEffect';
import { useTranslation } from '@/i18n';
import type { SplitViewMode } from '../../store/baseplatePageStore';

// ─── Camera Constants ────────────────────────────────────────────────────────

type CameraPreset = 'front' | 'side' | 'top' | 'isometric';

/** Camera positions for each preset (eye position looking toward center) */
const CAMERA_PRESETS: Record<CameraPreset, [number, number, number]> = {
  front: [0, -1, 0.3],
  side: [1, 0, 0.3],
  top: [0, -0.01, 1],
  isometric: [0.6, -0.6, 0.5],
};

/** Animation duration for camera preset transitions (ms) */
const TRANSITION_DURATION = 500;

/** Margin factor: how much of the viewport the baseplate should fill */
const FRAME_FILL = 0.65;

/**
 * Calculate ideal camera distance to frame the baseplate including padding.
 */
function calculateIdealDistance(
  width: number,
  depth: number,
  gridUnitMm: number,
  paddingLeft: number,
  paddingRight: number,
  paddingFront: number,
  paddingBack: number,
  fov: number
): number {
  const outerW = width * gridUnitMm + paddingLeft + paddingRight;
  const outerD = depth * gridUnitMm + paddingFront + paddingBack;
  const totalH = GRIDFINITY_SPEC.SOCKET_HEIGHT;

  const halfW = outerW / 2;
  const halfD = outerD / 2;
  const halfH = totalH / 2;
  const boundingRadius = Math.sqrt(halfW * halfW + halfD * halfD + halfH * halfH);

  const halfFovRad = (fov / 2) * (Math.PI / 180);
  return (boundingRadius / Math.sin(halfFovRad)) * (1 / FRAME_FILL);
}

// ─── Dimension Labels ───────────────────────────────────────────────────────

const DIM_FONT_SIZE = 4;
const DIM_OPACITY = 0.5;
const DIM_OFFSET = 8; // mm from slab edge to label
const DIM_LINE_OPACITY = 0.25;
const DIM_TICK_SIZE = 3;

/**
 * Width and depth dimension annotations along the baseplate edges.
 * Shows total mm including padding with leader lines and tick marks.
 */
function DimensionLabels({
  width,
  depth,
  gridUnitMm,
  paddingLeft,
  paddingRight,
  paddingFront,
  paddingBack,
}: {
  width: number;
  depth: number;
  gridUnitMm: number;
  paddingLeft: number;
  paddingRight: number;
  paddingFront: number;
  paddingBack: number;
}) {
  const colors = useThreeColors();
  const GS = gridUnitMm;

  const gridW = width * GS;
  const gridD = depth * GS;
  const totalW = gridW + paddingLeft + paddingRight;
  const totalD = gridD + paddingFront + paddingBack;

  // Slab edges (pockets centered at origin, slab offset by padding asymmetry)
  const slabLeft = -gridW / 2 - paddingLeft;
  const slabRight = gridW / 2 + paddingRight;
  const slabFront = -gridD / 2 - paddingFront;
  const slabBack = gridD / 2 + paddingBack;

  const widthY = slabFront - DIM_OFFSET;
  const depthX = slabLeft - DIM_OFFSET;

  // Build leader line geometry: horizontal line + end ticks for width,
  // vertical line + end ticks for depth
  const lineGeometry = useMemo(() => {
    const positions: number[] = [];
    const z = 0.5;

    // Width leader line (along front edge)
    positions.push(slabLeft, widthY, z, slabRight, widthY, z);
    // Width end ticks
    positions.push(slabLeft, widthY - DIM_TICK_SIZE, z, slabLeft, widthY + DIM_TICK_SIZE, z);
    positions.push(slabRight, widthY - DIM_TICK_SIZE, z, slabRight, widthY + DIM_TICK_SIZE, z);

    // Depth leader line (along left edge)
    positions.push(depthX, slabFront, z, depthX, slabBack, z);
    // Depth end ticks
    positions.push(depthX - DIM_TICK_SIZE, slabFront, z, depthX + DIM_TICK_SIZE, slabFront, z);
    positions.push(depthX - DIM_TICK_SIZE, slabBack, z, depthX + DIM_TICK_SIZE, slabBack, z);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geo;
  }, [slabLeft, slabRight, slabFront, slabBack, widthY, depthX]);

  useEffect(() => {
    return () => {
      lineGeometry.dispose();
    };
  }, [lineGeometry]);

  return (
    <group>
      {/* Leader lines */}
      <lineSegments geometry={lineGeometry}>
        <lineBasicMaterial color={colors.labelColor} transparent opacity={DIM_LINE_OPACITY} />
      </lineSegments>

      {/* Width label */}
      <Text
        position={[(slabLeft + slabRight) / 2, widthY - DIM_FONT_SIZE, 0.5]}
        fontSize={DIM_FONT_SIZE}
        color={colors.labelColor}
        fillOpacity={DIM_OPACITY}
        anchorX="center"
        anchorY="top"
      >
        {`${Math.round(totalW)}mm`}
      </Text>

      {/* Depth label */}
      <Text
        position={[depthX - DIM_FONT_SIZE, (slabFront + slabBack) / 2, 0.5]}
        fontSize={DIM_FONT_SIZE}
        color={colors.labelColor}
        fillOpacity={DIM_OPACITY}
        anchorX="right"
        anchorY="middle"
      >
        {`${Math.round(totalD)}mm`}
      </Text>
    </group>
  );
}

// ─── Mesh Rendering ─────────────────────────────────────────────────────────

/**
 * Renders the baseplate mesh from the page store.
 * Mesh is positioned at origin -- pockets align with the FootprintGrid.
 */
function BaseplateMesh({ color }: { color: string }) {
  const { invalidate } = useThree();
  const meshArrays = useBaseplatePageStore(
    useShallow((s) => ({
      vertices: s.generation.mesh?.vertices ?? null,
      normals: s.generation.mesh?.normals ?? null,
      indices: s.generation.mesh?.indices ?? null,
      edgeVertices: s.generation.mesh?.edgeVertices ?? null,
    }))
  );

  const { geometry, edgesGeometry, hasPrecomputedNormals } = useMeshGeometry(meshArrays);

  useEffect(() => {
    invalidate();
  }, [geometry, color, invalidate]);

  if (!geometry) return null;

  return (
    <>
      <mesh geometry={geometry} position={[0, 0, 0.1]}>
        <meshStandardMaterial
          color={color}
          roughness={0.45}
          metalness={0}
          side={THREE.DoubleSide}
          emissive={color}
          emissiveIntensity={0.08}
          flatShading={!hasPrecomputedNormals}
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
      </mesh>
      {edgesGeometry && (
        <lineSegments geometry={edgesGeometry} position={[0, 0, 0.1]} renderOrder={1}>
          <lineBasicMaterial color="#000000" />
        </lineSegments>
      )}
    </>
  );
}

/** Theme-aware lighting (must be inside Canvas). */
function SceneLighting() {
  const colors = useThreeColors();
  return (
    <>
      <hemisphereLight args={['#ffffff', colors.groundBounce, 0.65]} />
      <directionalLight position={[-50, 60, 80]} intensity={0.85} color="#fff8f0" />
      <directionalLight position={[40, -40, 30]} intensity={0.15} color="#e0e8ff" />
    </>
  );
}

/**
 * Camera controller that frames the baseplate on mount.
 * Also exposes invalidate to hooks outside Canvas context via invalidateRef.
 */
function CameraController({
  controlsRef,
  invalidateRef,
  width,
  depth,
  gridUnitMm,
  paddingLeft,
  paddingRight,
  paddingFront,
  paddingBack,
  onOrbitStart,
}: {
  controlsRef: React.RefObject<OrbitControlsType | null>;
  invalidateRef: React.RefObject<(() => void) | null>;
  width: number;
  depth: number;
  gridUnitMm: number;
  paddingLeft: number;
  paddingRight: number;
  paddingFront: number;
  paddingBack: number;
  onOrbitStart?: () => void;
}) {
  const { camera, invalidate } = useThree();
  const initializedRef = useRef(false);

  // Expose invalidate to hooks outside Canvas context
  useEffect(() => {
    invalidateRef.current = invalidate;
  }, [invalidate, invalidateRef]);

  // Wire up orbit start callback
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls || !onOrbitStart) return;
    controls.addEventListener('start', onOrbitStart);
    return () => {
      controls.removeEventListener('start', onOrbitStart);
    };
  }, [controlsRef, onOrbitStart]);

  const fov = 45;
  const totalH = GRIDFINITY_SPEC.SOCKET_HEIGHT;
  const binCenter = useMemo(() => new Vector3(0, 0, totalH / 2), [totalH]);
  const idealDistance = useMemo(
    () =>
      calculateIdealDistance(
        width,
        depth,
        gridUnitMm,
        paddingLeft,
        paddingRight,
        paddingFront,
        paddingBack,
        fov
      ),
    [width, depth, gridUnitMm, paddingLeft, paddingRight, paddingFront, paddingBack]
  );

  const animRef = useRef<{
    startPos: Vector3;
    targetPos: Vector3;
    startTime: number;
    duration: number;
  } | null>(null);
  const prevDistanceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!initializedRef.current) {
      const direction = new Vector3(0.6, -0.6, 0.5).normalize();
      camera.position.copy(direction.multiplyScalar(idealDistance).add(binCenter));
      camera.up.set(0, 0, 1);
      camera.lookAt(binCenter);
      if (controlsRef.current) {
        controlsRef.current.target.copy(binCenter);
        controlsRef.current.update();
      }
      prevDistanceRef.current = idealDistance;
      initializedRef.current = true;
      return;
    }

    const prevDistance = prevDistanceRef.current ?? idealDistance;
    const distanceChange = Math.abs(idealDistance - prevDistance) / prevDistance;

    if (distanceChange > 0.1) {
      const currentPos = camera.position.clone();
      const currentDir = currentPos.clone().sub(binCenter).normalize();
      const targetPos = currentDir.multiplyScalar(idealDistance).add(binCenter);

      animRef.current = {
        startPos: currentPos,
        targetPos,
        startTime: performance.now(),
        duration: 300,
      };
    }

    prevDistanceRef.current = idealDistance;
  }, [idealDistance, binCenter, camera, controlsRef]);

  useEffect(() => {
    if (controlsRef.current && initializedRef.current) {
      controlsRef.current.target.copy(binCenter);
      controlsRef.current.update();
    }
  }, [binCenter, controlsRef]);

  useFrame(() => {
    const anim = animRef.current;
    if (!anim) return;

    const elapsed = performance.now() - anim.startTime;
    const progress = Math.min(elapsed / anim.duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);

    camera.position.lerpVectors(anim.startPos, anim.targetPos, eased);
    camera.lookAt(binCenter);
    invalidate();

    if (progress >= 1) {
      animRef.current = null;
      controlsRef.current?.update();
    }
  });

  return null;
}

// ─── Camera Preset Transition Hook ──────────────────────────────────────────

/**
 * Manages smooth camera preset transitions using spherical coordinate interpolation.
 * Adapted from the bin designer's usePresetTransition — uses baseplate's
 * calculateIdealDistance (with padding params) and fixed SOCKET_HEIGHT center.
 */
function useBaseplatePresetTransition(
  controlsRef: React.RefObject<OrbitControlsType | null>,
  invalidateRef: React.RefObject<(() => void) | null>,
  width: number,
  depth: number,
  gridUnitMm: number,
  paddingLeft: number,
  paddingRight: number,
  paddingFront: number,
  paddingBack: number
) {
  const animFrameRef = useRef<number | null>(null);

  const setCameraPreset = useCallback(
    (preset: CameraPreset) => {
      const controls = controlsRef.current;
      if (!controls) return;

      const camera = controls.object;
      const fov = 45;
      const totalH = GRIDFINITY_SPEC.SOCKET_HEIGHT;
      const binCenter = new Vector3(0, 0, totalH / 2);
      const idealDistance = calculateIdealDistance(
        width,
        depth,
        gridUnitMm,
        paddingLeft,
        paddingRight,
        paddingFront,
        paddingBack,
        fov
      );

      const direction = new Vector3(...CAMERA_PRESETS[preset]).normalize();
      const targetPosition = direction.multiplyScalar(idealDistance).add(binCenter);

      const startPosition = camera.position.clone();
      const target = binCenter.clone();

      // Convert to spherical for smooth arc interpolation
      const startSpherical = new Spherical().setFromVector3(startPosition.clone().sub(target));
      const targetSpherical = new Spherical().setFromVector3(targetPosition.clone().sub(target));

      const startTime = performance.now();

      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }

      const animate = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / TRANSITION_DURATION, 1);
        const eased = 1 - Math.pow(1 - progress, 3);

        const currentSpherical = new Spherical(
          startSpherical.radius + (targetSpherical.radius - startSpherical.radius) * eased,
          startSpherical.phi + (targetSpherical.phi - startSpherical.phi) * eased,
          startSpherical.theta + (targetSpherical.theta - startSpherical.theta) * eased
        );

        const newPosition = new Vector3().setFromSpherical(currentSpherical).add(target);
        camera.position.copy(newPosition);
        camera.up.set(0, 0, 1);
        camera.lookAt(target);
        controls.target.copy(target);
        controls.update();
        invalidateRef.current?.();

        if (progress < 1) {
          animFrameRef.current = requestAnimationFrame(animate);
        } else {
          animFrameRef.current = null;
        }
      };

      animate();
    },
    [
      controlsRef,
      invalidateRef,
      width,
      depth,
      gridUnitMm,
      paddingLeft,
      paddingRight,
      paddingFront,
      paddingBack,
    ]
  );

  useEffect(() => {
    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  return setCameraPreset;
}

// ─── Preview Controls Overlay ───────────────────────────────────────────────

/** SVG icon for Assembled — 2×2 grid of squares packed tight */
function IconAssembled() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="4.5" height="4.5" rx="0.8" fill="currentColor" opacity="0.6" />
      <rect x="8.5" y="3" width="4.5" height="4.5" rx="0.8" fill="currentColor" opacity="0.6" />
      <rect x="3" y="8.5" width="4.5" height="4.5" rx="0.8" fill="currentColor" opacity="0.6" />
      <rect x="8.5" y="8.5" width="4.5" height="4.5" rx="0.8" fill="currentColor" opacity="0.6" />
    </svg>
  );
}

/** SVG icon for Exploded — 2×2 grid of squares spread to corners */
function IconExploded() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="4.5" height="4.5" rx="0.8" fill="currentColor" opacity="0.6" />
      <rect x="10.5" y="1" width="4.5" height="4.5" rx="0.8" fill="currentColor" opacity="0.6" />
      <rect x="1" y="10.5" width="4.5" height="4.5" rx="0.8" fill="currentColor" opacity="0.6" />
      <rect x="10.5" y="10.5" width="4.5" height="4.5" rx="0.8" fill="currentColor" opacity="0.6" />
    </svg>
  );
}

const VIEW_MODE_ICONS: Record<SplitViewMode, () => React.ReactNode> = {
  assembled: IconAssembled,
  exploded: IconExploded,
};

/** SVG icon for Front preset — cube with front face highlighted */
function IconFront() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 5l6-3 6 3v6l-6 3-6-3V5z" stroke="currentColor" strokeWidth="1.2" opacity="0.4" />
      <path d="M2 5l6 3v6l-6-3V5z" fill="currentColor" opacity="0.6" />
      <path d="M2 5l6 3v6l-6-3V5z" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

/** SVG icon for Side preset — cube with side face highlighted */
function IconSide() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 5l6-3 6 3v6l-6 3-6-3V5z" stroke="currentColor" strokeWidth="1.2" opacity="0.4" />
      <path d="M14 5l-6 3v6l6-3V5z" fill="currentColor" opacity="0.6" />
      <path d="M14 5l-6 3v6l6-3V5z" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

/** SVG icon for Top preset — cube with top face highlighted */
function IconTop() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 5l6-3 6 3v6l-6 3-6-3V5z" stroke="currentColor" strokeWidth="1.2" opacity="0.4" />
      <path d="M2 5l6-3 6 3-6 3-6-3z" fill="currentColor" opacity="0.6" />
      <path d="M2 5l6-3 6 3-6 3-6-3z" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

/** SVG icon for Isometric preset — cube corner perspective */
function IconIso() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M2 5l6-3 6 3v6l-6 3-6-3V5z"
        fill="currentColor"
        opacity="0.15"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path d="M8 8v6M2 5l6 3M14 5l-6 3" stroke="currentColor" strokeWidth="1" opacity="0.5" />
    </svg>
  );
}

/** SVG icon for Reset — circular arrow */
function IconReset() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3.5 2.5v3.5H7"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3.5 6C4.5 3.5 6.8 2 9 2c3 0 5 2.5 5 5.5S12 13 9 13c-2 0-3.7-1-4.5-2.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

const PRESET_ICONS: Record<CameraPreset, () => React.ReactNode> = {
  front: IconFront,
  side: IconSide,
  top: IconTop,
  isometric: IconIso,
};

const PRESETS: Array<{ key: CameraPreset; labelKey: string }> = [
  { key: 'front', labelKey: 'baseplate.frontView' },
  { key: 'side', labelKey: 'baseplate.sideView' },
  { key: 'top', labelKey: 'baseplate.topView' },
  { key: 'isometric', labelKey: 'baseplate.isoView' },
];

/** Floating toolbar overlay for camera presets and assembled/exploded toggle. */
function BaseplatePreviewControls({
  activePreset,
  isSplit,
  splitViewMode,
  onCameraPreset,
  onResetView,
  onViewModeChange,
}: {
  activePreset: CameraPreset | null;
  isSplit: boolean;
  splitViewMode: SplitViewMode;
  onCameraPreset: (preset: CameraPreset) => void;
  onResetView: () => void;
  onViewModeChange: (mode: SplitViewMode) => void;
}) {
  const t = useTranslation();
  const { isDesktop } = useResponsive();

  const viewModes: Array<{ value: SplitViewMode; labelKey: string }> = [
    { value: 'assembled', labelKey: 'baseplate.viewAssembled' },
    { value: 'exploded', labelKey: 'baseplate.viewExploded' },
  ];

  if (isDesktop) {
    return (
      <div className="absolute right-2 top-2 hidden md:flex items-center gap-2">
        {/* Assembled / Exploded toggle — separate pill (only when split) */}
        {isSplit && (
          <div className="flex items-center rounded-lg bg-surface-elevated/80 shadow-sm backdrop-blur overflow-hidden">
            {viewModes.map(({ value, labelKey }) => {
              const Icon = VIEW_MODE_ICONS[value];
              const isActive = splitViewMode === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => onViewModeChange(value)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset focus-visible:outline-none min-h-[28px] touch-manipulation ${
                    isActive
                      ? 'bg-accent text-on-accent'
                      : 'text-content-secondary hover:bg-surface-hover hover:text-content'
                  }`}
                  aria-pressed={isActive}
                >
                  <Icon />
                  <span>{t(labelKey)}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Camera presets + reset — separate pill */}
        <div className="flex items-center rounded-lg bg-surface-elevated/80 shadow-sm backdrop-blur overflow-hidden">
          {PRESETS.map(({ key, labelKey }) => {
            const Icon = PRESET_ICONS[key];
            const isActive = activePreset === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onCameraPreset(key)}
                className={`flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset focus-visible:outline-none min-h-[28px] touch-manipulation ${
                  isActive
                    ? 'bg-accent text-on-accent'
                    : 'text-content-secondary hover:bg-surface-hover hover:text-content'
                }`}
                title={t(labelKey)}
                aria-label={t(labelKey)}
                aria-pressed={isActive}
              >
                <Icon />
                <span>{t(labelKey)}</span>
              </button>
            );
          })}

          {/* Divider */}
          <div className="w-px h-5 bg-stroke-subtle/50" />

          {/* Reset button */}
          <button
            type="button"
            onClick={onResetView}
            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-content-secondary transition-colors hover:bg-surface-hover hover:text-content focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset focus-visible:outline-none min-h-[28px] touch-manipulation"
            title={t('baseplate.resetView')}
            aria-label={t('baseplate.resetView')}
          >
            <IconReset />
            <span>{t('common.reset')}</span>
          </button>
        </div>
      </div>
    );
  }

  // Mobile: two separate rows when split, single row otherwise
  return (
    <div className="absolute inset-x-2 top-2 z-30 md:hidden flex flex-wrap gap-2">
      {/* Assembled / Exploded toggle — separate pill (only when split) */}
      {isSplit && (
        <div className="flex items-center rounded-lg bg-surface-elevated/80 shadow-sm backdrop-blur overflow-hidden">
          {viewModes.map(({ value, labelKey }) => {
            const Icon = VIEW_MODE_ICONS[value];
            const isActive = splitViewMode === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => onViewModeChange(value)}
                className={`flex items-center justify-center gap-1 px-3 min-h-[44px] text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset focus-visible:outline-none touch-manipulation ${
                  isActive
                    ? 'bg-accent text-on-accent'
                    : 'text-content-secondary hover:bg-surface-hover hover:text-content'
                }`}
                aria-pressed={isActive}
              >
                <Icon />
                <span>{t(labelKey)}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Camera presets + reset — separate pill */}
      <div className="flex items-center rounded-lg bg-surface-elevated/80 shadow-sm backdrop-blur overflow-hidden">
        {PRESETS.map(({ key, labelKey }) => {
          const Icon = PRESET_ICONS[key];
          const isActive = activePreset === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onCameraPreset(key)}
              className={`flex items-center justify-center min-w-[44px] min-h-[44px] p-2 transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset focus-visible:outline-none touch-manipulation ${
                isActive
                  ? 'bg-accent text-on-accent'
                  : 'text-content-secondary hover:bg-surface-hover hover:text-content'
              }`}
              title={t(labelKey)}
              aria-label={t(labelKey)}
              aria-pressed={isActive}
            >
              <Icon />
            </button>
          );
        })}

        {/* Divider */}
        <div className="w-px h-5 bg-stroke-subtle/50" />

        {/* Reset */}
        <button
          type="button"
          onClick={onResetView}
          className="flex items-center justify-center min-w-[44px] min-h-[44px] p-2 text-content-secondary transition-colors hover:bg-surface-hover hover:text-content focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset focus-visible:outline-none touch-manipulation"
          title={t('baseplate.resetView')}
          aria-label={t('baseplate.resetView')}
        >
          <IconReset />
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

interface BaseplatePreviewProps {
  width: number;
  depth: number;
  gridUnitMm: number;
  paddingLeft: number;
  paddingRight: number;
  paddingFront: number;
  paddingBack: number;
}

const DEFAULT_COLOR = '#d4d8dc';

export function BaseplatePreview({
  width,
  depth,
  gridUnitMm,
  paddingLeft,
  paddingRight,
  paddingFront,
  paddingBack,
}: BaseplatePreviewProps) {
  const t = useTranslation();
  const controlsRef = useRef<OrbitControlsType>(null);
  const invalidateRef = useRef<(() => void) | null>(null);
  const { isDesktop } = useResponsive();

  const {
    wasmStatus,
    hasMesh,
    hasSplitMeshes,
    isSplit,
    splitViewMode,
    generationStatus,
    splitProgress,
  } = useBaseplatePageStore(
    useShallow((s) => ({
      wasmStatus: s.wasmStatus,
      hasMesh: s.generation.mesh !== null && s.generation.mesh.vertices !== null,
      hasSplitMeshes: s.pieceMeshes.length > 0,
      isSplit: s.tiling?.isSplit ?? false,
      splitViewMode: s.splitViewMode,
      generationStatus: s.generation.status,
      splitProgress: s.splitProgress,
    }))
  );

  const setSplitViewMode = useBaseplatePageStore((s) => s.setSplitViewMode);
  const setSelectedPieceLabel = useBaseplatePageStore((s) => s.setSelectedPieceLabel);
  const handlePointerMissed = useCallback(() => {
    setSelectedPieceLabel(null);
  }, [setSelectedPieceLabel]);

  // Camera preset state
  const [activePreset, setActivePreset] = useState<CameraPreset | null>(null);

  const setCameraPreset = useBaseplatePresetTransition(
    controlsRef,
    invalidateRef,
    width,
    depth,
    gridUnitMm,
    paddingLeft,
    paddingRight,
    paddingFront,
    paddingBack
  );

  const handleCameraPreset = useCallback(
    (preset: CameraPreset) => {
      setActivePreset(preset);
      setCameraPreset(preset);
    },
    [setCameraPreset]
  );

  const handleResetView = useCallback(() => {
    setActivePreset('isometric');
    setCameraPreset('isometric');
  }, [setCameraPreset]);

  const handleOrbitStart = useCallback(() => {
    setActivePreset(null);
  }, []);

  const totalH = GRIDFINITY_SPEC.SOCKET_HEIGHT;
  const hasAnyMesh = isSplit ? hasSplitMeshes : hasMesh;
  const hasError = wasmStatus === 'error' || generationStatus === 'error';
  const isInitialLoading = !hasError && (!hasAnyMesh || wasmStatus !== 'ready');
  const showOverlay = isInitialLoading || (generationStatus === 'generating' && hasAnyMesh);

  return (
    <div
      className="relative h-full w-full touch-manipulation"
      role="img"
      aria-label={t('baseplate.title')}
    >
      <Canvas
        frameloop="demand"
        camera={{
          position: new Vector3(100, -100, 80),
          fov: 45,
          near: 0.1,
          far: 2000,
        }}
        onCreated={({ camera }) => {
          camera.up.set(0, 0, 1);
          camera.lookAt(0, 0, totalH / 2);
        }}
        gl={{ antialias: true }}
        onPointerMissed={handlePointerMissed}
      >
        <GradientBackground />
        <SceneLighting />

        <CameraController
          controlsRef={controlsRef}
          invalidateRef={invalidateRef}
          width={width}
          depth={depth}
          gridUnitMm={gridUnitMm}
          paddingLeft={paddingLeft}
          paddingRight={paddingRight}
          paddingFront={paddingFront}
          paddingBack={paddingBack}
          onOrbitStart={handleOrbitStart}
        />

        {isSplit ? (
          <SplitBaseplateMeshes
            totalWidthUnits={width}
            totalDepthUnits={depth}
            gridUnitMm={gridUnitMm}
          />
        ) : (
          <BaseplateMesh color={DEFAULT_COLOR} />
        )}

        {/* Ghost outline only in assembled mode — exploded scatters pieces beyond slab bounds */}
        {splitViewMode !== 'exploded' && (
          <GhostPaddingOutline
            width={width}
            depth={depth}
            gridUnitMm={gridUnitMm}
            paddingLeft={paddingLeft}
            paddingRight={paddingRight}
            paddingFront={paddingFront}
            paddingBack={paddingBack}
            isGenerating={generationStatus === 'generating'}
          />
        )}

        <FootprintGrid width={width} depth={depth} gridUnitMm={gridUnitMm} />
        {/* Hide measurement labels in exploded mode — pieces scatter beyond these positions */}
        {splitViewMode !== 'exploded' && (
          <>
            <BinAxisLabels width={width} depth={depth} gridUnitMm={gridUnitMm} />
            <DimensionLabels
              width={width}
              depth={depth}
              gridUnitMm={gridUnitMm}
              paddingLeft={paddingLeft}
              paddingRight={paddingRight}
              paddingFront={paddingFront}
              paddingBack={paddingBack}
            />
          </>
        )}

        <OrbitControls
          ref={controlsRef}
          makeDefault
          target={[0, 0, totalH / 2]}
          enableDamping
          dampingFactor={0.12}
          rotateSpeed={0.8}
          minDistance={20}
          maxDistance={800}
          maxPolarAngle={Math.PI * 0.85}
          minPolarAngle={Math.PI * 0.05}
          enablePan={isDesktop}
        />
      </Canvas>

      {/* Camera controls + view toggle overlay */}
      <BaseplatePreviewControls
        activePreset={activePreset}
        isSplit={isSplit}
        splitViewMode={splitViewMode}
        onCameraPreset={handleCameraPreset}
        onResetView={handleResetView}
        onViewModeChange={setSplitViewMode}
      />

      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center" role="alert">
          <div className="mx-4 max-w-sm rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-center shadow-lg dark:border-red-800 dark:bg-red-950">
            <p className="text-sm font-medium text-red-800 dark:text-red-200">
              {wasmStatus === 'error'
                ? t('baseplate.wasmLoadFailed')
                : t('baseplate.generationFailed')}
            </p>
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              {t('baseplate.errorRetryHint')}
            </p>
          </div>
        </div>
      )}

      {showOverlay && (
        <div
          className="absolute inset-x-0 bottom-4 flex justify-center"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-2.5 rounded-lg border border-stroke-subtle bg-surface-elevated/95 px-4 py-2 font-mono text-xs shadow-lg backdrop-blur-sm">
            <Spinner className="h-4 w-4 shrink-0 text-accent motion-reduce:animate-none" />
            <span className="text-content-secondary">
              {splitProgress && !isInitialLoading
                ? t('baseplate.generatingSplit', {
                    current: splitProgress.current,
                    total: splitProgress.total,
                  })
                : t('baseplate.generating')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
