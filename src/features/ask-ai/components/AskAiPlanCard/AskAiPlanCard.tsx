import type { PlanView } from '@/agent/contract';
import { Button } from '@/design-system';
import { useTranslation } from '@/i18n';
import { AskAiDrawerMap } from '../AskAiDrawerMap';

export interface AskAiPlanCardProps {
  readonly plan: PlanView;
  readonly onOpen: (plan: PlanView) => void;
}

/** A plan from plan_layout. Open shows it in the editor as a preview that the reader can save. */
export function AskAiPlanCard({ plan, onOpen }: AskAiPlanCardProps) {
  const t = useTranslation();
  const empty = plan.bins.length === 0 && plan.stashed.length === 0;
  const caption = [
    t('askAi.plan.grid', { width: String(plan.grid.width), depth: String(plan.grid.depth) }),
    empty ? t('askAi.plan.empty') : t('askAi.plan.bins', { count: plan.bins.length }),
    ...(plan.stashed.length > 0 ? [t('askAi.plan.stashed', { count: plan.stashed.length })] : []),
  ].join(' · ');
  return (
    <figure className="my-3 space-y-2 rounded-lg border border-stroke-subtle p-3">
      <AskAiDrawerMap grid={plan.grid} bins={plan.bins} label={`${plan.title}: ${caption}`} />
      <figcaption className="text-xs text-content-secondary">
        <span className="font-semibold text-content">{plan.title}</span> {caption}
      </figcaption>
      <Button size="sm" variant="primary" onClick={() => onOpen(plan)}>
        {t('askAi.plan.open')}
      </Button>
      <p className="text-xs text-content-tertiary">{t('askAi.plan.openHint')}</p>
    </figure>
  );
}
