/**
 * Interior mode selection card component.
 *
 * Displays mode icon, title, description, and optional summary.
 * Expands inline to show mode-specific editor when selected.
 */

import { useTranslation } from '@/i18n';
import { useDesignerStore } from '@/features/bin-designer/store';
import { CompartmentEditor } from '../../CompartmentEditor';
import { SlotConfigurator } from '../../SlotConfigurator/SlotConfigurator';
import { Grid3x3Icon, DividerIcon, ScissorsIcon } from './icons';
import type { BinStyle } from '../../../types';
import type { ReactNode } from 'react';

interface InteriorModeCardProps {
  mode: BinStyle;
  isExpanded: boolean;
  onSelect: () => void;
}

interface ModeConfig {
  icon: ReactNode;
  titleKey: string;
  descriptionKey: string;
  content: ReactNode;
}

const MODE_CONFIG: Record<BinStyle, ModeConfig> = {
  standard: {
    icon: <Grid3x3Icon size={20} className="text-content-secondary" />,
    titleKey: 'binDesigner.interior.standard.title',
    descriptionKey: 'binDesigner.interior.standard.description',
    content: <CompartmentEditor />,
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
    <button
      type="button"
      onClick={() => setCutoutEditorOpen(true)}
      className="w-full rounded-lg bg-gradient-to-r from-accent/10 to-info/10 hover:from-accent/20 hover:to-info/20 border border-accent/20 p-3 text-left transition-all group"
    >
      <div className="flex items-center gap-3">
        {/* Mini illustration: top-view of a bin with cutout shapes */}
        <div className="flex-shrink-0 w-10 h-10 rounded bg-surface/60 border border-accent/20 flex items-center justify-center">
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
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-xs font-semibold text-accent group-hover:text-accent/90">
            {t('binDesigner.editCutouts')}
          </span>
          <p className="text-[10px] text-content-tertiary mt-0.5 leading-relaxed">
            {t('binDesigner.editCutoutsSubtitle')}
          </p>
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
    </button>
  );
}

export function InteriorModeCard({ mode, isExpanded, onSelect }: InteriorModeCardProps) {
  const t = useTranslation();
  const config = MODE_CONFIG[mode];

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
      <button
        type="button"
        onClick={onSelect}
        className="flex w-full cursor-pointer items-start gap-3 text-left"
      >
        <div className="mt-0.5">{config.icon}</div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-content-primary">{t(config.titleKey)}</h4>
          <p className="text-xs text-content-secondary mt-0.5">{t(config.descriptionKey)}</p>
        </div>
      </button>

      {/* Content — rendered outside the button so interactive controls are valid HTML */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-stroke-subtle">{config.content}</div>
      )}
    </div>
  );
}
