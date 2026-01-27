/**
 * Parameter panel for the bin designer.
 *
 * Scrollable container composing collapsible sections for all bin parameters.
 * Sections are independently subscribed to the store for minimal re-renders.
 *
 * Layout:
 * - Dimensions (expanded) — Width, Depth, Height
 * - Base (expanded) — Magnets, Screws, Stacking lip
 * - Walls (expanded) — Wall thickness
 * - Interior (expanded) — Compartments
 * - Physical Units — Grid unit size (mm)
 */

import { DimensionsSection } from './panel/DimensionsSection';
import { BaseSection } from './panel/BaseSection';
import { InteriorSection } from './panel/InteriorSection';
import { WallsSection } from './panel/WallsSection';
import { PhysicalUnitsSection } from './panel/PhysicalUnitsSection';

export function ParameterPanel() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="px-4 py-4 border-b border-stroke-subtle">
          <DimensionsSection />
        </div>
        <div className="px-4 py-4 border-b border-stroke-subtle">
          <BaseSection />
        </div>
        <div className="px-4 py-4 border-b border-stroke-subtle">
          <WallsSection />
        </div>
        <div className="px-4 py-4 border-b border-stroke-subtle">
          <InteriorSection />
        </div>
        <div className="px-4 py-4">
          <PhysicalUnitsSection />
        </div>
      </div>
    </div>
  );
}
