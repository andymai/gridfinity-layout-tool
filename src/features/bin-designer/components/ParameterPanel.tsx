/**
 * Scrollable parameter panel containing all bin configuration sections.
 * Each section uses CollapsibleSection for expand/collapse.
 */

import { CollapsibleSection } from '@/shared/components/CollapsibleSection';
import {
  DimensionsSection,
  BaseSection,
  FeaturesSection,
  InsertsSection,
  WallsSection,
  StyleSection,
} from './parameters';
import { PresetSelector } from './parameters/PresetSelector';

/**
 * Renders the parameter panel UI composed of vertically stacked collapsible sections for configuring presets, dimensions, style, base, features, inserts, and walls.
 *
 * @returns The panel's root React element containing the scrollable, sectioned controls.
 */
export function ParameterPanel() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="space-y-5">
          <CollapsibleSection title="Presets" defaultExpanded={false}>
            <PresetSelector />
          </CollapsibleSection>

          <CollapsibleSection title="Dimensions" defaultExpanded>
            <DimensionsSection />
          </CollapsibleSection>

          <CollapsibleSection title="Style" defaultExpanded>
            <StyleSection />
          </CollapsibleSection>

          <CollapsibleSection title="Base">
            <BaseSection />
          </CollapsibleSection>

          <CollapsibleSection title="Features">
            <FeaturesSection />
          </CollapsibleSection>

          <CollapsibleSection title="Inserts">
            <InsertsSection />
          </CollapsibleSection>

          <CollapsibleSection title="Walls" defaultExpanded={false}>
            <WallsSection />
          </CollapsibleSection>
        </div>
      </div>
    </div>
  );
}