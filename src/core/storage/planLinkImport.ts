import { getUserMessage, isOk } from '@/core/result';
import type { Layout } from '@/core/types';
import { buildPlanLayout } from '@/shared/plan/buildPlanLayout';
import { decodePlanLink } from '@/shared/plan/planLink';
import { importLayoutJSON } from './ShareService';
import { PLAN_LINK_NEEDS_UPDATE } from './shareUrl';

/**
 * Builds the layout in a `#plan=` link with the same code that the agent tool
 * used, then imports it like any shared layout, which validates it and gives
 * it fresh ids. Loaded on demand: plan links are rare, and startup stays small.
 */
export async function importPlanLink(
  value: string
): Promise<{ layout: Layout | null; errors: string[] }> {
  const decoded = await decodePlanLink(value);
  if (!isOk(decoded)) {
    const { error } = decoded;
    if (error.kind === 'newer-version') return { layout: null, errors: [PLAN_LINK_NEEDS_UPDATE] };
    return {
      layout: null,
      errors: error.kind === 'invalid' ? [...error.issues] : ['The plan link is damaged.'],
    };
  }
  const built = buildPlanLayout(decoded.value);
  if (!isOk(built)) return { layout: null, errors: [getUserMessage(built.error)] };
  return importLayoutJSON(JSON.stringify(built.value.layout));
}
