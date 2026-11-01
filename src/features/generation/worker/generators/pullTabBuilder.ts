import {
  draw,
  drawRoundedRectangle,
  mirror,
  rotate,
  translate,
  withScope,
  edgeFinder,
  getBounds,
  fillet,
  fuseAll,
  unwrap,
} from 'brepjs';
import type { DisposalScope, Shape3D, ValidSolid } from 'brepjs';
import { planPullTabs, pullTabInRimShell } from '@/shared/utils/pullTabPlan';
import type { PullTabPlan } from '@/shared/utils/pullTabPlan';
import { effectiveRimFilletRadius } from '@/shared/utils/rimFillet';
import { sketch } from './meshUtils';
import { FeatureTag } from './featureTags';
import type { FeatureBuilder } from './pipeline/featureBuilder';
import type { PipelineContext } from './pipeline/types';
import { compactKey, stableSerialize } from './cacheKeyUtils';

function plans(ctx: PipelineContext): PullTabPlan[] {
  return planPullTabs(
    ctx.params,
    ctx.dimensions.wallHeight + ctx.dimensions.collarHeight,
    ctx.dimensions.floorThickness
  );
}

/**
 * Local XY is the tab's elevation; extrusion is toward the outside of the wall.
 *
 * The caller shifts every tab by the cavity offset, which a thickened
 * neighbouring wall moves off the bin's centre. Undoing that along the host
 * wall keeps each tab centred on the outside of its own wall.
 */
function position(
  scope: DisposalScope,
  shape: Shape3D,
  ctx: PipelineContext,
  p: PullTabPlan
): Shape3D {
  const { innerW, innerD, innerOffsetX, innerOffsetY } = ctx.dimensions;
  const alongX = -innerOffsetX || 0;
  const alongY = -innerOffsetY || 0;
  const upright = scope.register(rotate(shape, 90, { axis: [1, 0, 0] }));
  if (p.side === 'front') return translate(upright, [alongX, -innerD / 2, 0]);
  if (p.side === 'back') {
    const back = scope.register(rotate(upright, 180, { axis: [0, 0, 1] }));
    return translate(back, [alongX, innerD / 2, 0]);
  }
  if (p.side === 'left') {
    const left = scope.register(rotate(upright, -90, { axis: [0, 0, 1] }));
    return translate(left, [-innerW / 2, alongY, 0]);
  }
  const right = scope.register(rotate(upright, 90, { axis: [0, 0, 1] }));
  return translate(right, [innerW / 2, alongY, 0]);
}

/**
 * One shape per plan, joined. Tabs on different walls never touch, so one
 * disjoint fuse joins them. A wall that throws frees the walls built before it.
 */
function joinEach(
  tabs: readonly PullTabPlan[],
  build: (p: PullTabPlan) => Shape3D | null
): Shape3D | null {
  const shapes: Shape3D[] = [];
  try {
    for (const p of tabs) {
      const shape = build(p);
      if (shape) shapes.push(shape);
    }
  } catch (error) {
    for (const shape of shapes) shape.delete();
    throw error;
  }
  if (shapes.length <= 1) return shapes[0] ?? null;
  return withScope((scope: DisposalScope) => {
    for (const shape of shapes) scope.register(shape);
    return unwrap(fuseAll(shapes as ValidSolid[]));
  });
}

/** Every selected wall's raised body as one shape, positioned in the cavity frame. */
export function buildPullTab(ctx: PipelineContext): Shape3D | null {
  return joinEach(plans(ctx), (p) => buildPullTabBody(ctx, p));
}

function buildPullTabBody(ctx: PipelineContext, p: PullTabPlan): Shape3D {
  return withScope((scope: DisposalScope) => {
    const a = p.width / 2,
      r = p.rootRadius,
      t = p.topRadius;
    const z = p.rimZ,
      top = z + p.height;
    const angle = p.tabCurveAngle;
    const sin = Math.sin(angle),
      halfSin = Math.sin(angle / 2);
    const rise = 1 - Math.cos(angle),
      halfRise = 1 - Math.cos(angle / 2);
    const rimRadius = effectiveRimFilletRadius(ctx.params);
    // A short level wing carries the same round as the host wall, so the
    // two blends overlap continuously at the tab shoulder.
    const wing = rimRadius > 0 ? 0.5 : 0;
    let pen = draw([-a - wing, z - p.embed]).lineTo([-a - wing, z]);
    if (wing > 0) pen = pen.lineTo([-a, z]);
    if (r > 0)
      pen = pen.threePointsArcTo(
        [-a + r * sin, z + r * rise],
        [-a + r * halfSin, z + r * halfRise]
      );
    const straight = p.height - (r + t) * rise > 0.000001;
    if (straight) pen = pen.lineTo([-a + r * sin, top - t * rise]);
    if (t > 0)
      pen = pen.threePointsArcTo(
        [-a + p.tabShoulderRun, top],
        [-a + p.tabShoulderRun - t * halfSin, top - t * halfRise]
      );
    pen = pen.lineTo([a - p.tabShoulderRun, top]);
    if (t > 0)
      pen = pen.threePointsArcTo(
        [a - r * sin, top - t * rise],
        [a - p.tabShoulderRun + t * halfSin, top - t * halfRise]
      );
    if (straight) pen = pen.lineTo([a - r * sin, z + r * rise]);
    if (r > 0) pen = pen.threePointsArcTo([a, z], [a - r * halfSin, z + r * halfRise]);
    if (wing > 0) pen = pen.lineTo([a + wing, z]);
    const body = scope.register(
      sketch(pen.lineTo([a + wing, z - p.embed]).close()).extrude(p.thickness)
    );
    if (rimRadius <= 0) return position(scope, body, ctx, p);
    const edges = edgeFinder()
      .when((edge) => {
        const b = getBounds(edge);
        return (
          b.yMin >= z - 0.0001 &&
          ((Math.abs(b.zMin) < 0.0001 && Math.abs(b.zMax) < 0.0001) ||
            (Math.abs(b.zMin - p.thickness) < 0.0001 && Math.abs(b.zMax - p.thickness) < 0.0001))
        );
      })
      .findAll(body);
    try {
      const rounded = scope.register(unwrap(fillet(body as ValidSolid, edges, rimRadius)));
      return position(scope, rounded, ctx, p);
    } finally {
      for (const edge of edges) edge.delete();
    }
  });
}

