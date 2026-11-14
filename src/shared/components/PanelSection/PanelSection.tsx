/**
 * Uniform padding wrapper for a sidebar section, in every tool.
 *
 * Owns a section's leading so sections don't each reinvent it. The padding
 * follows the UI density setting through `--space-panel` (16px by default).
 * Section dividers are drawn by the parent group via `divide-y`, never here —
 * one divider system keeps stacked hairlines from forming at seams.
 */

import type { ReactNode } from 'react';
import { cn } from '@/design-system/cn';

interface PanelSectionProps {
  children: ReactNode;
  /** Help-jump anchor consumed by the help dispatcher (`data-help-target`). */
  helpTarget?: string;
  className?: string;
}

export function PanelSection({ children, helpTarget, className }: PanelSectionProps) {
  return (
    <div
      data-help-target={helpTarget}
      className={cn('px-(--space-panel) py-[calc(var(--space-panel)*0.75)]', className)}
    >
      {children}
    </div>
  );
}
