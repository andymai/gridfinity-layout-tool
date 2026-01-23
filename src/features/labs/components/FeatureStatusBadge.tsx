import type { FeatureStatus } from '@/core/labs';

interface FeatureStatusBadgeProps {
  status: FeatureStatus;
}

const STATUS_CONFIG: Record<FeatureStatus, { label: string; className: string }> = {
  experimental: {
    label: 'Experimental',
    className: 'bg-warning-muted text-warning',
  },
  preview: {
    label: 'Preview',
    className: 'bg-info-muted text-info',
  },
  graduated: {
    label: 'Graduated',
    className: 'bg-success-muted text-success',
  },
  deprecated: {
    label: 'Deprecated',
    className: 'bg-gray-500/15 text-gray-500',
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
