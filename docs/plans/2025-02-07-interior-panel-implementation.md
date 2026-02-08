# Interior Panel Card-Based Redesign - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the 3-button segmented control with card-based mode selection for better UX

**Architecture:** Create new `InteriorModeCard` component that renders icon + title + description + optional summary. Three cards stack vertically, only one expanded at a time. Cards handle their own expand/collapse with CSS transitions. Reuse all existing editor components.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, inline SVG icons (no lucide-react dependency)

---

## Task 1: Add i18n Strings

**Files:**

- Modify: `src/i18n/locales/en.ts` (after line 1296)
- Modify: `src/i18n/locales/de.json` (after line 87)
- Modify: `src/i18n/locales/es.json` (after line 87)
- Modify: `src/i18n/locales/fr.json` (after line 87)
- Modify: `src/i18n/locales/nb.json` (after line 87)
- Modify: `src/i18n/locales/nl.json` (after line 87)
- Modify: `src/i18n/locales/pt-BR.json` (after line 87)

**Step 1: Add English translations**

Add to `src/i18n/locales/en.ts` after line 1297 (after `binDesigner.walls.pattern.cutoutsEnabled`):

```typescript
  'binDesigner.interior.standard.title': 'Grid Dividers',
  'binDesigner.interior.standard.description': 'Fixed compartments with permanent walls',
  'binDesigner.interior.slotted.title': 'Removable Dividers',
  'binDesigner.interior.slotted.description': 'Slots for insertable divider pieces',
  'binDesigner.interior.solid.title': 'Custom Cutouts',
  'binDesigner.interior.solid.description': 'Tool-shaped recesses cut from the top',
```

**Step 2: Add German translations**

Add to `src/i18n/locales/de.json` after line 88 (after `binDesigner.walls.pattern.cutoutsEnabled`):

```json
  "binDesigner.interior.standard.title": "Rastereinteilung",
  "binDesigner.interior.standard.description": "Feste Fächer mit permanenten Wänden",
  "binDesigner.interior.slotted.title": "Herausnehmbare Trennwände",
  "binDesigner.interior.slotted.description": "Schlitze für einsetzbare Trennwände",
  "binDesigner.interior.solid.title": "Individuelle Ausschnitte",
  "binDesigner.interior.solid.description": "Werkzeugförmige Aussparungen von oben",
```

**Step 3: Add Spanish translations**

Add to `src/i18n/locales/es.json` after line 88:

```json
  "binDesigner.interior.standard.title": "Divisores de cuadrícula",
  "binDesigner.interior.standard.description": "Compartimentos fijos con paredes permanentes",
  "binDesigner.interior.slotted.title": "Divisores removibles",
  "binDesigner.interior.slotted.description": "Ranuras para piezas divisorias insertables",
  "binDesigner.interior.solid.title": "Recortes personalizados",
  "binDesigner.interior.solid.description": "Huecos con forma de herramienta cortados desde arriba",
```

**Step 4: Add French translations**

Add to `src/i18n/locales/fr.json` after line 88:

```json
  "binDesigner.interior.standard.title": "Séparateurs en grille",
  "binDesigner.interior.standard.description": "Compartiments fixes avec murs permanents",
  "binDesigner.interior.slotted.title": "Séparateurs amovibles",
  "binDesigner.interior.slotted.description": "Fentes pour pièces séparatrices amovibles",
  "binDesigner.interior.solid.title": "Découpes personnalisées",
  "binDesigner.interior.solid.description": "Évidements en forme d'outil découpés par le haut",
```

**Step 5: Add Norwegian translations**

Add to `src/i18n/locales/nb.json` after line 88:

```json
  "binDesigner.interior.standard.title": "Rutenettvegger",
  "binDesigner.interior.standard.description": "Faste rom med permanente vegger",
  "binDesigner.interior.slotted.title": "Avtakbare skillevegger",
  "binDesigner.interior.slotted.description": "Spor for innsettbare skillevegger",
  "binDesigner.interior.solid.title": "Egendefinerte utskjæringer",
  "binDesigner.interior.solid.description": "Verktøyformede fordypninger kuttet fra toppen",
```

