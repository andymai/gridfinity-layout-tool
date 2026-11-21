import { describe, it, expect } from 'vitest';
import { selectedIndices, vertexEditingMode, withSelection } from './vertexEditMode';

describe('vertexEditMode', () => {
  it('opens with nothing selected and the radius it is given', () => {
    expect(vertexEditingMode('p', 15)).toEqual({
      type: 'vertex-editing',
      cutoutId: 'p',
      ring: 0,
      selectedPointIndex: null,
      dragTarget: null,
      falloffMm: 15,
    });
  });

  it('keeps one selected point without a list, and several with one', () => {
    const one = withSelection(vertexEditingMode('p'), 1, [4]);
    expect(one).toMatchObject({ ring: 1, selectedPointIndex: 4, selectedPoints: undefined });
    expect(selectedIndices(one)).toEqual([4]);

    const many = withSelection(one, 1, [2, 4, 6], 2);
    expect(many).toMatchObject({ selectedPointIndex: 2, selectedPoints: [2, 4, 6] });
    expect(selectedIndices(many)).toEqual([2, 4, 6]);
  });

  it('clears the selection with an empty list', () => {
    const none = withSelection(withSelection(vertexEditingMode('p'), 0, [1, 2]), 0, []);
    expect(none).toMatchObject({ selectedPointIndex: null, selectedPoints: undefined });
    expect(selectedIndices(none)).toEqual([]);
  });
});
