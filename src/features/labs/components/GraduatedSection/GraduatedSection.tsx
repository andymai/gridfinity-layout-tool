import { useState } from 'react';
import type { FeatureFlag } from '@/core/labs';
import { useTranslation } from '@/i18n';

interface GraduatedSectionProps {
  features: FeatureFlag[];
}

export function GraduatedSection({ features }: GraduatedSectionProps) {
  const t = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  if (features.length === 0) return null;

  return (
    <section className="mt-6 pt-4 border-t border-dashed border-stroke-subtle">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 w-full text-left text-sm font-medium text-content-secondary hover:text-content transition-colors"
        aria-expanded={isExpanded}
      >
        <ChevronIcon
          className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
        />
        <span>{t('labs.whatsNew', { count: features.length })}</span>
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-2">
          {features.map((feature) => (
            <div
              key={feature.id}
              className="flex items-start gap-2 p-3 rounded-lg bg-surface border border-stroke-subtle"
            >
              <CheckCircleIcon className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-medium text-content">{feature.name}</div>
                <div className="text-xs text-success mt-0.5">
                  {t('labs.nowAvailableToEveryone')}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}