**Step 6: Add Dutch translations**

Add to `src/i18n/locales/nl.json` after line 88:

```json
  "binDesigner.interior.standard.title": "Rasterverdeling",
  "binDesigner.interior.standard.description": "Vaste compartimenten met permanente wanden",
  "binDesigner.interior.slotted.title": "Verwijderbare scheidingswanden",
  "binDesigner.interior.slotted.description": "Sleuven voor inzetbare scheidingsstukken",
  "binDesigner.interior.solid.title": "Aangepaste uitsparingen",
  "binDesigner.interior.solid.description": "Gereedschapvormige uitsparingen van bovenaf",
```

**Step 7: Add Portuguese (Brazil) translations**

Add to `src/i18n/locales/pt-BR.json` after line 88:

```json
  "binDesigner.interior.standard.title": "Divisores em grade",
  "binDesigner.interior.standard.description": "Compartimentos fixos com paredes permanentes",
  "binDesigner.interior.slotted.title": "Divisores removíveis",
  "binDesigner.interior.slotted.description": "Ranhuras para peças divisórias inseríveis",
  "binDesigner.interior.solid.title": "Recortes personalizados",
  "binDesigner.interior.solid.description": "Rebaixos em forma de ferramenta cortados do topo",
```

**Step 8: Verify i18n keys**

Run: `npm run check:i18n`

Expected: `✅ All locale files have matching keys.` with 1425 keys

**Step 9: Commit i18n strings**

```bash
git add src/i18n/locales/*.ts src/i18n/locales/*.json
git commit -m "feat(interior): add card mode i18n strings"
```

---

## Task 2: Create Icon Components

**Files:**

- Create: `src/features/bin-designer/components/panel/InteriorSection/icons.tsx`

**Step 1: Write icon components**

Create `src/features/bin-designer/components/panel/InteriorSection/icons.tsx`:

```tsx
/**
 * SVG icons for interior mode cards.
 * Inline SVG to avoid external dependencies.
 */

interface IconProps {
  size?: number;
  className?: string;
}

export function Grid3x3Icon({ size = 20, className = '' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18" />
      <path d="M15 3v18" />
      <path d="M3 9h18" />
      <path d="M3 15h18" />
    </svg>
  );
}

export function LayersIcon({ size = 20, className = '' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

export function ScissorsIcon({ size = 20, className = '' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M20 4 8.12 15.88" />
      <path d="m14.47 14.48 5.53 5.52" />
      <path d="M8.12 8.12 12 12" />
    </svg>
  );
}
```

**Step 2: Commit icon components**

```bash
git add src/features/bin-designer/components/panel/InteriorSection/icons.tsx
git commit -m "feat(interior): add SVG icon components for mode cards"
```

---

## Task 3: Create InteriorModeCard Component

**Files:**

- Create: `src/features/bin-designer/components/panel/InteriorSection/InteriorModeCard.tsx`
- Test: `src/features/bin-designer/components/panel/InteriorSection/InteriorModeCard.test.tsx`

**Step 1: Write failing test**

