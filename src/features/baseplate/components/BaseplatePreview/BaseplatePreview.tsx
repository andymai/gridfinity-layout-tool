/**
 * Three.js 3D preview canvas for the standalone baseplate page.
 *
 * Renders the generated baseplate mesh with lighting, gradient background,
 * footprint grid, axis labels, dimension annotations, and orbit controls.
 *
 * Pockets are always centered at origin (aligned with the FootprintGrid).
 * The slab extends asymmetrically when padding differs per side.
 */

import { useRef, useEffect, useMemo, useCallback } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import { useShallow } from 'zustand/react/shallow';
import { Vector3 } from 'three';
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
import { useResponsive } from '@/shared/hooks/useResponsive';
import { useThreeColors } from '@/hooks/useThemeEffect';
import { useTranslation } from '@/i18n';

/** Margin factor: how much of the viewport the baseplate should fill */
const FRAME_FILL = 0.65;

/**
 * Calculate ideal camera distance to frame the baseplate including padding.
 */
function calculateIdealDistance(
  width: number,
  depth: number,
  paddingLeft: number,
  paddingRight: number,
  paddingFront: number,
  paddingBack: number,
  fov: number
): number {
  const outerW = width * GRIDFINITY_SPEC.GRID_SIZE + paddingLeft + paddingRight;
  const outerD = depth * GRIDFINITY_SPEC.GRID_SIZE + paddingFront + paddingBack;
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
  paddingLeft,
  paddingRight,
  paddingFront,
  paddingBack,
}: {
  width: number;
  depth: number;
  paddingLeft: number;
  paddingRight: number;
  paddingFront: number;
  paddingBack: number;
}) {
  const colors = useThreeColors();
  const GS = GRIDFINITY_SPEC.GRID_SIZE;

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
 * Mesh is positioned at origin — pockets align with the FootprintGrid.
 */
function BaseplateMesh({ color }: { color: string }) {
  const { invalidate } = useThree();
  const { vertices, normals, indices, edgeVertices } = useBaseplatePageStore(
    useShallow((s) => ({
      vertices: s.generation.mesh?.vertices ?? null,
      normals: s.generation.mesh?.normals ?? null,
      indices: s.generation.mesh?.indices ?? null,
      edgeVertices: s.generation.mesh?.edgeVertices ?? null,
    }))
  );

  const hasPrecomputedNormals = normals !== null && normals.length > 0;

  const geometry = useMemo(() => {
    if (!vertices || vertices.length === 0) return null;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

    if (indices && indices.length > 0) {
      geo.setIndex(new THREE.BufferAttribute(indices, 1));
    }

    if (hasPrecomputedNormals) {
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    } else {
      geo.computeVertexNormals();
    }

    return geo;
  }, [vertices, normals, indices, hasPrecomputedNormals]);

  const edgesGeometry = useMemo(() => {
    if (!edgeVertices || edgeVertices.length === 0) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(edgeVertices, 3));
    return geo;
  }, [edgeVertices]);

  useEffect(() => {
    return () => {
      geometry?.dispose();
      edgesGeometry?.dispose();
    };
  }, [geometry, edgesGeometry]);

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
 */
function CameraController({
  controlsRef,
  width,
  depth,
  paddingLeft,
  paddingRight,
  paddingFront,
  paddingBack,
}: {
  controlsRef: React.RefObject<OrbitControlsType | null>;
  width: number;
  depth: number;
  paddingLeft: number;
  paddingRight: number;
  paddingFront: number;
  paddingBack: number;
}) {
  const { camera, invalidate } = useThree();
  const initializedRef = useRef(false);

  const fov = 45;
  const totalH = GRIDFINITY_SPEC.SOCKET_HEIGHT;
  const binCenter = useMemo(() => new Vector3(0, 0, totalH / 2), [totalH]);
  const idealDistance = useMemo(
    () =>
      calculateIdealDistance(
        width,
        depth,
        paddingLeft,
        paddingRight,
        paddingFront,
        paddingBack,
        fov
      ),
    [width, depth, paddingLeft, paddingRight, paddingFront, paddingBack]
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

// ─── Main Component ─────────────────────────────────────────────────────────

interface BaseplatePreviewProps {
  width: number;
  depth: number;
  paddingLeft: number;
  paddingRight: number;
  paddingFront: number;
  paddingBack: number;
}

const DEFAULT_COLOR = '#d4d8dc';

export function BaseplatePreview({
  width,
  depth,
  paddingLeft,
  paddingRight,
  paddingFront,
  paddingBack,
}: BaseplatePreviewProps) {
  const t = useTranslation();
  const controlsRef = useRef<OrbitControlsType>(null);
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

  const setSelectedPieceLabel = useBaseplatePageStore((s) => s.setSelectedPieceLabel);
  const handlePointerMissed = useCallback(() => {
    setSelectedPieceLabel(null);
  }, [setSelectedPieceLabel]);

  const totalH = GRIDFINITY_SPEC.SOCKET_HEIGHT;
  const hasAnyMesh = isSplit ? hasSplitMeshes : hasMesh;
  const isInitialLoading = !hasAnyMesh || wasmStatus !== 'ready';
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
          width={width}
          depth={depth}
          paddingLeft={paddingLeft}
          paddingRight={paddingRight}
          paddingFront={paddingFront}
          paddingBack={paddingBack}
        />

        {isSplit ? (
          <SplitBaseplateMeshes totalWidthUnits={width} totalDepthUnits={depth} />
        ) : (
          <BaseplateMesh color={DEFAULT_COLOR} />
        )}

        {/* Ghost outline only in assembled mode — exploded scatters pieces beyond slab bounds */}
        {splitViewMode !== 'exploded' && (
          <GhostPaddingOutline
            width={width}
            depth={depth}
            paddingLeft={paddingLeft}
            paddingRight={paddingRight}
            paddingFront={paddingFront}
            paddingBack={paddingBack}
            isGenerating={generationStatus === 'generating'}
          />
        )}

        <FootprintGrid width={width} depth={depth} />
        {/* Hide measurement labels in exploded mode — pieces scatter beyond these positions */}
        {splitViewMode !== 'exploded' && (
          <>
            <BinAxisLabels width={width} depth={depth} />
            <DimensionLabels
              width={width}
              depth={depth}
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

      {showOverlay && (
        <div
          className="absolute inset-x-0 bottom-4 flex justify-center"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-2.5 rounded-lg border border-stroke-subtle bg-surface-elevated/95 px-4 py-2 font-mono text-xs shadow-lg backdrop-blur-sm">
            <Spinner className="h-4 w-4 shrink-0 text-accent motion-reduce:animate-none" />
            <span className="text-content-secondary">
              {isInitialLoading
                ? t('baseplate.generating')
                : splitProgress
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
