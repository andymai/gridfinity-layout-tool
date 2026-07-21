import { describe, it, expect } from 'vitest';
import { createGridMotif } from './gridMotif';

describe('createGridMotif', () => {
  it('rejects invalid strut/cell dimensions', () => {
    expect(() => createGridMotif({ cellSize: 0, strutWidth: 1, mode: 'lattice' })).toThrow();
    expect(() => createGridMotif({ cellSize: 5, strutWidth: 5, mode: 'lattice' })).toThrow();
    expect(() => createGridMotif({ cellSize: 5, strutWidth: 0, mode: 'holes' })).toThrow();
  });

  it('builds a crossing pair of closed strut rectangles', () => {
    const cell = createGridMotif({ cellSize: 10, strutWidth: 2, mode: 'lattice' });
    expect(cell.cellW).toBe(10);
    expect(cell.cellH).toBe(10);
    expect(cell.mode).toBe('lattice');
    expect(cell.boundingRadius).toBe(5);
    const paths = cell.buildCellPaths();
    expect(paths).toHaveLength(2);
    for (const p of paths) {
      expect(p.closed).toBe(true);
      expect(p.segments).toHaveLength(3); // close() adds the 4th edge
    }
  });

  it('carries the requested mode through', () => {
    expect(createGridMotif({ cellSize: 8, strutWidth: 1, mode: 'holes' }).mode).toBe('holes');
  });
});
