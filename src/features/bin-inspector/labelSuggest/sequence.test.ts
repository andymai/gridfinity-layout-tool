import { describe, it, expect } from 'vitest';
import { detectSequenceSuggestions } from './sequence';

describe('detectSequenceSuggestions', () => {
  it('predicts the next entry in a simple numeric series', () => {
    const preds = detectSequenceSuggestions(['M3 screws', 'M4 screws', 'M5 screws']);
    expect(preds.map((p) => p.value)).toContain('M6 screws');
  });

  it('continues a "Drawer N" series', () => {
    const preds = detectSequenceSuggestions(['Drawer 1', 'Drawer 2']);
    expect(preds[0]?.value).toBe('Drawer 3');
  });

  it('preserves zero-padding when every source number shares a width', () => {
    const preds = detectSequenceSuggestions(['Bay 01', 'Bay 02']);
    expect(preds[0]?.value).toBe('Bay 03');
  });

  it('infers a non-unit step from the series', () => {
    const preds = detectSequenceSuggestions(['6mm', '8mm', '10mm']);
    expect(preds.map((p) => p.value)).toContain('12mm');
  });

  it('extends past the largest existing number', () => {
    const preds = detectSequenceSuggestions(['M3 screws', 'M4 screws', 'M5 screws', 'M6 screws']);
    expect(preds.map((p) => p.value)).toContain('M7 screws');
    expect(preds.map((p) => p.value)).not.toContain('M6 screws');
  });

  it('returns nothing for a single labeled item', () => {
    expect(detectSequenceSuggestions(['M3 screws'])).toEqual([]);
  });

  it('returns nothing when no labels contain numbers', () => {
    expect(detectSequenceSuggestions(['screws', 'bolts', 'nuts'])).toEqual([]);
  });

  it('ignores empty and whitespace labels', () => {
    const preds = detectSequenceSuggestions(['Slot 1', '', '   ', 'Slot 2']);
    expect(preds[0]?.value).toBe('Slot 3');
  });
});
