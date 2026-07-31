/**
 * Taper-band overlay for the cutout editor.
 *
 * Marks the strip along each flared interior edge that a full-depth cutout gets
 * trimmed out of. The editor frame stays rim-sized because that IS the usable
 * area at the fill surface — a shallow pocket can occupy the whole thing. It is
 * only as a pocket approaches the floor that the tapered wall has retracted and
 * the generator's clip bites, so the band reads as "deep cutouts stop here",
 * not "you may not draw here".
 *
 * Rendered as a hatched ring (interior rect minus the inset rect) plus a solid
 * line on the inner edge. The hatch is a repeating canvas texture rather than
 * generated line segments: `shapeGeometry` maps UVs straight from vertex
 * position, so a world-space repeat gives stripes that stay locked to the model
 * across pan and zoom without regenerating geometry.
 *
 * World coordinates: mm, Y-up. Origin at (0,0) = front-left corner — matching
 * `EditorBackground3D`.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { TaperBandSides } from '@/features/bin-designer/utils/binDimensions';
import { RENDER_ORDER, TAPER_BAND_COLOR } from './constants';
import { hasTaperBand, innerRectIsDrawable, taperBandInnerRect } from './taperBandGeometry';

/** Stripe period in mm. Wide enough to read as hatching, fine enough for a 3mm band. */
const HATCH_PERIOD_MM = 2.4;
/** Texture resolution for one stripe period. */
const HATCH_TEXELS = 16;

interface TaperBand3DProps {
  readonly binWidth: number;
  readonly binDepth: number;
  /** Per-side band width in mm; all-zero renders nothing. */
  readonly band: TaperBandSides;
}

function makeHatchTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = HATCH_TEXELS;
  canvas.height = HATCH_TEXELS;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = HATCH_TEXELS / 5;
    // Draw the diagonal three times so it wraps seamlessly across both seams.
    for (const shift of [-HATCH_TEXELS, 0, HATCH_TEXELS]) {
      ctx.beginPath();
      ctx.moveTo(shift, HATCH_TEXELS);
      ctx.lineTo(shift + HATCH_TEXELS, 0);
      ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  // shapeGeometry emits uv = vertex position (mm), so the repeat is a division
  // by the period rather than a tile count.
  texture.repeat.set(1 / HATCH_PERIOD_MM, 1 / HATCH_PERIOD_MM);
  return texture;
}

export function TaperBand3D({ binWidth, binDepth, band }: TaperBand3DProps) {
  const inner = useMemo(
    () => taperBandInnerRect(binWidth, binDepth, band),
    [band, binWidth, binDepth]
  );

  const ringShape = useMemo(() => {
    const shape = new THREE.Shape([
      new THREE.Vector2(0, 0),
      new THREE.Vector2(binWidth, 0),
      new THREE.Vector2(binWidth, binDepth),
      new THREE.Vector2(0, binDepth),
    ]);
    if (innerRectIsDrawable(inner)) {
      shape.holes.push(
        new THREE.Path([
          new THREE.Vector2(inner.x0, inner.y0),
          new THREE.Vector2(inner.x1, inner.y0),
          new THREE.Vector2(inner.x1, inner.y1),
          new THREE.Vector2(inner.x0, inner.y1),
        ])
      );
    }
    return shape;
  }, [binWidth, binDepth, inner]);

  const innerEdgeGeometry = useMemo(() => {
    const { x0, x1, y0, y1 } = inner;
    // Four corners, not five — lineLoop closes the last segment itself.
    return new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x0, y0, 0.02),
      new THREE.Vector3(x1, y0, 0.02),
      new THREE.Vector3(x1, y1, 0.02),
      new THREE.Vector3(x0, y1, 0.02),
    ]);
  }, [inner]);

  const hatch = useMemo(() => makeHatchTexture(), []);
  // CanvasTexture holds a GPU handle; without this it leaks on every unmount
  // (the editor remounts on every panel/workspace switch).
  useEffect(() => () => hatch.dispose(), [hatch]);
  useEffect(() => () => innerEdgeGeometry.dispose(), [innerEdgeGeometry]);

  if (!hasTaperBand(band)) return null;

  return (
    <group renderOrder={RENDER_ORDER.TAPER_BAND}>
      <mesh position={[0, 0, 0.015]}>
        <shapeGeometry args={[ringShape]} />
        <meshBasicMaterial
          map={hatch}
          color={TAPER_BAND_COLOR}
          transparent
          opacity={0.22}
          depthTest={false}
        />
      </mesh>
      <lineLoop geometry={innerEdgeGeometry}>
        <lineBasicMaterial color={TAPER_BAND_COLOR} transparent opacity={0.5} depthTest={false} />
      </lineLoop>
    </group>
  );
}
