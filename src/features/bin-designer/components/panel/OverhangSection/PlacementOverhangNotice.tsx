import { Fragment } from 'react';
import { Alert, InfoIcon } from '@/design-system';
import { useTranslation } from '@/i18n';
import { formatMm } from '@/shared/utils/format';
import { usePlacementOverhang } from './usePlacementOverhang';

/** Read-only readout of the overhang the layout bin prints with in place of the design's own. */
export function PlacementOverhangNotice() {
  const t = useTranslation();
  const placement = usePlacementOverhang();
  if (!placement) return null;

  return (
    <Alert
      intent="info"
      title={t('binDesigner.overhang.placement.title')}
      icon={<InfoIcon size="xs" className="mt-0.5" />}
    >
      <p className="text-label leading-relaxed text-content-secondary">
        {placement.source === 'expandToFit'
          ? t('binDesigner.overhang.placement.expandToFitHint')
          : t('binDesigner.overhang.placement.marginHint')}
      </p>
      <dl className="mt-1.5 grid grid-cols-[auto_auto] justify-start gap-x-3 gap-y-0.5 text-label">
        {placement.sides.map(({ side, mm }) => (
          <Fragment key={side}>
            <dt className="text-content-secondary">{t(`binDesigner.overhang.side.${side}`)}</dt>
            <dd className="tabular-nums text-content-primary">{formatMm(mm)} mm</dd>
          </Fragment>
        ))}
      </dl>
    </Alert>
  );
}