export function buildPullTabRecess(ctx: PipelineContext, back = false): Shape3D | null {
  return joinEach(plans(ctx), (p) => buildPullTabRecessFor(ctx, p, back));
}

function buildPullTabRecessFor(
  ctx: PipelineContext,
  p: PullTabPlan,
  back: boolean
): Shape3D | null {
  if (p.recessDepth <= 0 || p.recessHeight <= 0) return null;
  return withScope((scope: DisposalScope) => {
    const e = p.recessEdgeRadius;
    const section = (depth: number, inset: number) =>
      sketch(
        drawRoundedRectangle(
          p.recessWidth - 2 * inset,
          p.recessHeight - 2 * inset,
          Math.max(0, p.recessRadius - inset)
        ).translate(0, p.recessTop - p.recessHeight / 2),
        'XY',
        depth
      );
    const angle = p.recessBlendAngle;
    const sin = Math.sin(angle),
      rise = 1 - Math.cos(angle);
    // Shorter circular arcs meet at a shared tangent when the radii exceed
    // the depth. This broadens the slope without moving the mouth or floor.
    const count = Math.max(6, Math.ceil(angle / (Math.PI / 36)));
    const sections = [section(0, 0)];
    if (e > 0) {
      for (let i = 1; i <= count; i++) {
        const a = (angle * i) / count;
        sections.push(section(e * (1 - Math.cos(a)), e * Math.sin(a)));
      }
    }
    const inside = p.recessInsideRadius;
    const insideStart = p.recessDepth - inside * rise;
    if (insideStart - e * rise > 0.000001) sections.push(section(insideStart, e * sin));
    if (inside > 0) {
      for (let i = 1; i <= count; i++) {
        const a = angle * (1 - i / count);
        sections.push(
          section(
            p.recessDepth - inside * (1 - Math.cos(a)),
            e * sin + inside * (sin - Math.sin(a))
          )
        );
      }
    }
    const tool = scope.register(section(-0.01, 0).loftWith(sections, { ruled: true }));
    if (back) {
      const reflected = scope.register(
        mirror(tool, { normal: [0, 0, 1], at: [0, 0, p.thickness / 2] })
      );
      return position(scope, reflected, ctx, p);
    }
    return position(scope, tool, ctx, p);
  });
}

const common = {
  tag: FeatureTag.BASE,
  shouldBuild: (ctx: PipelineContext) => plans(ctx).length > 0,
  cacheKey: (ctx: PipelineContext) =>
    compactKey(
      stableSerialize([
        'pull-tab-v5',
        plans(ctx),
        ctx.dimensions.innerW,
        ctx.dimensions.innerD,
        ctx.dimensions.innerOffsetX,
        ctx.dimensions.innerOffsetY,
      ])
    ),
};
export const pullTabFeature: FeatureBuilder = {
  ...common,
  shouldBuild: (ctx) => !pullTabInRimShell(ctx.params) && common.shouldBuild(ctx),
  name: 'pullTab',
  target: 'fuse',
  build: (ctx) => {
    const body = buildPullTab(ctx);
    return body ? [body] : null;
  },
};
export const pullTabRecessFeature: FeatureBuilder = {
  ...common,
  name: 'pullTabRecess',
  target: 'cut',
  build: (ctx) => {
    const pocket = buildPullTabRecess(ctx);
    return pocket ? [pocket] : null;
  },
};
export const pullTabBackRecessFeature: FeatureBuilder = {
  ...common,
  name: 'pullTabBackRecess',
  target: 'cut',
  shouldBuild: (ctx) => plans(ctx).some((p) => p.backRecess),
  build: (ctx) => {
    const pocket = buildPullTabRecess(ctx, true);
    return pocket ? [pocket] : null;
  },
};
