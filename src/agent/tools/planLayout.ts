import { getUserMessage, isOk } from '@/core/result';
import { buildPlanLayout } from '@/shared/plan/buildPlanLayout';
import type { StashReason } from '@/shared/plan/buildPlanLayout';
import { PLAN_LINK_MAX_CHARS, planLinkUrl } from '@/shared/plan/planLink';
import type { PlanInput } from '@/shared/plan/planInput';
import type { PlanView } from '../contract/planLayout';
import type { PlanLayoutOutput, ToolContext } from '../contract/tool';

const REASONS: Readonly<Record<StashReason, string>> = {
  'too-tall': 'taller than the drawer',
  'no-room': 'no room left on its layer',
  'no-support': 'no bins under it on the layer below',
};

/** FNV-1a over the plan, so a replay of the same call names the same plan. */
export function planHandle(input: PlanInput): string {
  let hash = 0x811c9dc5;
  for (const char of JSON.stringify(input)) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

const units = (value: number): string => String(value);

export function runPlanLayout(input: PlanInput, context: ToolContext): PlanLayoutOutput {
  const built = buildPlanLayout(input);
  if (!isOk(built)) return { isError: true, content: getUserMessage(built.error), plan: null };
  const url = planLinkUrl(context.origin, input);
  if (!isOk(url)) {
    return {
      isError: true,
      content: `The plan is too large for a link (${url.error.chars} of ${PLAN_LINK_MAX_CHARS} characters). Shorten the labels and item lists, or plan fewer bins.`,
      plan: null,
    };
  }
  const { layout, placed, stashed, half } = built.value;
  const handle = planHandle(input);

  const counted = new Map<string, number>();
  for (const bin of placed) {
    const key = `${bin.label} (${units(bin.width)} x ${units(bin.depth)} units, ${bin.height}u${bin.layer > 1 ? `, layer ${bin.layer}` : ''})`;
    counted.set(key, (counted.get(key) ?? 0) + 1);
  }
  const layerOne = layout.layers[0].id;
  const usedCells = layout.bins
    .filter((bin) => bin.layerId === layerOne)
    .reduce((sum, bin) => sum + bin.width * bin.depth, 0);
  const lines = [
    `Planned "${layout.name}" on a ${units(layout.drawer.width)} x ${units(layout.drawer.depth)} unit grid${half ? ' with half units' : ''}.`,
  ];
  const measured = layout.drawer.measuredMm;
  const params = layout.baseplateParams;
  if (measured && params) {
    lines.push(
      `Drawer ${measured.width} x ${measured.depth} mm: the baseplate pads ${params.paddingLeft} mm at each side and ${params.paddingFront} mm at the front and the back.`
    );
  }
  lines.push(
    `Placed ${placed.length} bins: ${[...counted].map(([key, n]) => (n > 1 ? `${n} x ${key}` : key)).join('; ')}.`
  );
  lines.push(
    `Free on layer 1: ${units(layout.drawer.width * layout.drawer.depth - usedCells)} of ${units(layout.drawer.width * layout.drawer.depth)} grid cells.`
  );
  if (stashed.length > 0) {
    lines.push(
      `In the stash, not placed: ${stashed.map((bin) => `${bin.label} (${REASONS[bin.reason]})`).join('; ')}.`
    );
  }

  const plan: PlanView = {
    handle,
    title: layout.name,
    grid: { width: layout.drawer.width, depth: layout.drawer.depth },
    bins: placed.map((bin) => ({
      label: bin.label,
      x: bin.x,
      y: bin.y,
      width: bin.width,
      depth: bin.depth,
      layer: bin.layer,
      color: bin.color,
    })),
    stashed: stashed.map((bin) => ({ label: bin.label, reason: REASONS[bin.reason] })),
    link: url.value,
  };
  return { isError: false, content: lines.join('\n'), plan };
}