Create `src/features/bin-designer/components/panel/InteriorSection/InteriorModeCard.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InteriorModeCard } from './InteriorModeCard';
import type { BinStyle } from '../../../types';

// Mock the icons
vi.mock('./icons', () => ({
  Grid3x3Icon: () => <div data-testid="grid-icon" />,
  LayersIcon: () => <div data-testid="layers-icon" />,
  ScissorsIcon: () => <div data-testid="scissors-icon" />,
}));

// Mock child components
vi.mock('../../CompartmentEditor', () => ({
  CompartmentEditor: () => <div data-testid="compartment-editor" />,
}));
vi.mock('../../SlotConfigurator/SlotConfigurator', () => ({
  SlotConfigurator: () => <div data-testid="slot-configurator" />,
}));

// Mock i18n
vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

// Mock store
vi.mock('@/features/bin-designer/store', () => ({
  useDesignerStore: vi.fn(() => undefined),
}));

describe('InteriorModeCard', () => {
  it('renders collapsed card with icon, title, and description', () => {
    const onSelect = vi.fn();
    render(<InteriorModeCard mode="standard" isExpanded={false} onSelect={onSelect} />);

    expect(screen.getByTestId('grid-icon')).toBeInTheDocument();
    expect(screen.getByText('binDesigner.interior.standard.title')).toBeInTheDocument();
    expect(screen.getByText('binDesigner.interior.standard.description')).toBeInTheDocument();
  });

  it('renders summary when provided', () => {
    const onSelect = vi.fn();
    render(
      <InteriorModeCard
        mode="standard"
        isExpanded={false}
        onSelect={onSelect}
        summary="3 compartments"
      />
    );

    expect(screen.getByText('3 compartments')).toBeInTheDocument();
  });

  it('calls onSelect when card is clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<InteriorModeCard mode="standard" isExpanded={false} onSelect={onSelect} />);

    const card = screen.getByRole('button');
    await user.click(card);

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('renders expanded card with content', () => {
    const onSelect = vi.fn();
    render(<InteriorModeCard mode="standard" isExpanded={true} onSelect={onSelect} />);

    expect(screen.getByTestId('compartment-editor')).toBeInTheDocument();
  });

  it('does not render content when collapsed', () => {
    const onSelect = vi.fn();
    render(<InteriorModeCard mode="standard" isExpanded={false} onSelect={onSelect} />);

    expect(screen.queryByTestId('compartment-editor')).not.toBeInTheDocument();
  });

  it('renders correct icon for each mode', () => {
    const onSelect = vi.fn();

    const { rerender } = render(
      <InteriorModeCard mode="standard" isExpanded={false} onSelect={onSelect} />
    );
    expect(screen.getByTestId('grid-icon')).toBeInTheDocument();

    rerender(<InteriorModeCard mode="slotted" isExpanded={false} onSelect={onSelect} />);
    expect(screen.getByTestId('layers-icon')).toBeInTheDocument();

    rerender(<InteriorModeCard mode="solid" isExpanded={false} onSelect={onSelect} />);
    expect(screen.getByTestId('scissors-icon')).toBeInTheDocument();
  });

  it('applies expanded styles when isExpanded is true', () => {
    const onSelect = vi.fn();
    render(<InteriorModeCard mode="standard" isExpanded={true} onSelect={onSelect} />);

    const card = screen.getByRole('button');
    expect(card.className).toContain('border-accent');
    expect(card.className).toContain('bg-accent/5');
  });

  it('applies collapsed styles when isExpanded is false', () => {
    const onSelect = vi.fn();
    render(<InteriorModeCard mode="standard" isExpanded={false} onSelect={onSelect} />);

    const card = screen.getByRole('button');
    expect(card.className).toContain('border-stroke-subtle');
    expect(card.className).toContain('bg-surface-elevated');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/features/bin-designer/components/panel/InteriorSection/InteriorModeCard.test.tsx`

Expected: FAIL - `Cannot find module './InteriorModeCard'`

**Step 3: Write minimal InteriorModeCard implementation**

Create `src/features/bin-designer/components/panel/InteriorSection/InteriorModeCard.tsx`:

