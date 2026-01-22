import type { ReactNode } from 'react';

interface SettingsRowProps {
  /** Label text displayed on the left */
  label: string;
  /** Optional tooltip shown on hover */
  tooltip?: string;
  /** Optional unit suffix shown after the input (e.g., "mm") */
  unit?: string;
  /** Input or control element */
  children: ReactNode;
  /** Platform variant affects sizing and spacing */
  variant?: 'desktop' | 'mobile';
  /** Optional id for label htmlFor attribute */
  htmlFor?: string;
}

/**
 * Settings row with label on left and input/control on right.
 * Provides consistent layout for configuration panels.
 */
export function SettingsRow({
  label,
  tooltip,
  unit,
  children,
  variant = 'desktop',
  htmlFor,
}: SettingsRowProps) {
  const isMobile = variant === 'mobile';

  // Sizing based on variant
  const labelClass = isMobile ? 'text-sm text-content-secondary' : 'text-xs text-content-tertiary';
  const gapClass = isMobile ? 'gap-2' : 'gap-1';

  return (
    <div className="flex items-center justify-between">
      {htmlFor ? (
        <label htmlFor={htmlFor} className={labelClass} title={tooltip}>
          {label}
        </label>
      ) : (
        <span className={labelClass} title={tooltip}>
          {label}
        </span>
      )}
      <div className={`flex items-center ${gapClass}`}>
        {children}
        {unit && <span className="text-content-tertiary">{unit}</span>}
      </div>
    </div>
  );
}
