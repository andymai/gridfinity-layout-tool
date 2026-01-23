/**
 * Tabbed parameter panel for mobile and tablet layouts.
 *
 * Groups parameter sections into 4 tabs for compact navigation.
 * Touch-friendly with 44px minimum tap targets.
 */

import { useState, type JSX } from 'react';
import {
  DimensionsSection,
  BaseSection,
  FeaturesSection,
  InsertsSection,
  WallsSection,
  StyleSection,
} from './parameters';
import { PresetSelector } from './parameters/PresetSelector';

type DesignerTab = 'shape' | 'base' | 'features' | 'presets';

interface TabConfig {
  readonly id: DesignerTab;
  readonly label: string;
  readonly icon: JSX.Element;
}

const TABS: readonly TabConfig[] = [
  {
    id: 'shape',
    label: 'Shape',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true">
        <rect x="3" y="5" width="10" height="8" strokeWidth="1.5" rx="1" />
        <path d="M5 5V4a1 1 0 011-1h4a1 1 0 011 1v1" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    id: 'base',
    label: 'Base',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true">
        <rect x="3" y="10" width="10" height="3" strokeWidth="1.5" />
        <path d="M5 10V8M8 10V7M11 10V8" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'features',
    label: 'Features',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true">
        <circle cx="8" cy="8" r="5" strokeWidth="1.5" />
        <path d="M8 5v3l2 2" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'presets',
    label: 'Presets',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true">
        <path d="M4 2h8v12l-4-3-4 3V2z" strokeWidth="1.5" />
      </svg>
    ),
  },
];

/**
 * Render a mobile-friendly tabbed parameter panel with four tabs: Shape, Base, Features, and Presets.
 *
 * Displays a touch-optimized tab bar and corresponding scrollable panels, and manages which panel is visible.
 * Panels and tabs include ARIA roles and attributes to support keyboard and assistive-technology navigation.
 */
export function MobileParameterTabs() {
  const [activeTab, setActiveTab] = useState<DesignerTab>('shape');

  return (
    <div className="flex h-full flex-col">
      {/* Tab bar */}
      <div
        className="flex border-b border-stroke-subtle bg-surface-secondary"
        role="tablist"
        aria-label="Parameter sections"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors ${
              activeTab === tab.id
                ? 'border-b-2 border-accent text-accent'
                : 'text-content-secondary hover:text-content'
            }`}
            style={{ minHeight: '44px' }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div
          id="panel-shape"
          role="tabpanel"
          aria-labelledby="tab-shape"
          hidden={activeTab !== 'shape'}
        >
          {activeTab === 'shape' && (
            <div className="space-y-5">
              <DimensionsSection />
              <div className="border-t border-stroke-subtle pt-4">
                <StyleSection />
              </div>
            </div>
          )}
        </div>

        <div
          id="panel-base"
          role="tabpanel"
          aria-labelledby="tab-base"
          hidden={activeTab !== 'base'}
        >
          {activeTab === 'base' && (
            <div className="space-y-5">
              <BaseSection />
              <div className="border-t border-stroke-subtle pt-4">
                <WallsSection />
              </div>
            </div>
          )}
        </div>

        <div
          id="panel-features"
          role="tabpanel"
          aria-labelledby="tab-features"
          hidden={activeTab !== 'features'}
        >
          {activeTab === 'features' && (
            <div className="space-y-5">
              <FeaturesSection />
              <div className="border-t border-stroke-subtle pt-4">
                <InsertsSection />
              </div>
            </div>
          )}
        </div>

        <div
          id="panel-presets"
          role="tabpanel"
          aria-labelledby="tab-presets"
          hidden={activeTab !== 'presets'}
        >
          {activeTab === 'presets' && <PresetSelector />}
        </div>
      </div>
    </div>
  );
}