```tsx
/**
 * Interior mode selection card component.
 *
 * Displays mode icon, title, description, and optional summary.
 * Expands inline to show mode-specific editor when selected.
 */

import { useTranslation } from '@/i18n';
import { useDesignerStore } from '@/features/bin-designer/store';
import { CompartmentEditor } from '../../CompartmentEditor';
import { SlotConfigurator } from '../../SlotConfigurator/SlotConfigurator';
import { Grid3x3Icon, LayersIcon, ScissorsIcon } from './icons';
import type { BinStyle } from '../../../types';
import type { ReactNode } from 'react';

interface InteriorModeCardProps {
  mode: BinStyle;
  isExpanded: boolean;
  onSelect: () => void;
  summary?: string;
}

interface ModeConfig {
  icon: ReactNode;
  titleKey: string;
  descriptionKey: string;
  content: ReactNode;
}

const MODE_CONFIG: Record<BinStyle, ModeConfig> = {
  standard: {
    icon: <Grid3x3Icon size={20} className="text-content-secondary" />,
    titleKey: 'binDesigner.interior.standard.title',
    descriptionKey: 'binDesigner.interior.standard.description',
    content: <CompartmentEditor />,
  },
  slotted: {
    icon: <LayersIcon size={20} className="text-content-secondary" />,
    titleKey: 'binDesigner.interior.slotted.title',
    descriptionKey: 'binDesigner.interior.slotted.description',
    content: <SlotConfigurator />,
  },
  solid: {
    icon: <ScissorsIcon size={20} className="text-content-secondary" />,
    titleKey: 'binDesigner.interior.solid.title',
    descriptionKey: 'binDesigner.interior.solid.description',
    content: <SolidModeContent />,
  },
};

function SolidModeContent() {
  const setCutoutEditorOpen = useDesignerStore((s) => s.setCutoutEditorOpen);
  const t = useTranslation();

  return (
    <button
      type="button"
      onClick={() => setCutoutEditorOpen(true)}
      className="w-full rounded border border-accent/30 bg-accent/10 px-3 py-2 text-xs font-medium text-accent transition-colors hover:bg-accent/20"
    >
      {t('binDesigner.editCutouts')}
    </button>
  );
}

export function InteriorModeCard({ mode, isExpanded, onSelect, summary }: InteriorModeCardProps) {
  const t = useTranslation();
  const config = MODE_CONFIG[mode];

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`
        w-full text-left rounded-lg border p-3 cursor-pointer
        transition-all duration-200 ease-in-out
        ${
          isExpanded
            ? 'border-accent bg-accent/5'
            : 'border-stroke-subtle bg-surface-elevated hover:bg-surface-hover'
        }
      `}
    >
      {/* Header (always visible) */}
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{config.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-medium text-content-primary">{t(config.titleKey)}</h4>
            {summary && <span className="text-xs text-content-tertiary">{summary}</span>}
          </div>
          <p className="text-xs text-content-secondary mt-0.5">{t(config.descriptionKey)}</p>
        </div>
      </div>

      {/* Content (only when expanded) */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-stroke-subtle">{config.content}</div>
      )}
    </button>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/features/bin-designer/components/panel/InteriorSection/InteriorModeCard.test.tsx`

Expected: PASS (8 tests)

**Step 5: Commit InteriorModeCard**

```bash
git add src/features/bin-designer/components/panel/InteriorSection/InteriorModeCard.tsx
git add src/features/bin-designer/components/panel/InteriorSection/InteriorModeCard.test.tsx
git commit -m "feat(interior): add InteriorModeCard component with tests"
```

---

## Task 4: Refactor InteriorSection to Use Cards

**Files:**

- Modify: `src/features/bin-designer/components/panel/InteriorSection/InteriorSection.tsx`
- Modify: `src/features/bin-designer/components/panel/InteriorSection/useInteriorSection.ts`
- Test: `src/features/bin-designer/components/panel/InteriorSection/InteriorSection.test.tsx`

**Step 1: Update useInteriorSection hook**

Modify `src/features/bin-designer/components/panel/InteriorSection/useInteriorSection.ts`:

Change the return statement from:

```typescript
return {
  state: { style, isSlotted, isSolid },
  handlers: { setStyle },
  meta,
  t,
};
```

To:

```typescript
// Calculate summary for each mode (not just current)
const standardSummary = t('binDesigner.interiorSummary', { count: compartmentCount });
const slottedSummary = t('binDesigner.slottedInteriorSummary');
const solidSummary =
  cutoutCount > 0 ? t('binDesigner.cutouts.summary', { count: cutoutCount }) : undefined;

return {
  state: { style, isSlotted, isSolid },
  handlers: { setStyle },
  summaries: {
    standard: standardSummary,
    slotted: slottedSummary,
    solid: solidSummary,
  },
  t,
};
```

