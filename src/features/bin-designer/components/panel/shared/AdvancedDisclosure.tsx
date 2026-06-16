/**
 * Collapsible "advanced controls" disclosure shared by feature panels. Folds
 * secondary controls (cutout position/offset, handle vertical-position/count)
 * behind a chevron summary so panels stay short, and auto-expands when the
 * values are non-default (`forceOpen`) so customizations are never hidden.
 */

import { useState, type ReactNode } from 'react';
import { Button } from '@/design-system';
import { ChevronIcon } from './icons';

interface AdvancedDisclosureProps {
  label: string;
  /** Compact summary of the current values, shown next to the label. */
  summary?: string;
  /** Keep open regardless of manual state (values differ from default). */
  forceOpen?: boolean;
  children: ReactNode;
}

export function AdvancedDisclosure({
  label,
  summary,
  forceOpen = false,
  children,
}: AdvancedDisclosureProps) {
  const [manualOpen, setManualOpen] = useState(false);
  const isOpen = manualOpen || forceOpen;

  return (
    <div>
      <Button
        variant="ghost"
        type="button"
        onClick={() => setManualOpen((prev) => !prev)}
        aria-expanded={isOpen}
        className="flex items-center gap-1.5 px-0 py-0 text-xs font-normal text-content-tertiary transition-colors hover:bg-transparent hover:text-content-secondary"
      >
        <ChevronIcon open={isOpen} />
        <span>{label}</span>
        {summary && <span className="font-medium text-content-secondary">{summary}</span>}
      </Button>

      {isOpen && <div className="ml-3.5 mt-2 space-y-2">{children}</div>}
    </div>
  );
}
