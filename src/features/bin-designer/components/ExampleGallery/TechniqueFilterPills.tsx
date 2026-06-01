import type { ExampleDesign, ExampleTechnique } from '@/features/bin-designer/types/exampleGallery';
import { TECHNIQUE_CONFIG } from '@/features/bin-designer/types/exampleGallery';
import { useTranslation } from '@/i18n';

interface TechniqueFilterPillsProps {
  examples: readonly ExampleDesign[];
  selected: ExampleTechnique | null;
  onChange: (technique: ExampleTechnique | null) => void;
}

export function TechniqueFilterPills({ examples, selected, onChange }: TechniqueFilterPillsProps) {
  const t = useTranslation();

  const techniques = Array.from(new Set(examples.flatMap((e) => e.techniques)));

  return (
    <div
      role="tablist"
      aria-label={t('binExamples.filterByTechnique')}
      className="flex flex-wrap gap-2"
    >
      <button
        type="button"
        role="tab"
        aria-selected={selected === null}
        onClick={() => onChange(null)}
        className={`
          flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium
          transition-all duration-150 whitespace-nowrap
          ${
            selected === null
              ? 'bg-accent text-on-dark shadow-sm'
              : 'bg-surface text-content-secondary hover:text-content hover:bg-surface-hover'
          }
        `}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
          />
        </svg>
        {t('binExamples.all')}
      </button>

      {techniques.map((technique) => {
        const isSelected = selected === technique;
        return (
          <button
            type="button"
            key={technique}
            role="tab"
            aria-selected={isSelected}
            onClick={() => onChange(technique)}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium
              transition-all duration-150 whitespace-nowrap
              ${
                isSelected
                  ? 'bg-accent text-on-dark shadow-sm'
                  : 'bg-surface text-content-secondary hover:text-content hover:bg-surface-hover'
              }
            `}
          >
            {t(TECHNIQUE_CONFIG[technique].labelKey)}
          </button>
        );
      })}
    </div>
  );
}
