import type { ReactNode } from 'react';
import { useTranslation } from '@/i18n';
import { InfoDot } from './InfoDot';

/** An info dot named for the control it explains, for a label's slot. */
export function LabelInfo({ label, children }: { label: string; children: ReactNode }) {
  const t = useTranslation();
  return (
    <InfoDot aria-label={t('common.aboutLabel', { label })}>
      {typeof children === 'string' ? <p>{children}</p> : children}
    </InfoDot>
  );
}
