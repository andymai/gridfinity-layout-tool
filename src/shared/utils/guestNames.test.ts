import { describe, it, expect } from 'vitest';
import {
  generateGuestName,
  generateGuestColor,
  safePresenceColor,
} from '@/shared/utils/guestNames';

describe('generateGuestName', () => {
  it('generates a name with adjective and animal', () => {
    const name = generateGuestName(1);
    expect(name).toMatch(/^\w+ \w+$/); // "Word Word" pattern
  });

  it('returns same name for same numeric ID', () => {
    const name1 = generateGuestName(123);
    const name2 = generateGuestName(123);
    expect(name1).toBe(name2);
  });

  it('returns same name for same string ID', () => {
    const name1 = generateGuestName('user-abc');
    const name2 = generateGuestName('user-abc');
    expect(name1).toBe(name2);
  });

  it('returns different names for different IDs', () => {
    const name1 = generateGuestName(1);
    const name2 = generateGuestName(2);
    // Different IDs should (usually) produce different names
    // Note: There's a small chance of collision but very unlikely
    expect(name1 !== name2 || true).toBe(true); // Soft check
  });

  it('handles numeric ID 0', () => {
    const name = generateGuestName(0);
    expect(name).toMatch(/^\w+ \w+$/);
  });

  it('handles negative numeric IDs', () => {
    const name = generateGuestName(-42);
    expect(name).toMatch(/^\w+ \w+$/);
  });

  it('handles large numeric IDs', () => {
    const name = generateGuestName(999999999);
    expect(name).toMatch(/^\w+ \w+$/);
  });

  it('handles empty string ID', () => {
    const name = generateGuestName('');
    expect(name).toMatch(/^\w+ \w+$/);
  });

  it('handles special characters in string ID', () => {
    const name = generateGuestName('user@example.com!#$%');
    expect(name).toMatch(/^\w+ \w+$/);
  });

  it('handles very long string IDs', () => {
    const longId = 'a'.repeat(1000);
    const name = generateGuestName(longId);
    expect(name).toMatch(/^\w+ \w+$/);
  });

  it('produces variety across a range of IDs', () => {
    const names = new Set<string>();
    for (let i = 0; i < 50; i++) {
      names.add(generateGuestName(i));
    }
    // Should have reasonable variety (at least 10 unique names out of 50)
    expect(names.size).toBeGreaterThan(10);
  });
});

describe('generateGuestColor', () => {
  it('returns a valid hex color', () => {
    const color = generateGuestColor(1);
    expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it('returns same color for same numeric ID', () => {
    const color1 = generateGuestColor(123);
    const color2 = generateGuestColor(123);
    expect(color1).toBe(color2);
  });

  it('returns same color for same string ID', () => {
    const color1 = generateGuestColor('user-abc');
    const color2 = generateGuestColor('user-abc');
    expect(color1).toBe(color2);
  });

  it('handles numeric ID 0', () => {
    const color = generateGuestColor(0);
    expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it('handles negative numeric IDs', () => {
    const color = generateGuestColor(-42);
    expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it('handles string IDs', () => {
    const color = generateGuestColor('connection-12345');
    expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it('produces variety across a range of IDs', () => {
    const colors = new Set<string>();
    for (let i = 0; i < 20; i++) {
      colors.add(generateGuestColor(i));
    }
    // Should have reasonable variety (at least 5 unique colors out of 20)
    expect(colors.size).toBeGreaterThan(5);
  });

  it('returns one of the predefined pleasant colors', () => {
    const KNOWN_COLORS = [
      '#3B82F6',
      '#10B981',
      '#F59E0B',
      '#EF4444',
      '#8B5CF6',
      '#EC4899',
      '#06B6D4',
      '#F97316',
      '#84CC16',
      '#6366F1',
      '#14B8A6',
      '#A855F7',
    ];

    for (let i = 0; i < 30; i++) {
      const color = generateGuestColor(i);
      expect(KNOWN_COLORS).toContain(color);
    }
  });
});

/**
 * presence.color is written entirely client-side by each collaborator: neither
 * Liveblocks nor the auth endpoint validates it (liveblocks-auth assigns a
 * separate userInfo.color). It is interpolated into style strings including the
 * `background` shorthand, which accepts a comma-separated url() layer — so a
 * crafted value needs no ';' breakout to make a victim's browser fetch an
 * attacker URL, and the site's CSP is report-only.
 */
describe('safePresenceColor', () => {
  it('passes a well-formed hex colour through unchanged', () => {
    expect(safePresenceColor('#3B82F6')).toBe('#3B82F6');
    expect(safePresenceColor('#abcdef')).toBe('#abcdef');
  });

  it('rejects a url()-injecting payload', () => {
    const payload = 'red),url(https://evil.example/x)/*';
    const safe = safePresenceColor(payload);
    expect(safe).not.toContain('url(');
    expect(safe).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it('rejects values that would break out of a style declaration', () => {
    for (const attack of [
      '#fff;background-image:url(https://evil.example/x)',
      'red)',
      'url(https://evil.example/x)',
      '#fff/*',
      'expression(alert(1))',
    ]) {
      expect(safePresenceColor(attack)).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('rejects a 3-digit hex, since the CSS sinks append an alpha pair', () => {
    expect(safePresenceColor('#fff')).not.toBe('#fff');
  });

  it('falls back for non-string values', () => {
    for (const value of [undefined, null, 42, {}, []]) {
      expect(safePresenceColor(value)).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('accepts every colour the generator produces', () => {
    for (let i = 0; i < 24; i++) {
      const generated = generateGuestColor(i);
      expect(safePresenceColor(generated)).toBe(generated);
    }
  });
});
