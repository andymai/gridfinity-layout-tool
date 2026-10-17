import { defaultFilter } from 'cmdk';
import { describe, expect, it } from 'vitest';
import { commandPaletteFilter, PRE_RANKED_VALUE_PREFIX } from './commandPaletteFilter';

describe('commandPaletteFilter', () => {
  it('scores a pre-ranked item above an exact command match, whatever the query', () => {
    const exact = commandPaletteFilter('zoom', 'zoom');
    expect(commandPaletteFilter(`${PRE_RANKED_VALUE_PREFIX}bin::a`, 'zoom')).toBeGreaterThan(exact);
  });

  it('leaves every other item to cmdk’s own scoring', () => {
    expect(commandPaletteFilter('zoom-in::Zoom in', 'zo', ['view'])).toBe(
      defaultFilter('zoom-in::Zoom in', 'zo', ['view'])
    );
  });
});
