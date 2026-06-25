/**
 * Authoritative editor for a selected color zone: the same <ColorPicker> the
 * left panel opens in a popover, rendered inline in the inspector via the
 * shared useColorZoneEditing hook so labels, patches, and recent colors match.
 */

import { ColorPicker } from '@/features/bin-designer/components/panel/ColorsSection/ColorPicker';
import type { ColorZone } from '@/features/bin-designer/types/featureColors';
import { useColorZoneEditing } from './useColorZoneEditing';

export function ColorZoneSelectionEditor({ zone }: { readonly zone: ColorZone }) {
  const editing = useColorZoneEditing(zone);
  return <ColorPicker {...editing} />;
}
