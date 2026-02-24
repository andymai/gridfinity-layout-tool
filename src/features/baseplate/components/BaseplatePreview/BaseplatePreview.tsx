/**
 * Three.js 3D preview canvas for the standalone baseplate page.
 *
 * Renders the generated baseplate mesh with lighting, gradient background,
 * footprint grid, axis labels, and orbit controls. Simpler than the bin
 * designer's PreviewCanvas since baseplates have no ghost overlays or dimensions.
 *
 * When asymmetric padding is present, renders a translucent drawer footprint
 * plane beneath the baseplate to visualize the padding distribution.
 */

import { useRef, useEffect, useMemo } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useShallow } from 'zustand/react/shallow';
import { Vector3 } from 'three';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsType } from 'three-stdlib';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';
import { FootprintGrid } from '@/shared/components/preview/FootprintGrid';
import { BinAxisLabels } from '@/shared/components/preview/BinAxisLabels';
import { BinNameLabel } from '@/shared/components/preview/BinNameLabel';
import { GradientBackground } from '@/shared/components/preview/GradientBackground';
import { useBaseplatePageStore } from '../../store/baseplatePageStore';
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

/**
 * Renders the baseplate mesh from the page store.
 */
function BaseplateMesh({ color }: { color: string }) {
  const { invalidate } = useThree();
  const { vertices, normals, indices, edgeVertices, slabOffset } = useBaseplatePageStore(
    useShallow((s) => ({
      vertices: s.generation.mesh?.vertices ?? null,
      normals: s.generation.mesh?.normals ?? null,
      indices: s.generation.mesh?.indices ?? null,
      edgeVertices: s.generation.mesh?.edgeVertices ?? null,
      slabOffset: s.slabOffset,
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
    if (geometry) invalidate();
  }, [geometry, invalidate]);

  useEffect(() => {
    invalidate();
  }, [color, slabOffset, invalidate]);

  if (!geometry) return null;

  return (
    <>
      <mesh geometry={geometry} position={[slabOffset.x, slabOffset.y, 0.1]}>
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
        <lineSegments
          geometry={edgesGeometry}
          position={[slabOffset.x, slabOffset.y, 0.1]}
          renderOrder={1}
        >
          <lineBasicMaterial color="#000000" depthTest={true} />
        </lineSegments>
      )}
    </>
  );
}

/**
 * Translucent plane showing the full drawer footprint.
 * Offset so the grid remains at origin — shifted by (paddingLeft - paddingRight)/2 etc.
 */
function DrawerFootprint({
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
  const totalW = width * GRIDFINITY_SPEC.GRID_SIZE + paddingLeft + paddingRight;
  const totalD = depth * GRIDFINITY_SPEC.GRID_SIZE + paddingFront + paddingBack;
  const offsetX = (paddingLeft - paddingRight) / 2;
  const offsetY = (paddingFront - paddingBack) / 2;

  return (
    <mesh position={[offsetX, offsetY, -0.05]} rotation={[0, 0, 0]}>
      <planeGeometry args={[totalW, totalD]} />
      <meshStandardMaterial
        color="#6366f1"
        transparent
        opacity={0.12}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
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

  const { wasmStatus, hasMesh, generationStatus } = useBaseplatePageStore(
    useShallow((s) => ({
      wasmStatus: s.wasmStatus,
      hasMesh: s.generation.mesh !== null && s.generation.mesh.vertices !== null,
      generationStatus: s.generation.status,
    }))
  );

  const totalH = GRIDFINITY_SPEC.SOCKET_HEIGHT;
  const showSkeleton = !hasMesh || wasmStatus !== 'ready';
  const showOverlay = generationStatus === 'generating' && hasMesh;
  const hasPadding = paddingLeft > 0 || paddingRight > 0 || paddingFront > 0 || paddingBack > 0;

  if (showSkeleton) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-surface-elevated">
        <div className="flex flex-col items-center gap-2 text-content-secondary">
          <svg
            className="h-6 w-6 animate-spin text-accent"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle
              className="opacity-20"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
            />
            <path
              className="opacity-80"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <span className="text-xs">{t('loading.baseplate')}</span>
        </div>
      </div>
    );
  }

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

        <BaseplateMesh color={DEFAULT_COLOR} />

        {hasPadding && (
          <DrawerFootprint
            width={width}
            depth={depth}
            paddingLeft={paddingLeft}
            paddingRight={paddingRight}
            paddingFront={paddingFront}
            paddingBack={paddingBack}
          />
        )}

        <FootprintGrid width={width} depth={depth} />
        <BinAxisLabels width={width} depth={depth} />
        <BinNameLabel width={width} depth={depth} name={`${width}\u00d7${depth} Baseplate`} />

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
            <svg
              className="h-4 w-4 shrink-0 text-accent animate-spin motion-reduce:animate-none"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle
                className="opacity-20"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="3"
              />
              <path
                className="opacity-80"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span className="text-content-secondary">Generating...</span>
          </div>
        </div>
      )}
    </div>
  );
}
