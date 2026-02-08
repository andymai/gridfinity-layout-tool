/**
 * Interior section: Card-based mode selector.
 *
 * Three vertically-stacked cards for Fixed (compartment grid),
 * Removable (divider slots), and Cutout (custom shapes) interior styles.
 * Each card shows icon, title, description, and expands inline with controls.
 */

import { InteriorModeCard } from './InteriorModeCard';
import { useInteriorSection } from './useInteriorSection';
import type { BinStyle } from '../../../types';

const MODES: BinStyle[] = ['standard', 'slotted', 'solid'];

export function InteriorSection() {
  const { state, handlers } = useInteriorSection();

  return (
    <div className="space-y-2">
      {MODES.map((mode) => (
        <InteriorModeCard
          key={mode}
          mode={mode}
          isExpanded={state.style === mode}
          onSelect={() => handlers.setStyle(mode)}
        />
      ))}
    </div>
  );
}
