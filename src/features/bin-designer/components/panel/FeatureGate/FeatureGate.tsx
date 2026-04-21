/**
 * Visually de-emphasize and stop accepting input for descendants.
 *
 * `inert` (React 19) removes descendants from the focus order and blocks
 * pointer events without disabling each input individually.
 */

import type { ReactNode } from 'react';

interface FeatureGateProps {
  readonly disabled: boolean;
  readonly reason: string;
  readonly children: ReactNode;
}

export function FeatureGate({ disabled, reason, children }: FeatureGateProps) {
  return (
    <div
      inert={disabled}
      title={disabled ? reason : undefined}
      aria-disabled={disabled}
      className={disabled ? 'opacity-50 cursor-not-allowed' : undefined}
    >
      {children}
    </div>
  );
}
