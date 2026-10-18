import { useTranslation } from '@/i18n';
import { InfoDot } from '@/shared/components/InfoDot';

/** A slanted bin too long for the bed: it cannot be split, so the panel only says why. */
export function SlantTooLargeNotice({ width, depth }: { width: number; depth: number }) {
  const t = useTranslation();
  return (
    <p className="text-label leading-relaxed text-warning">
      {t('binDesigner.printFit.slantTooLarge', { width, depth })}
      <span className="ml-1 inline-flex align-middle">
        <InfoDot aria-label={t('binDesigner.infoButton')}>
          <p>{t('binDesigner.printFit.slantTooLargeDetail')}</p>
        </InfoDot>
      </span>
    </p>
  );
}
