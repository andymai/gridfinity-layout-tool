/**
 * Validity derivation for the contextual selection.
 *
 * Compartment ids renumber on every merge/split and divider pairs exist only
 * while their compartments stay adjacent, so a held selection can be orphaned
 * by any external mutation (undo, regrid, an import). Reading through this
 * resolver instead of trusting `ui.selection` keeps the Selection page from
 * editing a compartment that no longer means what the user picked — without
 * store writes at read time.
 */

import type { CompartmentConfig, DesignerSelection } from '../types';
import { getEligibleDividers } from './compartments';

function compartmentExists(config: CompartmentConfig, id: number): boolean {
  return config.cells.includes(id);
}

export function resolveSelection(
  selection: DesignerSelection,
  compartments: CompartmentConfig
): DesignerSelection {
  if (selection === null) return null;
  switch (selection.kind) {
    case 'compartment':
      return compartmentExists(compartments, selection.id) ? selection : null;
    case 'labelTab':
      return compartmentExists(compartments, selection.compartmentId) ? selection : null;
    case 'divider': {
      const valid = getEligibleDividers(compartments).some(
        (d) => `${d.compartmentA}-${d.compartmentB}` === selection.key
      );
      return valid ? selection : null;
    }
  }
}
