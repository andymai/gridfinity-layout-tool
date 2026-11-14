import type { FeatureFlag } from '@/core/labs';
import { EarlyAccessBadge } from '../EarlyAccessBadge';
import { InfoIcon } from '../icons';
import { Switch } from '@/design-system';
import { useTranslation } from '@/i18n';

interface FeatureCardProps {
  feature: FeatureFlag;
  isEnabled: boolean;
  onToggle: () => void;
}

export function FeatureCard({ feature, isEnabled, onToggle }: FeatureCardProps) {
  const t = useTranslation();

  return (
    <article className="rounded-lg border border-stroke-subtle bg-surface p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="text-title text-content leading-tight">{feature.name}</h3>
        <EarlyAccessBadge />
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

      <div className="flex items-center justify-end">
        <Switch
          checked={isEnabled}
          onChange={onToggle}
          aria-label={t('labs.featureToggle', {
            name: feature.name,
            status: isEnabled ? t('labs.enabled') : t('labs.disabled'),
          })}
        />
      </div>
    </article>
  );
}
