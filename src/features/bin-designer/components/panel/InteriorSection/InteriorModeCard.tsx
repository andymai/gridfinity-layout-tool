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
import { Badge } from '@/design-system';
import { ModeCard } from '../shared';
import { useResponsive } from '@/shared/hooks/useResponsive';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { getFeatureStatus } from '@/shared/constraints';
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
        <p className="rounded-md bg-surface/60 px-2 py-1.5 text-label leading-relaxed text-content-tertiary">
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
      <p className="px-1 text-micro text-content-tertiary">
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
  const { setCutoutEditorOpen, params } = useDesignerStore(
    useShallow((s) => ({
      setCutoutEditorOpen: s.setCutoutEditorOpen,
      params: s.params,
    }))
  );
  const t = useTranslation();

  // Asking the engine rather than reading `base.lightweight` directly: three
  // separate rules rule cutouts out, and the lightweight one fires only in its
  // interior mode, because the underside relief leaves the floor a cutout cuts.
  const cutoutStatus = getFeatureStatus(params, 'cutouts');
  if (!cutoutStatus.available) {
    return (
      <div className="w-full rounded-lg border border-stroke-subtle bg-surface/40 p-3 text-left opacity-70">
        <span className="text-xs font-semibold text-content-secondary">
          {t('binDesigner.editCutouts')}
        </span>
        {cutoutStatus.reason ? (
          <p className="mt-0.5 text-micro leading-relaxed text-content-tertiary">
            {t(cutoutStatus.reason)}
          </p>
        ) : null}
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
    <ModeCard
      icon={config.icon}
      title={t(config.titleKey)}
      description={t(config.descriptionKey)}
      selected={isExpanded}
      onSelect={onSelect}
      badge={
        card === 'bento' ? (
          <Badge tone="info" title={t('binDesigner.bento.experimentalHint')}>
            {t('common.experimental')}
          </Badge>
        ) : undefined
      }
    >
      {config.content}
    </ModeCard>
  );
}
