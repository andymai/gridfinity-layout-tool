import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { BinScrollPanel } from './BinScrollPanel';
import { GROUP_OF_CONTROL } from './groupControls';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DESIGNER_SETTINGS } from '@/features/bin-designer/settingsManifest';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

describe('BinScrollPanel', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
      ui: { ...DEFAULT_UI_STATE },
    });
  });

  it('shows the five groups, top to bottom', () => {
    const { getByText } = render(<BinScrollPanel frame="plain" />);
    for (const group of ['shape', 'lid', 'interior', 'base', 'finishing']) {
      expect(getByText(`binDesigner.group.${group}`)).toBeTruthy();
    }
  });

  it('reads down the part: dimensions first, then lid, interior, base, finishing', () => {
    const { container } = render(<BinScrollPanel frame="plain" />);
    const targets = Array.from(container.querySelectorAll('[data-help-target]')).map((el) =>
      el.getAttribute('data-help-target')
    );
    const order = ['bd-dimensions', 'bd-lid', 'bd-interior', 'bd-base', 'bd-colors'];
    const positions = order.map((target) => targets.indexOf(target));
    expect(
      positions.every((p) => p >= 0),
      `present in ${targets.join()}`
    ).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('keeps split out of the scroll until the bin overflows the bed', () => {
    const { container } = render(<BinScrollPanel frame="plain" />);
    expect(container.querySelector('[data-help-target="bd-print-fit"]')).toBeNull();
  });

  it('hides typography until the design carries text', () => {
    const { container } = render(<BinScrollPanel frame="plain" />);
    expect(container.querySelector('[data-help-target="bd-type"]')).toBeNull();
  });

  it('maps exactly the settings-manifest controls to a group (help-jump completeness)', () => {
    // A control the manifest knows but this map omits fails to open its group on
    // a help deep-link; a stale key here is a typo. Parity catches both.
    const manifest = DESIGNER_SETTINGS.map((entry) => entry.controlId).sort();
    const mapped = Object.keys(GROUP_OF_CONTROL).sort();
    expect(mapped).toEqual(manifest);
  });

  it('shows typography once the design carries text', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        compartments: { ...DEFAULT_BIN_PARAMS.compartments, compartmentTexts: ['A'] },
      },
    });
    const { container } = render(<BinScrollPanel frame="plain" />);
    expect(container.querySelector('[data-help-target="bd-type"]')).not.toBeNull();
  });
});
