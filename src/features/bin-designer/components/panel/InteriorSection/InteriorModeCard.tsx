/**
 * Interior mode selection card component.
 *
 * Displays mode icon, title, description, and optional summary.
 * Expands inline to show mode-specific editor when selected.
 *
 * Keyed by {@link InteriorCard}, not `BinStyle`: Bento and Grid Dividers are
 * two authoring surfaces over the same `standard` style.
 */

import { useTranslation } from '@/i18n';
import { Badge, Button } from '@/design-system';
import { useResponsive } from '@/shared/hooks/useResponsive';
import { useDesignerStore } from '@/features/bin-designer/store';
import { getDrawnCompartmentIds } from '@/features/bin-designer/utils/bentoDraw';
import { CompartmentEditor } from '../../CompartmentEditor';
import { SlotConfigurator } from '../../SlotConfigurator/SlotConfigurator';
import { WorkspaceLaunchButton } from './WorkspaceLaunchButton';
import { BentoMiniPreview } from './BentoMiniPreview';
import { Grid3x3Icon, BentoIcon, DividerIcon, ScissorsIcon } from './icons';
import type { InteriorCard } from '../../../types';
import type { ReactNode } from 'react';

interface InteriorModeCardProps {
  card: InteriorCard;
  isExpanded: boolean;
  onSelect: () => void;
}

interface ModeConfig {
  icon: ReactNode;
  titleKey: string;
  descriptionKey: string;
  content: ReactNode;
}

const MODE_CONFIG: Record<InteriorCard, ModeConfig> = {
  standard: {
    icon: <Grid3x3Icon size={20} className="text-content-secondary" />,
    titleKey: 'binDesigner.interior.standard.title',
    descriptionKey: 'binDesigner.interior.standard.description',
    content: <CompartmentEditor />,
  },
  bento: {
    icon: <BentoIcon size={20} className="text-content-secondary" />,
    titleKey: 'binDesigner.interior.bento.title',
    descriptionKey: 'binDesigner.interior.bento.description',
    content: <BentoModeContent />,
  },
  slotted: {
    icon: <DividerIcon size={20} className="text-content-secondary" />,
    titleKey: 'binDesigner.interior.slotted.title',
    descriptionKey: 'binDesigner.interior.slotted.description',
    content: <SlotConfigurator />,
  },
  solid: {
    icon: <ScissorsIcon size={20} className="text-content-secondary" />,
    titleKey: 'binDesigner.interior.solid.title',
    descriptionKey: 'binDesigner.interior.solid.description',
    content: <SolidModeContent />,
  },
};

function BentoModeContent() {
  const setBentoWorkspaceOpen = useDesignerStore((s) => s.setBentoWorkspaceOpen);
  const compartments = useDesignerStore((s) => s.params.compartments);
  const width = useDesignerStore((s) => s.params.width);
  const depth = useDesignerStore((s) => s.params.depth);
  const { isDesktop } = useResponsive();
  const t = useTranslation();
  // Drawn compartments only — counting background pockets said "36
  // compartments" about an untouched bin.
  const drawnCount = getDrawnCompartmentIds(compartments).size;

  // The workspace needs room the panel does not have, so off desktop the card
  // expands to the same compartment editor Grid Dividers uses. A launcher that
  // opened nothing would be worse than no launcher: DesignerMainContent only
  // renders the workspace on desktop. Say so — swapping in a different editor
  // without a word reads as "Bento is just a worse grid".
  if (!isDesktop) {
    return (
      <div className="space-y-3">
        <p className="rounded-md bg-surface/60 px-2 py-1.5 text-[11px] leading-relaxed text-content-tertiary">
          {t('binDesigner.bento.smallScreenNote')}
        </p>
        <CompartmentEditor />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <BentoMiniPreview compartments={compartments} aspectRatio={depth > 0 ? width / depth : 1} />
      <WorkspaceLaunchButton
        illustration={<BentoIcon size={24} className="text-accent/70" />}
        title={t('binDesigner.openBentoWorkspace')}
        subtitle={t('binDesigner.openBentoWorkspaceSubtitle')}
        onClick={() => setBentoWorkspaceOpen(true)}
      />
      <p className="px-1 text-[10px] text-content-tertiary">
        {drawnCount === 1
          ? t('binDesigner.bento.summary.one', {
              cols: compartments.cols,
              rows: compartments.rows,
            })
          : t('binDesigner.bento.summary.other', {
              cols: compartments.cols,
              rows: compartments.rows,
              count: drawnCount,
            })}
      </p>
    </div>
  );
}

function SolidModeContent() {
  const setCutoutEditorOpen = useDesignerStore((s) => s.setCutoutEditorOpen);
  const lightweight = useDesignerStore((s) => s.params.base.lightweight);
  const t = useTranslation();

  // Cutouts cut into the solid top, which is incompatible with a lightweight
  // floor (mutually exclusive in the constraint engine) — disable the editor
  // entry with a reason instead of opening it.
  if (lightweight) {
    return (
      <div className="w-full rounded-lg border border-stroke-subtle bg-surface/40 p-3 text-left opacity-70">
        <span className="text-xs font-semibold text-content-secondary">
          {t('binDesigner.editCutouts')}
        </span>
        <p className="mt-0.5 text-[10px] leading-relaxed text-content-tertiary">
          {t('binDesigner.lightweightDisablesCutouts')}
        </p>
      </div>
    );
  }

  return (
    <WorkspaceLaunchButton
      illustration={
        /* Mini illustration: top-view of a bin with cutout shapes */
        <svg
          className="w-6 h-6 text-accent/70"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M8 10 h3 v4 h-3 z" fill="currentColor" opacity="0.4" stroke="none" />
          <circle cx="16" cy="12" r="2.5" fill="currentColor" opacity="0.4" stroke="none" />
        </svg>
      }
      title={t('binDesigner.editCutouts')}
      subtitle={t('binDesigner.editCutoutsSubtitle')}
      onClick={() => setCutoutEditorOpen(true)}
    />
  );
}

export function InteriorModeCard({ card, isExpanded, onSelect }: InteriorModeCardProps) {
  const t = useTranslation();
  const config = MODE_CONFIG[card];

  return (
    <div
      className={`
        w-full rounded-lg border p-3
        transition-all duration-200 ease-in-out
        ${
          isExpanded
            ? 'border-accent bg-accent/5'
            : 'border-stroke-subtle bg-surface-elevated hover:bg-surface-hover'
        }
      `}
    >
      {/* Header — only this element is the interactive button */}
      <Button
        type="button"
        variant="ghost"
        onClick={onSelect}
        className="flex h-auto w-full cursor-pointer items-start justify-start gap-3 bg-transparent p-0 text-left font-normal hover:bg-transparent"
      >
        <div className="mt-0.5">{config.icon}</div>
        <div className="flex-1 min-w-0">
          {/* flex-wrap, not a nowrap row: the badge sits beside the title at
              normal panel widths and drops to its own line on a narrow one,
              rather than squeezing the heading into an ellipsis. */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <h4 className="text-sm font-medium text-content-primary">{t(config.titleKey)}</h4>
            {card === 'bento' && (
              <Badge tone="warning" title={t('binDesigner.bento.experimentalHint')}>
                {t('common.experimental')}
              </Badge>
            )}
          </div>
          <p className="text-xs text-content-secondary mt-0.5">{t(config.descriptionKey)}</p>
        </div>
      </Button>

      {/* Content — rendered outside the button so interactive controls are valid HTML */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-stroke-subtle">{config.content}</div>
      )}
    </div>
  );
}
