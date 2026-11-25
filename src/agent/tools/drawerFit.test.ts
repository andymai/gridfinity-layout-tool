import { describe, expect, it } from 'vitest';
import { drawerFitInput } from '../contract/drawerFit';
import { runDrawerFit } from './drawerFit';

const context = { origin: 'https://example.test' };

describe('runDrawerFit', () => {
  it('links to the origin that the door passes', () => {
    const result = runDrawerFit({ widthMm: 400, depthMm: 300 }, context);
    expect(result.isError).toBe(false);
    expect(result.content).toContain('https://example.test/?drawer=400x300');
  });

  // Ask AI runs each earlier tool call again on every request, so the prompt
  // cache holds only when a call gives the same bytes each time.
  it('gives the same bytes for the same input', () => {
    const input = drawerFitInput.parse({ widthMm: 15.5, depthMm: 21, heightMm: 4, unit: 'in' });
    expect(runDrawerFit(input, context)).toEqual(runDrawerFit(input, context));
  });
});
