/**
 * "Extend into drawer margin" toggle for a placed bin (#2462, Labs
 * `layout_overhang`).
 *
 * When a baseplate adds drawer-fit padding, a bin against a padded edge can
 * extend its walls into that margin. The per-bin flag is stored on the Bin; the
 * actual overhang is derived live from the current padding at render/export
 * (see `@/shared/utils/drawerMargin`). The control appears only when the flag is
 * on and the bin abuts a padded edge; it requires a linked design (only linked
 * bins generate geometry), so it's disabled with a hint until one is linked.
 */

import { CheckboxRow } from '@/design-system';
import { useFeatureFlag } from '@/shared/hooks/useFeatureFlag';
import { useMutations } from '@/shared/contexts/MutationsContext';
import { binCanExtendToMargin } from '@/shared/utils/drawerMargin';
import { useTranslation } from '@/i18n';
import type { Bin, Drawer, StoredBaseplateParams } from '@/core/types';

interface ExtendToMarginToggleProps {
  bin: Bin;
  drawer: Drawer;
  baseplate: StoredBaseplateParams | undefined;
}

export function ExtendToMarginToggle({ bin, drawer, baseplate }: ExtendToMarginToggleProps) {
  const t = useTranslation();
  const flagOn = useFeatureFlag('layout_overhang');
  const { updateBin } = useMutations();

  // No control for interior bins or drawers with no margin — nothing to fill.
  if (!flagOn || !binCanExtendToMargin(bin, drawer, baseplate)) return null;

  const linked = bin.linkedDesignId !== undefined;

  return (
    <div>
      <CheckboxRow
        label={t('inspector.extendToMargin')}
        checked={linked && bin.extendToMargin === true}
        disabled={!linked}
        onChange={(checked) => updateBin(bin.id, { extendToMargin: checked })}
      />
      <p className="mt-1 px-2 text-[10px] leading-snug text-content-disabled">
        {linked ? t('inspector.extendToMargin.hint') : t('inspector.extendToMargin.needsLink')}
      </p>
    </div>
  );
}
