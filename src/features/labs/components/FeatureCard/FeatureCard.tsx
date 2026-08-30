import type { ReactNode } from 'react';
import type { FeatureFlag } from '@/core/labs';
import { FeatureStatusBadge } from '../FeatureStatusBadge';
import { InfoIcon } from '../icons';
import { Switch } from '@/design-system';
import { useTranslation } from '@/i18n';

interface FeatureCardProps {
  feature: FeatureFlag;
  isEnabled: boolean;
  onToggle: () => void;
  /** Optional per-feature settings rendered inside the card when enabled. */
  children?: ReactNode;
}

export function FeatureCard({ feature, isEnabled, onToggle, children }: FeatureCardProps) {
  const t = useTranslation();
  const isGraduated = feature.status === 'graduated';
  const isToggleable = !isGraduated;

  return (
    <article className="rounded-lg border border-stroke-subtle bg-surface p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="text-title text-content leading-tight">{feature.name}</h3>
        <FeatureStatusBadge status={feature.status} />
      </div>

      <p className="text-body text-content-secondary leading-relaxed mb-3">{feature.description}</p>

      {feature.warning && (feature.risk === 'medium' || feature.risk === 'high') && (
        <div
          className={`flex items-start gap-2 text-xs p-2.5 rounded mb-3 ${
            feature.risk === 'high' ? 'bg-warning-muted text-warning' : 'bg-info-muted text-info'
          }`}
        >
          <InfoIcon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span className="leading-relaxed">{feature.warning}</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span />

        {isToggleable ? (
          <Switch
            checked={isEnabled}
            onChange={onToggle}
            aria-label={t('labs.featureToggle', {
              name: feature.name,
              status: isEnabled ? t('labs.enabled') : t('labs.disabled'),
            })}
          />
        ) : isGraduated ? (
          <div className="flex items-center gap-2 text-xs text-success">
            <CheckIcon className="w-4 h-4" />
            <span>{t('labs.alwaysOn')}</span>
          </div>
        ) : null}
      </div>

      {children}
    </article>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}
