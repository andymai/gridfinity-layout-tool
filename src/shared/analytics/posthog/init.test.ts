// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { isTrackingOptOut } from './privacy';

describe('isTrackingOptOut', () => {
  const originalDoNotTrack = Object.getOwnPropertyDescriptor(Navigator.prototype, 'doNotTrack');
  const originalGPC = Object.getOwnPropertyDescriptor(Navigator.prototype, 'globalPrivacyControl');

  afterEach(() => {
    // Restore original descriptors
    if (originalDoNotTrack) {
      Object.defineProperty(Navigator.prototype, 'doNotTrack', originalDoNotTrack);
    } else {
      delete (Navigator.prototype as Record<string, unknown>).doNotTrack;
    }
    if (originalGPC) {
      Object.defineProperty(Navigator.prototype, 'globalPrivacyControl', originalGPC);
    } else {
      delete (Navigator.prototype as Record<string, unknown>).globalPrivacyControl;
    }
  });

  function setGPC(value: boolean): void {
    Object.defineProperty(Navigator.prototype, 'globalPrivacyControl', {
      value,
      configurable: true,
    });
  }

  function setDNT(value: string | null): void {
    Object.defineProperty(Navigator.prototype, 'doNotTrack', {
      value,
      configurable: true,
    });
  }

  it('returns false when no signals are set', () => {
    delete (Navigator.prototype as Record<string, unknown>).globalPrivacyControl;
    setDNT(null);
    expect(isTrackingOptOut()).toBe(false);
  });

  it('returns true when GPC is enabled', () => {
    setGPC(true);
    setDNT(null);
    expect(isTrackingOptOut()).toBe(true);
  });

  it('returns false when GPC is explicitly false', () => {
    setGPC(false);
    setDNT(null);
    expect(isTrackingOptOut()).toBe(false);
  });

  it('returns true when legacy DNT is "1"', () => {
    delete (Navigator.prototype as Record<string, unknown>).globalPrivacyControl;
    setDNT('1');
    expect(isTrackingOptOut()).toBe(true);
  });

  it('returns false when DNT is "0"', () => {
    delete (Navigator.prototype as Record<string, unknown>).globalPrivacyControl;
    setDNT('0');
    expect(isTrackingOptOut()).toBe(false);
  });

  it('returns false when DNT is "unspecified"', () => {
    delete (Navigator.prototype as Record<string, unknown>).globalPrivacyControl;
    setDNT('unspecified');
    expect(isTrackingOptOut()).toBe(false);
  });

  it('GPC takes precedence — true even if DNT is "0"', () => {
    setGPC(true);
    setDNT('0');
    expect(isTrackingOptOut()).toBe(true);
  });
});
