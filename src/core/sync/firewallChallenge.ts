/**
 * Vercel's bot protection answers 429 with `x-vercel-mitigated: challenge`
 * once the browser's challenge session ends (it lasts an hour). A fetch cannot
 * solve the challenge, only a page load can, so unlike the server's own rate
 * limit it does not pass with time: every later call fails the same way.
 */

export const FIREWALL_CHALLENGE_EVENT = 'gflt:firewall-challenge';

let challenged = false;

export function isFirewallChallenge(response: Response): boolean {
  return response.status === 429 && response.headers.get('x-vercel-mitigated') === 'challenge';
}

export function noteFirewallChallenge(response: Response): void {
  if (challenged || !isFirewallChallenge(response)) return;
  challenged = true;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(FIREWALL_CHALLENGE_EVENT));
  }
}

export function firewallChallenged(): boolean {
  return challenged;
}

export function __resetForTests(): void {
  challenged = false;
}
