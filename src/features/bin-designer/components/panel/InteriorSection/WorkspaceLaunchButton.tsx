/**
 * Call-to-action that swaps the sidebar for a full workspace.
 *
 * Shared by the Solid and Bento cards: both are interior modes whose editing
 * surface is too big for a 288px panel, so the card holds a door rather than
 * the editor itself.
 */

import { Button } from '@/design-system';
import type { ReactNode } from 'react';

export interface WorkspaceLaunchButtonProps {
  readonly illustration: ReactNode;
  readonly title: string;
  readonly subtitle: string;
  readonly onClick: () => void;
}

export function WorkspaceLaunchButton({
  illustration,
  title,
  subtitle,
  onClick,
}: WorkspaceLaunchButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      className="group h-auto w-full justify-start rounded-lg border border-accent/20 bg-gradient-to-r from-accent/10 to-info/10 p-3 text-left font-normal transition-all hover:from-accent/20 hover:to-info/20 hover:bg-transparent"
    >
      <div className="flex w-full items-center gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded bg-surface/60 border border-accent/20 flex items-center justify-center">
          {illustration}
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-xs font-semibold text-accent group-hover:text-accent/90">
            {title}
          </span>
          <p className="text-micro text-content-tertiary mt-0.5 leading-relaxed">{subtitle}</p>
        </div>
        <svg
          className="w-4 h-4 text-accent/50 flex-shrink-0 group-hover:translate-x-0.5 transition-transform"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
        </svg>
      </div>
    </Button>
  );
}
