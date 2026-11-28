import type { Exchange, Step, StepKind } from '@/agent/client/session';
import type { TFunction } from '@/i18n';

/** A step in the reader's language, or the server's English label when the panel has no text for it. */
export function stepText(step: Step, t: TFunction): string {
  if (step.key === undefined) return step.label;
  const key = `askAi.step.${step.key}`;
  const text = t(`askAi.step.${step.key}`, step.vars);
  return text === key ? step.label : text;
}

const KINDS: readonly StepKind[] = ['read', 'search', 'check', 'plan', 'yours', 'change'];

/** The folded steps of an answer, such as "2 pages read · 1 check". */
export function stepSummary(exchange: Exchange, t: TFunction): string {
  const counts = new Map<StepKind, number>();
  let failed = 0;
  for (const step of exchange.steps) {
    if (step.state === 'done') counts.set(step.kind, (counts.get(step.kind) ?? 0) + 1);
    else if (step.state === 'error') failed++;
  }
  const parts = KINDS.filter((kind) => counts.has(kind)).map((kind) =>
    t(`askAi.count.${kind}`, { count: counts.get(kind) ?? 0 })
  );
  if (failed > 0) parts.push(t('askAi.count.failed', { count: failed }));
  return parts.join(' · ');
}
