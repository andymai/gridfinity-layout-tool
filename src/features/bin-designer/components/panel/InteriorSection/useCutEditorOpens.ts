import { useDesignerStore } from '@/features/bin-designer/store';
import { getFeatureStatus } from '@/shared/constraints';
import { useResponsive } from '@/shared/hooks/useResponsive';

export function useCutEditorOpens(): boolean {
  const { isDesktop } = useResponsive();
  const cutoutsAvailable = useDesignerStore((s) => getFeatureStatus(s.params, 'cutouts').available);
  return isDesktop && cutoutsAvailable;
}
