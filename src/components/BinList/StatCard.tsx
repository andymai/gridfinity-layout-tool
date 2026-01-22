import type { ReactNode } from 'react';

export interface StatCardProps {
  /** Icon to display (SVG element) */
  icon: ReactNode;
  /** Label text */
  label: string;
  /** Primary value to display */
  value: string | number;
  /** Optional secondary text (e.g., unit) */
  unit?: string;
  /** Optional tooltip text */
  title?: string;
  /** Color variant for the icon */
  variant?: 'default' | 'success' | 'warning' | 'info';
}

const variantClasses = {
  default: 'text-content-secondary',
  success: 'text-[var(--color-success)]',
  warning: 'text-[var(--color-warning)]',
  info: 'text-[var(--color-info)]',
};

/**
 * Stat card for displaying key metrics in the bin list dashboard.
 * Shows an icon, label, and value in a compact card format.
 */
export function StatCard({ icon, label, value, unit, title, variant = 'default' }: StatCardProps) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-elevated" title={title}>
      <div className={`flex-shrink-0 ${variantClasses[variant]}`}>{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-xs text-content-tertiary truncate">{label}</div>
        <div className="flex items-baseline gap-1">
          <span className="text-lg font-semibold text-content tabular-nums">{value}</span>
          {unit && <span className="text-xs text-content-secondary">{unit}</span>}
        </div>
      </div>
    </div>
  );
}

// === Common Icons for Stats ===

export function BinIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
      />
    </svg>
  );
}

export function FilamentIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}

export function CostIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

export function TimeIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

export function SpoolIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <circle cx="12" cy="12" r="9" strokeWidth={1.5} />
      <circle cx="12" cy="12" r="3" strokeWidth={1.5} />
      <path strokeLinecap="round" strokeWidth={1.5} d="M12 3v6m0 6v6m9-9h-6m-6 0H3" />
    </svg>
  );
}
