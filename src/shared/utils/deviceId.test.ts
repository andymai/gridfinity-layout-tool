// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { getDeviceId } from './deviceId';

describe('getDeviceId', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns a stable id across calls', () => {
    const first = getDeviceId();
    const second = getDeviceId();
    expect(first).toBe(second);
  });

  it('persists the id to localStorage', () => {
    const id = getDeviceId();
    expect(localStorage.getItem('gridfinity-device-id')).toBe(id);
  });

  it('reuses an existing stored id', () => {
    localStorage.setItem('gridfinity-device-id', 'preexisting-id');
    expect(getDeviceId()).toBe('preexisting-id');
  });
});
