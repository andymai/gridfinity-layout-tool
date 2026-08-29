/**
 * The panel's one cross-dependency affordance: a blocked feature names its
 * reason and offers the way out — either a one-click fix or a jump to the
 * control that gates it (which switches category, opens disclosures and
 * pulses the target through the help dispatcher).
 */

import { Button } from '@/design-system';

export interface DependencyHintProps {
  /** Omit when the gated control already states the reason itself. */
  readonly reason?: string;
  readonly actionLabel: string;
  readonly onAction: () => void;
}

export function DependencyHint({ reason, actionLabel, onAction }: DependencyHintProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {reason && <p className="text-label leading-relaxed text-content-tertiary">{reason}</p>}
      <Button
        type="button"
        variant="ghost"
        onClick={onAction}
        className="h-auto rounded border border-stroke-subtle bg-surface-elevated px-1.5 py-0.5 text-micro font-medium text-content-secondary hover:bg-surface-hover"
      >
        {actionLabel}
      </Button>
    </div>
  );
}
