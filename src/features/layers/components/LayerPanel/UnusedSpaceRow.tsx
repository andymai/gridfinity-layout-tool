import { useTranslation } from '@/i18n';

interface UnusedSpaceRowProps {
  unusedHeight: number;
  heightUnitMm: number;
}

/**
 * Dashed-border row showing unused drawer space in the proportional layer stack.
 * Renders at the top of the stack (above all layers) since layers stack bottom-to-top.
 */
export function UnusedSpaceRow({ unusedHeight, heightUnitMm }: UnusedSpaceRowProps) {
  const t = useTranslation();
  const unusedMm = Math.round(unusedHeight * heightUnitMm);

  return (
    <div className="flex items-center justify-center h-full border border-dashed border-stroke-subtle rounded bg-surface-elevated/30 text-[10px] text-content-disabled overflow-hidden">
      <span className="tabular-nums truncate px-1">
        {t('layers.unusedSpace', { height: unusedHeight, mm: unusedMm })}
      </span>
    </div>
  );
}
