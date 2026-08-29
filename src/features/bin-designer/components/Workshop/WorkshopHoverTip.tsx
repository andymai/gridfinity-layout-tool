/**
 * Delayed hover card for a Workshop part: name, key dimensions, and what it
 * stacks on. Pure DOM chrome anchored where the hover began — it never
 * enters the Three scene, so the thumbnail and GLB pipelines can't see it.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from '@/i18n';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { findAssemblyParentId, findAssemblyPart } from '@/features/bin-designer/utils/assemblyTree';
import { PART_LABEL_KEYS } from './WorkshopPanel/partFieldConfig';
import { partSummary } from './WorkshopPanel/partSummary';

const SHOW_DELAY_MS = 600;

export interface HoverTipTarget {
  readonly partId: string;
  /** Canvas-relative CSS pixels where the hover began. */
  readonly x: number;
  readonly y: number;
}

interface WorkshopHoverTipProps {
  readonly target: HoverTipTarget | null;
}

export function WorkshopHoverTip({ target }: WorkshopHoverTipProps) {
  const t = useTranslation();
  // The card is visible once the delay timer has confirmed the CURRENT part;
  // a hover that moved on before the timer fired never matches.
  const [shownFor, setShownFor] = useState<string | null>(null);
  const partId = target?.partId ?? null;

  useEffect(() => {
    if (partId === null) return;
    const timer = window.setTimeout(() => setShownFor(partId), SHOW_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [partId]);

  const structure = useDesignerStore((s) => s.structure);
  if (!target || shownFor !== target.partId || structure?.kind !== 'assembly') return null;
  const node = findAssemblyPart(structure.parts, target.partId);
  if (!node) return null;
  const parentId = findAssemblyParentId(structure.parts, target.partId);
  const parent = typeof parentId === 'string' ? findAssemblyPart(structure.parts, parentId) : null;

  return (
    <div
      data-testid="workshop-hover-tip"
      className="pointer-events-none absolute z-10 max-w-[220px] rounded-md border border-stroke-subtle bg-surface-elevated/95 px-2.5 py-1.5 text-label leading-snug shadow-md backdrop-blur"
      style={{ left: target.x + 14, top: target.y + 18 }}
    >
      <div className="font-medium text-content-primary">
        {t(PART_LABEL_KEYS[node.type])}
        <span className="ml-1.5 font-mono text-content-secondary">{partSummary(node)}mm</span>
      </div>
      {parent && (
        <div className="text-content-secondary">
          {t('workshop.tip.on', { parent: t(PART_LABEL_KEYS[parent.type]) })}
        </div>
      )}
    </div>
  );
}
