import { useLayoutStore } from '@/core/store/layout';
import type { StoredBaseplateParams } from '@/core/types';
import { Button } from '@/design-system';
import { useTranslation } from '@/i18n';
import { formatMm } from '@/shared/utils/format';
import { fitPaddingToDrawer, plateDrawerOverflow } from '../../utils/fitPaddingToDrawer';
import { updateBaseplateParams } from './panelState';

interface MeasuredDrawerOverflowProps {
  readonly baseplateParams: StoredBaseplateParams;
  readonly gridWidthMm: number;
  readonly gridDepthMm: number;
  readonly outerWidthMm: number;
  readonly outerDepthMm: number;
}

export function MeasuredDrawerOverflow({
  baseplateParams,
  gridWidthMm,
  gridDepthMm,
  outerWidthMm,
  outerDepthMm,
}: MeasuredDrawerOverflowProps) {
  const t = useTranslation();
  const measured = useLayoutStore((s) => s.layout.drawer.measuredMm);
  if (measured === undefined) return null;

  const overflow = plateDrawerOverflow(outerWidthMm, outerDepthMm, measured);
  if (overflow === null) return null;

  const fitted = fitPaddingToDrawer(baseplateParams, gridWidthMm, gridDepthMm, measured);
  const paddingChanges =
    fitted.paddingLeft !== baseplateParams.paddingLeft ||
    fitted.paddingRight !== baseplateParams.paddingRight ||
    fitted.paddingFront !== baseplateParams.paddingFront ||
    fitted.paddingBack !== baseplateParams.paddingBack;

  return (
    <div role="status" className="space-y-1.5">
      <p className="text-center text-micro text-warning tabular-nums">
        {t('baseplate.drawerOverflow', {
          width: formatMm(overflow.widthMm),
          depth: formatMm(overflow.depthMm),
          drawerWidth: formatMm(measured.width),
          drawerDepth: formatMm(measured.depth),
        })}
      </p>
      {paddingChanges && (
        <Button
          variant="secondary"
          fullWidth
          type="button"
          className="h-7 text-xs"
          onClick={() =>
            updateBaseplateParams({
              paddingLeft: fitted.paddingLeft,
              paddingRight: fitted.paddingRight,
              paddingFront: fitted.paddingFront,
              paddingBack: fitted.paddingBack,
            })
          }
        >
          {t('baseplate.fitPaddingToDrawer')}
        </Button>
      )}
    </div>
  );
}
