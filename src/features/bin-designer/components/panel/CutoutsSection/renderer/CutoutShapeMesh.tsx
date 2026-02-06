/**
 * WebGL mesh renderer for a single cutout shape.
 *
 * Uses SDF ShaderMaterial on a quad (PlaneGeometry) for pixel-perfect
 * anti-aliased shapes at any zoom level. Position and rotation in world
 * coordinates (mm, Y-up).
 */

import { memo, useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import type { Cutout } from '@/features/bin-designer/types';
import { sdfVertexShader, sdfFragmentShader } from './shapeGeometry';
import { RENDER_ORDER } from './constants';

/** Accent color from CSS — approximation for WebGL context */
const ACCENT_COLOR = new THREE.Color('#6366f1');
const STROKE_SUBTLE = new THREE.Color('#555555');

interface CutoutShapeMeshProps {
  readonly cutout: Cutout;
  readonly isSelected: boolean;
  readonly isGrouped: boolean;
  readonly isDragging: boolean;
  readonly previewOverrides?: Partial<Cutout>;
  readonly onSelect: (id: string, additive: boolean) => void;
  readonly onDoubleClick?: (id: string) => void;
  readonly onDragStart?: (id: string, mmX: number, mmY: number) => void;
}

export const CutoutShapeMesh = memo(function CutoutShapeMesh({
  cutout,
  isSelected,
  isGrouped,
  isDragging,
  previewOverrides,
  onSelect,
  onDoubleClick,
  onDragStart,
}: CutoutShapeMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  // Merge preview overrides for live feedback during drag/resize
  const effective = useMemo(
    () => (previewOverrides ? { ...cutout, ...previewOverrides } : cutout),
    [cutout, previewOverrides]
  );

  const fillOpacity = isDragging ? 0.5 : isSelected ? 0.3 : 0.15;
  const strokeColor = isSelected ? ACCENT_COLOR : STROKE_SUBTLE;
  const shapeType = effective.shape === 'circle' ? 1 : 0;

  // SDF material with uniforms
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: sdfVertexShader,
      fragmentShader: sdfFragmentShader,
      uniforms: {
        u_size: { value: new THREE.Vector2(effective.width, effective.depth) },
        u_cornerRadius: { value: effective.cornerRadius },
        u_fillColor: {
          value: new THREE.Vector4(ACCENT_COLOR.r, ACCENT_COLOR.g, ACCENT_COLOR.b, fillOpacity),
        },
        u_strokeColor: { value: new THREE.Vector4(strokeColor.r, strokeColor.g, strokeColor.b, 1) },
        u_strokeWidth: { value: isGrouped ? 0.8 : 0.5 },
        u_shapeType: { value: shapeType },
      },
      transparent: true,
      depthTest: false,
      side: THREE.DoubleSide,
    });
    // Only recreate material once — uniforms updated reactively via useEffect below
    // eslint-disable-next-line react-hooks/exhaustive-deps -- TECH-DEBT: intentional empty deps for stable material identity
  }, []);

  // Update uniforms reactively without recreating material
  useEffect(() => {
    if (!materialRef.current) return;
    const u = materialRef.current.uniforms;
    (u.u_size.value as THREE.Vector2).set(effective.width, effective.depth);
    u.u_cornerRadius.value = effective.cornerRadius;
    (u.u_fillColor.value as THREE.Vector4).set(
      ACCENT_COLOR.r,
      ACCENT_COLOR.g,
      ACCENT_COLOR.b,
      fillOpacity
    );
    (u.u_strokeColor.value as THREE.Vector4).set(strokeColor.r, strokeColor.g, strokeColor.b, 1);
    u.u_strokeWidth.value = isGrouped ? 0.8 : 0.5;
    u.u_shapeType.value = shapeType;
  }, [effective, fillOpacity, strokeColor, isGrouped, shapeType]);

  // Geometry sized to the shape
  const geometry = useMemo(() => {
    return new THREE.PlaneGeometry(effective.width, effective.depth);
  }, [effective.width, effective.depth]);

  // Position: center of the shape in world coords (Y-up, no inversion needed)
  const posX = effective.x + effective.width / 2;
  const posY = effective.y + effective.depth / 2;

  // Rotation in radians around Z axis
  // SVG used clockwise degrees; Three.js uses counter-clockwise radians
  const rotationZ = -(effective.rotation * Math.PI) / 180;

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const additive = e.nativeEvent.shiftKey;
    onSelect(cutout.id, additive);

    if (onDragStart && !additive) {
      onDragStart(cutout.id, e.point.x, e.point.y);
    }
  };

  const handleDoubleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onDoubleClick?.(cutout.id);
  };

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      position={[posX, posY, 0.02]}
      rotation={[0, 0, rotationZ]}
      renderOrder={RENDER_ORDER.SHAPES}
      onPointerDown={handlePointerDown}
      onDoubleClick={handleDoubleClick}
    >
      <primitive object={material} ref={materialRef} attach="material" />
    </mesh>
  );
});
