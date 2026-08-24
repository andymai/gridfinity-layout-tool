import { useEffect } from 'react';
import { useSettingsStore } from '@/core/store/settings';
import { useViewStore } from '@/core/store/view';
import {
  getSeenState,
  hasUnseen,
  isCooldownElapsed,
  recordAutoOpen,
  seedIfFirstRun,
} from '../seenState';

/**
 * Marks that this browser session has already booted the app once. A silent PWA
 * update reload keeps sessionStorage, so its presence is what separates "you
 * came back" from "the app reloaded under you mid-task".
 */
const SESSION_KEY = 'gridfinity-whats-new-session';

function claimFreshSession(): boolean {
  try {
    if (sessionStorage.getItem(SESSION_KEY)) return false;
    sessionStorage.setItem(SESSION_KEY, '1');
    return true;
  } catch {
    // Storage unavailable: treat every load as continuing, so an inaccessible
    // sessionStorage can never turn into a digest on every single reload.
    return false;
  }
}

interface Options {
  /**
   * False on arrivals that came for something specific (a shared layout link,
   * community, supporters, the phone scan route), and while onboarding runs.
   */
  allowed: boolean;
}

/**
 * Opens the What's New digest at most once a week, and only at the start of a
 * browser session. Mount once, at the app level.
 */
export function useWhatsNewAutoOpen({ allowed }: Options): void {
  const enabled = useSettingsStore((state) => state.settings.showUpdateSummaries);
  const setWhatsNewOpen = useViewStore((state) => state.setWhatsNewOpen);

  useEffect(() => {
    if (!allowed) return;

    // A brand-new browser has nothing to catch up on: record the position and
    // stay quiet, so the digest never lands on top of the draw tutorial.
    if (seedIfFirstRun()) return;

    const isFreshSession = claimFreshSession();
    if (!isFreshSession || !enabled) return;

    const state = getSeenState();
    if (!hasUnseen(state) || !isCooldownElapsed(state)) return;

    recordAutoOpen();
    setWhatsNewOpen(true);
  }, [allowed, enabled, setWhatsNewOpen]);
}