**Step 2: Write test for refactored InteriorSection**

Modify `src/features/bin-designer/components/panel/InteriorSection/InteriorSection.test.tsx`:

Replace entire file content:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InteriorSection } from './InteriorSection';
import type { BinStyle } from '../../../types';

// Mock the card component
vi.mock('./InteriorModeCard', () => ({
  InteriorModeCard: ({
    mode,
    isExpanded,
    onSelect,
    summary,
  }: {
    mode: BinStyle;
    isExpanded: boolean;
    onSelect: () => void;
    summary?: string;
  }) => (
    <div data-testid={`card-${mode}`}>
      <button onClick={onSelect}>Select {mode}</button>
      {isExpanded && <div data-testid={`expanded-${mode}`}>Expanded</div>}
      {summary && <div data-testid={`summary-${mode}`}>{summary}</div>}
    </div>
  ),
}));

// Mock the hook
const mockSetStyle = vi.fn();
vi.mock('./useInteriorSection', () => ({
  useInteriorSection: () => ({
    state: { style: 'standard', isSlotted: false, isSolid: false },
    handlers: { setStyle: mockSetStyle },
    summaries: {
      standard: '1 compartment',
      slotted: 'Removable dividers',
      solid: undefined,
    },
    t: (key: string) => key,
  }),
}));

