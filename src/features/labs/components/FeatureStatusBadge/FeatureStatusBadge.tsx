import type { FeatureStatus } from '@/core/labs';

interface FeatureStatusBadgeProps {
  status: FeatureStatus;
}

const STATUS_CONFIG: Record<FeatureStatus, { label: string; className: string }> = {
  experimental: {
    label: 'Early access',
    className: 'bg-info-muted text-info',
  },
  preview: {
    label: 'Beta',
    className: 'bg-accent/15 text-accent',
  },
  graduated: {
    label: 'Shipped',
    className: 'bg-success-muted text-success',
  },
  deprecated: {
    label: 'Retiring',
    className: 'bg-surface-hover text-content-tertiary',
  },
};

export function FeatureStatusBadge({ status }: FeatureStatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded ${config.className}`}
      aria-label={`Status: ${config.label}`}
    >
      {config.label}
    </span>
  );
}
