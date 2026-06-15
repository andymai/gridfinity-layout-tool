/**
 * Uniform padding wrapper for a bin-designer sidebar section.
 *
 * Owns a section's leading (`px-4 py-3`) so sections don't each reinvent it.
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
    <div data-help-target={helpTarget} className={cn('px-4 py-3', className)}>
      {children}
    </div>
  );
}