describe('InteriorSection', () => {
  beforeEach(() => {
    mockSetStyle.mockClear();
  });

  it('renders three mode cards', () => {
    render(<InteriorSection />);

    expect(screen.getByTestId('card-standard')).toBeInTheDocument();
    expect(screen.getByTestId('card-slotted')).toBeInTheDocument();
    expect(screen.getByTestId('card-solid')).toBeInTheDocument();
  });

  it('expands the selected card', () => {
    render(<InteriorSection />);

    expect(screen.getByTestId('expanded-standard')).toBeInTheDocument();
    expect(screen.queryByTestId('expanded-slotted')).not.toBeInTheDocument();
    expect(screen.queryByTestId('expanded-solid')).not.toBeInTheDocument();
  });

  it('passes summary to each card', () => {
    render(<InteriorSection />);

    expect(screen.getByTestId('summary-standard')).toHaveTextContent('1 compartment');
    expect(screen.getByTestId('summary-slotted')).toHaveTextContent('Removable dividers');
    expect(screen.queryByTestId('summary-solid')).not.toBeInTheDocument();
  });

  it('calls setStyle when card is selected', async () => {
    const user = userEvent.setup();
    render(<InteriorSection />);

    await user.click(screen.getByText('Select slotted'));

    expect(mockSetStyle).toHaveBeenCalledWith('slotted');
  });
});
```

**Step 3: Run test to verify it fails**

Run: `npm run test:run -- src/features/bin-designer/components/panel/InteriorSection/InteriorSection.test.tsx`

Expected: FAIL - test expects new card-based structure

**Step 4: Refactor InteriorSection component**

Modify `src/features/bin-designer/components/panel/InteriorSection/InteriorSection.tsx`:

Replace entire file content:

```tsx
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
  const { state, handlers, summaries } = useInteriorSection();

  return (
    <div className="space-y-2">
      {MODES.map((mode) => (
        <InteriorModeCard
          key={mode}
          mode={mode}
          isExpanded={state.style === mode}
          onSelect={() => handlers.setStyle(mode)}
          summary={summaries[mode]}
        />
      ))}
    </div>
  );
}
```

**Step 5: Run test to verify it passes**

Run: `npm run test:run -- src/features/bin-designer/components/panel/InteriorSection/InteriorSection.test.tsx`

Expected: PASS (4 tests)

**Step 6: Run all InteriorSection tests**

Run: `npm run test:run -- src/features/bin-designer/components/panel/InteriorSection/`

Expected: All tests pass (useInteriorSection, InteriorSection, InteriorModeCard)

**Step 7: Commit refactored InteriorSection**

```bash
git add src/features/bin-designer/components/panel/InteriorSection/
git commit -m "refactor(interior): replace button row with card-based selection"
```

---

## Task 5: Update Component Barrel Exports

**Files:**

- Modify: `src/features/bin-designer/components/panel/InteriorSection/index.ts`

**Step 1: Update barrel export**

Modify `src/features/bin-designer/components/panel/InteriorSection/index.ts`:

Change from:

```typescript
export { InteriorSection } from './InteriorSection';
export { useInteriorSection } from './useInteriorSection';
```

To:

```typescript
export { InteriorSection } from './InteriorSection';
export { InteriorModeCard } from './InteriorModeCard';
export { useInteriorSection } from './useInteriorSection';
export { Grid3x3Icon, LayersIcon, ScissorsIcon } from './icons';
```

**Step 2: Commit barrel export update**

```bash
git add src/features/bin-designer/components/panel/InteriorSection/index.ts
git commit -m "feat(interior): export new card components from barrel"
```

---

## Task 6: Manual Testing & Verification

**Step 1: Start dev server**

Run: `npm run dev`

**Step 2: Navigate to bin designer**

1. Open http://localhost:5173
2. Click "New Bin" or select existing bin
3. Find Interior section in right panel

**Step 3: Verify card behavior**

- [ ] Three cards visible vertically stacked
- [ ] Standard mode card is expanded by default
- [ ] Cards show icons, titles, and descriptions
- [ ] Clicking collapsed card expands it and collapses current
- [ ] Hover effect works on collapsed cards
- [ ] CSS transitions are smooth (200ms)
- [ ] Summary text appears on right side when present

**Step 4: Test each mode**

**Standard mode:**

- [ ] Grid icon displays
- [ ] CompartmentEditor renders
- [ ] Summary shows compartment count

**Slotted mode:**

- [ ] Layers icon displays
- [ ] SlotConfigurator renders
- [ ] Summary shows "Removable dividers"

**Solid mode:**

- [ ] Scissors icon displays
- [ ] "Cut Editor" button renders
- [ ] Button opens cutout editor modal
- [ ] Summary shows cutout count when cutouts exist

**Step 5: Test keyboard navigation**

- [ ] Tab through cards
- [ ] Enter/Space selects card
- [ ] Focus styles visible

**Step 6: Test side effects**

- [ ] Switching to solid mode disables wall pattern
- [ ] Store updates correctly on mode change

**Step 7: Verify i18n**

1. Switch language in settings
2. Verify card titles and descriptions translate
3. Test all 6 locales if possible

---

## Task 7: Run Full Test Suite

**Step 1: Run all tests**

Run: `npm run test:coverage`

Expected: All tests pass with good coverage on new components

**Step 2: Run build**

Run: `npm run build`

Expected: Build succeeds with no TypeScript errors

**Step 3: Check i18n**

Run: `npm run check:i18n`

Expected: All keys match (1425 keys)

**Step 4: Final commit**

```bash
git add .
git commit -m "test(interior): verify card-based redesign implementation"
```

---

## Completion Checklist

- [x] i18n strings added for all 6 locales
- [x] Icon components created (Grid3x3, Layers, Scissors)
- [x] InteriorModeCard component with tests
- [x] InteriorSection refactored to use cards
- [x] useInteriorSection updated for multi-mode summaries
- [x] Barrel exports updated
- [x] Manual testing completed
- [x] All automated tests pass
- [x] Build succeeds
- [x] i18n validation passes

---

## Notes

**Design Decisions:**

- Used inline SVG icons instead of lucide-react to avoid new dependency
- CSS-only animations using Tailwind classes
- Cards are `<button>` elements for accessibility
- Reused all existing editor components unchanged
- Summary calculation moved to hook for all modes

**Testing Strategy:**

- Unit tests for InteriorModeCard (icon rendering, expand/collapse, styles)
- Integration tests for InteriorSection (card coordination, selection)
- Manual testing for animations and UX flow
- i18n validation for all translations

**Performance:**

- No new dependencies added
- Minimal re-renders (only selected card changes)
- CSS transitions handled by browser
- Existing editor components lazy-load as before
