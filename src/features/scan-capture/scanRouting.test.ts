import { describe, it, expect } from 'vitest';
import { isScanPath, getScanToken } from './scanRouting';

const TOKEN = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

describe('isScanPath', () => {
  it('matches /scan/<token> with and without a trailing slash', () => {
    expect(isScanPath(`/scan/${TOKEN}`)).toBe(true);
    expect(isScanPath(`/scan/${TOKEN}/`)).toBe(true);
  });

  it('rejects other paths', () => {
    expect(isScanPath('/')).toBe(false);
    expect(isScanPath('/scan')).toBe(false);
    expect(isScanPath('/scan/')).toBe(false);
    expect(isScanPath(`/designer/${TOKEN}`)).toBe(false);
    expect(isScanPath(`/scan/${TOKEN}/extra`)).toBe(false);
  });
});

describe('getScanToken', () => {
  it('extracts the token', () => {
    expect(getScanToken(`/scan/${TOKEN}`)).toBe(TOKEN);
    expect(getScanToken(`/scan/${TOKEN}/`)).toBe(TOKEN);
  });

  it('returns null when there is no token', () => {
    expect(getScanToken('/scan')).toBeNull();
    expect(getScanToken('/designer')).toBeNull();
  });
});
