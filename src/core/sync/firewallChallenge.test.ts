// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  __resetForTests,
  FIREWALL_CHALLENGE_EVENT,
  firewallChallenged,
  isFirewallChallenge,
  noteFirewallChallenge,
} from './firewallChallenge';

const challenge = (): Response =>
  new Response('<html>', { status: 429, headers: { 'x-vercel-mitigated': 'challenge' } });

beforeEach(() => {
  __resetForTests();
});

describe('isFirewallChallenge', () => {
  it('tells the firewall challenge apart from the server rate limit', () => {
    expect(isFirewallChallenge(challenge())).toBe(true);
    expect(isFirewallChallenge(new Response(null, { status: 429 }))).toBe(false);
    expect(
      isFirewallChallenge(
        new Response(null, { status: 200, headers: { 'x-vercel-mitigated': 'challenge' } })
      )
    ).toBe(false);
  });
});

describe('noteFirewallChallenge', () => {
  it('latches on the first challenge and announces it once', () => {
    let events = 0;
    const count = () => events++;
    window.addEventListener(FIREWALL_CHALLENGE_EVENT, count);
    noteFirewallChallenge(challenge());
    noteFirewallChallenge(challenge());
    window.removeEventListener(FIREWALL_CHALLENGE_EVENT, count);
    expect(firewallChallenged()).toBe(true);
    expect(events).toBe(1);
  });

  it('ignores the server rate limit', () => {
    noteFirewallChallenge(new Response(null, { status: 429, headers: { 'Retry-After': '5' } }));
    expect(firewallChallenged()).toBe(false);
  });
});
