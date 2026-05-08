import { describe, it, expect } from 'vitest';
import { resolveConnectorStyle } from './bin';

describe('resolveConnectorStyle', () => {
  it('returns explicit `connectorStyle` when set', () => {
    expect(resolveConnectorStyle({ connectorStyle: 'snap' })).toBe('snap');
    expect(resolveConnectorStyle({ connectorStyle: 'dovetail' })).toBe('dovetail');
    expect(resolveConnectorStyle({ connectorStyle: 'none' })).toBe('none');
  });

  it("legacy `connectorNubs: true` migrates to 'dovetail' when style is unset", () => {
    expect(resolveConnectorStyle({ connectorNubs: true })).toBe('dovetail');
  });

  it('explicit style wins over legacy field (newer write takes precedence)', () => {
    expect(resolveConnectorStyle({ connectorStyle: 'snap', connectorNubs: true })).toBe('snap');
    expect(resolveConnectorStyle({ connectorStyle: 'none', connectorNubs: true })).toBe('none');
  });

  it("defaults to 'none' when neither is set", () => {
    expect(resolveConnectorStyle({})).toBe('none');
    expect(resolveConnectorStyle({ connectorNubs: false })).toBe('none');
  });
});
