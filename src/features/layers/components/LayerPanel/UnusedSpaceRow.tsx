import { useTranslation } from '@/i18n';

interface UnusedSpaceRowProps {
  unusedHeight: number;
}

/**
 * Dashed-border row showing unused drawer space in the proportional layer stack.
 * Renders at the top of the stack (above all layers) since layers stack bottom-to-top.
 */
export function UnusedSpaceRow({ unusedHeight }: UnusedSpaceRowProps) {
  const t = useTranslation();

  return (
    <div className="flex items-center justify-center h-full border border-dashed border-stroke-subtle rounded bg-surface-elevated/30 text-[10px] text-content-disabled overflow-hidden">
      <span className="tabular-nums truncate px-1">
        {t('layers.unusedSpace', { height: unusedHeight })}
      </span>
    </div>
  );
}
