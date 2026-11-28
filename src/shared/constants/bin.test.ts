import { it, expect } from 'vitest';

// Some modules under this one import it back through `detachableFeetPlan`. A
// module in that cycle that reads these constants at load time finds them
// unset, and only an entry point that loads this module first shows it.
it('initialises when it is the first module to load', async () => {
  const { GRIDFINITY, DESIGNER_CONSTRAINTS } = await import('./bin');
  expect(GRIDFINITY.GRID_SIZE).toBe(42);
  expect(DESIGNER_CONSTRAINTS.MAX_MAGNET_DIAMETER).toBe(10);
});
