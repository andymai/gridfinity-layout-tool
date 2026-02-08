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
  const t = useTranslation();

  return (
    <button
      type="button"
      onClick={() => setCutoutEditorOpen(true)}
      className="w-full rounded border border-accent/30 bg-accent/10 px-3 py-2 text-xs font-medium text-accent transition-colors hover:bg-accent/20"
    >
      {t('binDesigner.editCutouts')}
    </button>
  );
}

export function InteriorModeCard({ mode, isExpanded, onSelect }: InteriorModeCardProps) {
  const t = useTranslation();
  const config = MODE_CONFIG[mode];

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`
        w-full text-left rounded-lg border p-3 cursor-pointer
        transition-all duration-200 ease-in-out
        ${
          isExpanded
            ? 'border-accent bg-accent/5'
            : 'border-stroke-subtle bg-surface-elevated hover:bg-surface-hover'
        }
      `}
    >
      {/* Header (always visible) */}
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{config.icon}</div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-content-primary">{t(config.titleKey)}</h4>
          <p className="text-xs text-content-secondary mt-0.5">{t(config.descriptionKey)}</p>
        </div>
      </div>

      {/* Content (only when expanded) */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-stroke-subtle">{config.content}</div>
      )}
    </button>
  );
}
