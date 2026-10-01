import { describe, it, expect } from 'vitest';
import { textModeChoices } from './textModeChoices';
import type { TextMode } from '../types';

const BASE: readonly TextMode[] = ['engrave', 'emboss', 'through-cut'];

describe('textModeChoices', () => {
  it('offers flat only to a multi-colour design', () => {
    expect(textModeChoices(BASE, true, 'engrave')).toEqual([...BASE, 'flat']);
    expect(textModeChoices(BASE, false, 'engrave')).toEqual(BASE);
  });

  it('keeps flat listed while it is the selected mode', () => {
    expect(textModeChoices(BASE, false, 'flat')).toEqual([...BASE, 'flat']);
  });

  it('does not list flat twice', () => {
    expect(textModeChoices([...BASE, 'flat'], true, 'flat')).toEqual([...BASE, 'flat']);
  });
});
