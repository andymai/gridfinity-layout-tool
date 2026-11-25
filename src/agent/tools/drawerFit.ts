import { CONSTRAINTS } from '@/core/constants';
import {
  MAX_DRAWER_MM,
  MIN_DRAWER_MM,
  MM_PER_INCH,
  drawerLink,
  formatMm,
  planDrawer,
} from '@/shared/plan/drawerPlan';
import type { GridFit } from '@/shared/plan/drawerPlan';
import type { DrawerFitInput } from '../contract/drawerFit';
import type { ToolContext, ToolOutput } from '../contract/tool';

function describeFit(name: string, fit: GridFit): string {
  return (
    `${name}: ${fit.width} x ${fit.depth} units (${formatMm(fit.gridWidthMm)} x ${formatMm(fit.gridDepthMm)} mm), ` +
    `spare room ${formatMm(fit.freeWidthMm)} mm in width and ${formatMm(fit.freeDepthMm)} mm in depth.`
  );
}

export function runDrawerFit(input: DrawerFitInput, context: ToolContext): ToolOutput {
  const scale = input.unit === 'in' ? MM_PER_INCH : 1;
  // Rounded to 0.1 mm before the fit, as the docs calculator's toMm does: the
  // drawer link carries the rounded size, so the app then plans the same grid
  // that the answer names.
  const toMm = (value: number): number => Math.round(value * scale * 10) / 10;
  const size = {
    widthMm: toMm(input.widthMm),
    depthMm: toMm(input.depthMm),
    ...(input.heightMm === undefined ? {} : { heightMm: toMm(input.heightMm) }),
  };
  const { MEASURED_MM_MIN, MEASURED_MM_MAX } = CONSTRAINTS;
  if (
    size.heightMm !== undefined &&
    !(size.heightMm >= MEASURED_MM_MIN && size.heightMm <= MEASURED_MM_MAX)
  ) {
    return {
      isError: true,
      content: `The app takes a drawer height from ${MEASURED_MM_MIN} mm to ${MEASURED_MM_MAX} mm. Leave the height out, or give one in that range.`,
    };
  }
  const plan = planDrawer(size);
  if (!plan) {
    return {
      isError: true,
      content: `The app plans drawers from ${MIN_DRAWER_MM} mm to ${MAX_DRAWER_MM} mm on each side. ${formatMm(size.widthMm)} x ${formatMm(size.depthMm)} mm is outside that range.`,
    };
  }
  const lines = [
    `Drawer: ${[size.widthMm, size.depthMm, size.heightMm]
      .filter((v) => v !== undefined)
      .map(formatMm)
      .join(' x ')} mm.`,
    describeFit('Whole-unit grid', plan.grid),
    plan.half
      ? `${describeFit('Half-unit grid', plan.half)} It needs Half-grid mode.`
      : 'A half-unit grid fits no tighter.',
  ];
  if (size.heightMm !== undefined) {
    lines.push(
      plan.stacks.length > 0
        ? `Tallest bins under ${formatMm(size.heightMm)} mm with the default baseplate: ${plan.stacks
            .map((s) =>
              s.count === 1
                ? `one bin: ${s.units} units (${formatMm(s.totalMm)} mm)`
                : `stacks of ${s.count}: ${s.units} units each (${formatMm(s.totalMm)} mm in all)`
            )
            .join('; ')}.`
        : `No bin of 2 units or more fits under ${formatMm(size.heightMm)} mm.`
    );
  }
  lines.push(`Plan this drawer in the app: ${drawerLink(context.origin, size)}`);
  return { isError: false, content: lines.join('\n') };
}
