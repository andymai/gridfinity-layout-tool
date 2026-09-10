/** Engraves or embosses a part's label onto the face its transform exposes. */
import { cut, fuse, rotate, translate, unwrap } from 'brepjs';
import type { DisposalScope, Shape3D, ValidSolid } from 'brepjs';
import type { AssemblyPartNode, PartLabel } from '@/shared/types/assembly';
import { resolveTextStyle, DEFAULT_TEXT_STYLE_DEFAULTS } from '@/shared/types/bin';
import { buildTextSolid } from './textBuilder';
import { DEG } from './assemblyPartTemplate';

const LABEL_YAW: Record<'front' | 'back' | 'left' | 'right', number> = {
  front: 0,
  back: 180,
  left: -90,
  right: 90,
};

interface LabelFaceBox {
  faceW: number;
  faceH: number;
  centerZ: number;
  thickness: number;
  /** Top-face labels use a Y offset instead of a Z band. */
  topCenterY?: number;
}

/**
 * The flat rectangle a label may occupy on one face, in the part's local
 * frame — null when that face is interrupted, sloped, or the part has no
 * box face to carry text.
 */
function labelFaceBox(node: AssemblyPartNode, face: PartLabel['face']): LabelFaceBox | null {
  switch (node.type) {
    case 'block': {
      const { width, depth, height, wedgeAngleDeg } = node.params;
      if ((node.params.tiltDeg ?? 0) > 0) return null;
      const frontH =
        wedgeAngleDeg > 0 ? Math.max(0.5, height - depth * Math.tan(wedgeAngleDeg * DEG)) : height;
      switch (face) {
        case 'front':
          return { faceW: width, faceH: frontH, centerZ: frontH / 2, thickness: depth };
        case 'back':
          return { faceW: width, faceH: height, centerZ: height / 2, thickness: depth };
        case 'left':
        case 'right':
          if (wedgeAngleDeg > 0) return null;
          return { faceW: depth, faceH: height, centerZ: height / 2, thickness: width };
        case 'top':
          if (wedgeAngleDeg > 0) return null;
          return { faceW: width, faceH: depth, centerZ: height, thickness: height, topCenterY: 0 };
      }
      break;
    }
    case 'comb': {
      const { width, depth, height, slotCount } = node.params;
      const slotDepth = Math.min(node.params.slotDepth, height - 1.5);
      const band = height - slotDepth;
      const slotWidth = Math.min(node.params.slotWidth, width / slotCount - 2);
      if (face === 'front' || face === 'back') {
        if (slotWidth > 0.5 && band < 4) return null;
        const h = slotWidth > 0.5 ? band : height;
        return { faceW: width, faceH: h, centerZ: h / 2, thickness: depth };
      }
      if (face === 'left' || face === 'right') {
        return { faceW: depth, faceH: height, centerZ: height / 2, thickness: width };
      }
      return null;
    }
    case 'boreBank': {
      const { width, depth, height } = node.params;
      if (face === 'front' || face === 'back') {
        return { faceW: width, faceH: height, centerZ: height / 2, thickness: depth };
      }
      if (face === 'left' || face === 'right') {
        return { faceW: depth, faceH: height, centerZ: height / 2, thickness: width };
      }
      return null;
    }
    case 'riser': {
      const { width, stepCount, stepDepth, stepHeight } = node.params;
      const totalD = stepCount * stepDepth;
      switch (face) {
        case 'front':
          return { faceW: width, faceH: stepHeight, centerZ: stepHeight / 2, thickness: totalD };
        case 'left':
        case 'right':
          return { faceW: totalD, faceH: stepHeight, centerZ: stepHeight / 2, thickness: width };
        case 'top':
          return {
            faceW: width,
            faceH: stepDepth,
            centerZ: stepCount * stepHeight,
            thickness: stepHeight,
            topCenterY: totalD / 2 - stepDepth / 2,
          };
        default:
          return null;
      }
    }
    default:
      return null;
  }
  return null;
}

/** Emboss or engrave the node's label onto the body; the original body is
 *  returned untouched when the face is unsupported or the text cannot fit. */
export function applyPartLabel(
  scope: DisposalScope,
  body: Shape3D,
  node: AssemblyPartNode
): Shape3D {
  const label = node.label;
  if (label === undefined || label.text.trim() === '') return body;
  const box = labelFaceBox(node, label.face);
  if (!box) return body;
  const depth = Math.min(
    label.depthMm,
    label.style === 'recessed' ? Math.max(0.2, box.thickness - 0.8) : label.depthMm
  );
  const style = resolveTextStyle(DEFAULT_TEXT_STYLE_DEFAULTS, {
    mode: label.style === 'raised' ? 'emboss' : 'engrave',
    depth,
    sizeMode: 'fixed',
    fixedSize: Math.min(label.sizeMm, Math.max(3, box.faceH - 2)),
  });
  try {
    const result = buildTextSolid(scope, {
      text: label.text,
      style,
      availW: box.faceW,
      availD: box.faceH,
      centerX: 0,
      centerY: label.face === 'top' ? (box.topCenterY ?? 0) : 0,
      topZ: label.face === 'top' ? box.centerZ : 0,
      depth,
      hostThickness: box.thickness,
      hostKind: 'plaque',
    });
    if (!result) return body;
    let text = result.solid;
    if (label.face !== 'top') {
      const stood = scope.register(rotate(text, 90, { axis: [1, 0, 0] }));
      const yaw = LABEL_YAW[label.face];
      const faced = yaw === 0 ? stood : scope.register(rotate(stood, yaw, { axis: [0, 0, 1] }));
      const { width, depth: partD } = node.params as { width: number; depth?: number };
      const totalD =
        node.type === 'riser' ? node.params.stepCount * node.params.stepDepth : (partD ?? 0);
      const offset: [number, number, number] =
        label.face === 'front'
          ? [0, -totalD / 2, box.centerZ]
          : label.face === 'back'
            ? [0, totalD / 2, box.centerZ]
            : label.face === 'left'
              ? [-width / 2, 0, box.centerZ]
              : [width / 2, 0, box.centerZ];
      text = scope.register(translate(faced, offset));
    }
    const op = result.op === 'cut' ? cut : fuse;
    const merged = unwrap(op(body as ValidSolid, text as ValidSolid)) as Shape3D;
    if (merged !== body) body.delete();
    return merged;
  } catch {
    return body;
  }
}
