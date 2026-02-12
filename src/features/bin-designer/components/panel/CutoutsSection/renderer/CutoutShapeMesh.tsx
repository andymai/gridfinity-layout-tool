/**
 * WebGL mesh renderer for a single cutout shape.
 *
 * Uses SDF ShaderMaterial on a quad (PlaneGeometry) for pixel-perfect
 * anti-aliased shapes at any zoom level. Position and rotation in world
 * coordinates (mm, Y-up).
 */

import { memo, useMemo, useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import type { Cutout } from '@/features/bin-designer/types';
import {
  sdfVertexShader,
  sdfFragmentShader,
  sdfFragmentShaderFillOnly,
  sdfFragmentShaderStrokeOnly,
} from './shapeGeometry';
import {
  RENDER_ORDER,
  ACCENT_COLOR_HEX,
  STROKE_WIDTH_SELECTED_PX,
  STROKE_WIDTH_DEFAULT_PX,
  STROKE_WIDTH_HOVER_PX,
  STROKE_WIDTH_GROUPED_PX,
} from './constants';
import { PathShapeMesh } from './PathShapeMesh';

const STROKE_SELECTED = new THREE.Color(ACCENT_COLOR_HEX);

/** Render mode for grouped cutout visual merge via stencil buffer */
export type ShapeRenderMode = 'normal' | 'fill' | 'stroke';

interface CutoutShapeMeshProps {
  readonly cutout: Cutout;
  readonly isSelected: boolean;
  readonly isGrouped: boolean;
  readonly isDragging: boolean;
  readonly previewOverrides?: Partial<Cutout>;
  readonly binColor: string;
  readonly renderMode?: ShapeRenderMode;
  readonly onSelect: (id: string, additive: boolean) => void;
  readonly onDoubleClick?: (id: string) => void;
  readonly onDragStart?: (id: string, mmX: number, mmY: number, altKey?: boolean) => void;
  readonly disablePointerEvents?: boolean;
}

export const CutoutShapeMesh = memo(function CutoutShapeMesh(props: CutoutShapeMeshProps) {
  // Delegate path shapes to dedicated renderer (SDF shaders don't support arbitrary polygons)
  if (props.cutout.shape === 'path') {
    return (
      <PathShapeMesh
        cutout={props.cutout}
        isSelected={props.isSelected}
        isGrouped={props.isGrouped}
        isDragging={props.isDragging}
        previewOverrides={props.previewOverrides}
        binColor={props.binColor}
        onSelect={props.onSelect}
        onDoubleClick={props.onDoubleClick}
        onDragStart={props.onDragStart}
        disablePointerEvents={props.disablePointerEvents}
      />
    );
  }

  return <SDFShapeMesh {...props} />;
});

/** SDF-based renderer for rectangle and circle shapes. */
const SDFShapeMesh = memo(function SDFShapeMesh({
  cutout,
  isSelected,
  isGrouped,
  isDragging,
  previewOverrides,
  binColor,
  renderMode = 'normal',
  onSelect,
  onDoubleClick,
  onDragStart,
}: CutoutShapeMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const [isHovered, setIsHovered] = useState(false);
  const { camera } = useThree();
  const zoom = camera.zoom;

  // Merge preview overrides for live feedback during drag/resize
  const effective = useMemo(
    () => (previewOverrides ? { ...cutout, ...previewOverrides } : cutout),
    [cutout, previewOverrides]
  );

  // Cutout colors derived from the bin surface color
  const { cutFillColor, strokeDefault, strokeHover } = useMemo(() => {
    const base = new THREE.Color(binColor);
    return {
      cutFillColor: base.clone().multiplyScalar(0.7), // darkened — bottom of cut
      strokeDefault: base.clone().multiplyScalar(0.5), // outline for contrast
      strokeHover: base.clone().multiplyScalar(0.4), // darker on hover
    };
  }, [binColor]);

  // Visual styling — screen-space stroke width converted to world mm
  const fillOpacity = isDragging ? 0.85 : 0.95; // Opaque — these are physical cuts
  const strokeColor = isSelected ? STROKE_SELECTED : isHovered ? strokeHover : strokeDefault;
  const strokeWidthPx = isSelected
    ? STROKE_WIDTH_SELECTED_PX
    : isHovered
      ? STROKE_WIDTH_HOVER_PX
      : isGrouped
        ? STROKE_WIDTH_GROUPED_PX
        : STROKE_WIDTH_DEFAULT_PX;
  const strokeWidth = strokeWidthPx / zoom; // Convert screen px to world mm
  const shapeType = effective.shape === 'circle' ? 1 : 0;

  // Select fragment shader based on render mode
  const fragmentShader =
    renderMode === 'fill'
      ? sdfFragmentShaderFillOnly
      : renderMode === 'stroke'
        ? sdfFragmentShaderStrokeOnly
        : sdfFragmentShader;

  // SDF material with uniforms
  const material = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      vertexShader: sdfVertexShader,
      fragmentShader,
      uniforms: {
        u_size: { value: new THREE.Vector2(effective.width, effective.depth) },
        u_cornerRadius: { value: effective.cornerRadius },
        u_fillColor: {
          value: new THREE.Vector4(cutFillColor.r, cutFillColor.g, cutFillColor.b, fillOpacity),
        },
        u_strokeColor: { value: new THREE.Vector4(strokeColor.r, strokeColor.g, strokeColor.b, 1) },
        u_strokeWidth: { value: isGrouped ? 0.8 : 0.5 },
        u_shapeType: { value: shapeType },
      },
      transparent: true,
      depthTest: false,
      side: THREE.DoubleSide,
    });

    // Stencil config for grouped visual merge
    if (renderMode === 'fill') {
      mat.stencilWrite = true;
      mat.stencilFunc = THREE.AlwaysStencilFunc;
      mat.stencilRef = 1;
      mat.stencilZPass = THREE.IncrementStencilOp;
    } else if (renderMode === 'stroke') {
      mat.stencilWrite = false;
      mat.stencilFunc = THREE.EqualStencilFunc;
      mat.stencilRef = 1;
    }

    return mat;
    // renderMode is stable per instance — grouped cutouts always have fixed modes
    // eslint-disable-next-line react-hooks/exhaustive-deps -- TECH-DEBT: intentional empty deps for stable material identity
  }, []);

  // Update uniforms reactively without recreating material
  useEffect(() => {
    if (!materialRef.current) return;
    const u = materialRef.current.uniforms;
    (u.u_size.value as THREE.Vector2).set(effective.width, effective.depth);
    u.u_cornerRadius.value = effective.cornerRadius;
    (u.u_fillColor.value as THREE.Vector4).set(
      cutFillColor.r,
      cutFillColor.g,
      cutFillColor.b,
      fillOpacity
    );
    (u.u_strokeColor.value as THREE.Vector4).set(strokeColor.r, strokeColor.g, strokeColor.b, 1);
    u.u_strokeWidth.value = strokeWidth;
    u.u_shapeType.value = shapeType;
  }, [effective, fillOpacity, cutFillColor, strokeColor, strokeWidth, shapeType]);

  // Geometry sized to the shape
  const geometry = useMemo(() => {
    return new THREE.PlaneGeometry(effective.width, effective.depth);
  }, [effective.width, effective.depth]);

  // Position: center of the shape in world coords (Y-up, no inversion needed)
  const posX = effective.x + effective.width / 2;
  const posY = effective.y + effective.depth / 2;

  // Smaller shapes get higher Z → closer to camera → win raycasting on overlap.
  // Since depthTest is false, Z only affects raycasting, not visual rendering.
  const area = effective.width * effective.depth;
  const posZ = 0.02 + 0.01 / Math.max(area, 1);

  // Rotation in radians around Z axis
  // SVG used clockwise degrees; Three.js uses counter-clockwise radians
  const rotationZ = -(effective.rotation * Math.PI) / 180;

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.nativeEvent.button !== 0) return; // Only left-click
    e.stopPropagation();
    const additive = e.nativeEvent.shiftKey;
    onSelect(cutout.id, additive);

    if (onDragStart && !additive) {
      onDragStart(cutout.id, e.point.x, e.point.y, e.nativeEvent.altKey);
    }
  };

  const handleDoubleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onDoubleClick?.(cutout.id);
  };

  const handlePointerEnter = () => {
    if (!isSelected) {
      setIsHovered(true);
    }
  };

  const handlePointerLeave = () => {
    setIsHovered(false);
  };

  const renderOrder =
    renderMode === 'fill'
      ? RENDER_ORDER.GROUP_FILL
      : renderMode === 'stroke'
        ? RENDER_ORDER.GROUP_STROKE
        : RENDER_ORDER.SHAPES;

  // Stroke pass is visual-only — no pointer interaction
  if (renderMode === 'stroke') {
    return (
      <mesh
        geometry={geometry}
        position={[posX, posY, posZ]}
        rotation={[0, 0, rotationZ]}
        renderOrder={renderOrder}
        raycast={() => {}}
      >
        <primitive object={material} ref={materialRef} attach="material" />
      </mesh>
    );
  }

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      position={[posX, posY, posZ]}
      rotation={[0, 0, rotationZ]}
      renderOrder={renderOrder}
      onPointerDown={handlePointerDown}
      onDoubleClick={handleDoubleClick}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      <primitive object={material} ref={materialRef} attach="material" />
    </mesh>
  );
});
