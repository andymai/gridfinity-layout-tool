/**
 * Mobile parameter panel — re-uses the tabbed ParameterPanel.
 * Now that we have multiple tabs (Size, Base, Compartments, Walls),
 * the panel handles its own tab switching.
 */

import { ParameterPanel } from './ParameterPanel';

export function MobileParameterTabs() {
  return <ParameterPanel />;
}
