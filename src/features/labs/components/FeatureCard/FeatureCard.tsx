import type { FeatureFlag } from '@/core/labs';
import { FeatureStatusBadge } from '../FeatureStatusBadge';
import { SparklesIcon } from '../icons';
import { useTranslation } from '@/i18n';

interface FeatureCardProps {
  feature: FeatureFlag;
  isEnabled: boolean;
  onToggle: () => void;
}

export function FeatureCard({ feature, isEnabled, onToggle }: FeatureCardProps) {
  const t = useTranslation();
  const isGraduated = feature.status === 'graduated';
  const isDeprecated = feature.status === 'deprecated';
  const isComingSoon = feature.comingSoon === true;
  const isToggleable = !isGraduated && !isDeprecated && !isComingSoon;

  return (
    <article
      className={`rounded-lg border border-stroke-subtle bg-surface p-4 ${isComingSoon ? 'opacity-75' : ''}`}
    >
      {/* Header: Title + Status */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="text-[15px] font-semibold text-content leading-tight">{feature.name}</h3>
        {isComingSoon ? (
          <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded bg-purple-500/15 text-purple-400">
            {t('labs.comingSoon')}
          </span>
        ) : (
          <FeatureStatusBadge status={feature.status} />
        )}
      </div>

      {/* Description */}
      <p className="text-[13px] text-content-secondary leading-relaxed mb-3">
        {feature.description}
      </p>

      {/* Info note (for medium/high risk) - hide for coming soon */}
      {!isComingSoon &&
        feature.warning &&
        (feature.risk === 'medium' || feature.risk === 'high') && (
          <div
            className={`flex items-start gap-2 text-xs p-2.5 rounded mb-3 ${
              feature.risk === 'high' ? 'bg-warning-muted text-warning' : 'bg-info-muted text-info'
            }`}
          >
            <InfoIcon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span className="leading-relaxed">{feature.warning}</span>
          </div>
        )}

      {/* Footer: Learn more + Toggle */}
      <div className="flex items-center justify-between">
        {feature.learnMoreUrl && !isComingSoon ? (
          <a
            href={feature.learnMoreUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-accent hover:underline flex items-center gap-1"
          >
            {t('labs.learnMore')}
            <ExternalLinkIcon className="w-3 h-3" />
          </a>
        ) : (
          <span />
        )}

        {/* Toggle Switch or Coming Soon indicator */}
        {isComingSoon ? (
          <div className="flex items-center gap-2 text-xs text-purple-400">
            <SparklesIcon className="w-4 h-4" />
            <span>{t('labs.inDevelopment')}</span>
          </div>
        ) : isToggleable ? (
          <button
            type="button"
            role="switch"
            aria-checked={isEnabled}
            aria-label={t('labs.featureToggle', {
              name: feature.name,
              status: isEnabled ? t('labs.enabled') : t('labs.disabled'),
            })}
            onClick={onToggle}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface ${
              isEnabled ? 'bg-accent' : 'bg-surface-secondary border border-stroke'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${
                isEnabled ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        ) : isGraduated ? (
          <div className="flex items-center gap-2 text-xs text-success">
            <CheckIcon className="w-4 h-4" />
            <span>{t('labs.alwaysOn')}</span>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}
