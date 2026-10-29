import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '@/i18n';
import { useLatestRef } from '@/shared/hooks';
import type { CreditsClock } from '../utils/creditsClock';
import { departmentOf } from '../utils/creditsPlan';
import { findSupporter } from '../utils/findSupporter';
import type { RollSchedule } from '../utils/rollSchedule';
import type { SupporterBin } from '../utils/supportersData';
import type { FlyToRequest } from '../components/SupportersScene';

/** Past a bin's landing, so pausing on its credit shows it seated rather than about to drop. */
const SEATED_AFTER = 0.75;
const SPOTLIGHT_MS = 6000;

interface FocusOptions {
  bins: SupporterBin[];
  /** The roll is up and moving under its own clock (not the finale, not reduced motion). */
  rolling: boolean;
  schedule: RollSchedule | null;
  clock: CreditsClock;
  setPaused: (paused: boolean) => void;
  departmentLabels: string[];
  /** Name from a shared credit link, if the page was opened with one. */
  creditName: string | null;
  /** Bring the roll back up, for a credit link opened after the credits were seen. */
  openRoll: () => void;
  onShown: (bin: SupporterBin) => void;
}

/**
 * Pointing at one supporter, however it happens: a clicked credit, a search,
 * the panel's "show me my bin", keyboard focus, or a shared credit link.
 * Mid-roll that means pausing with their bin seated; otherwise flying to it.
 */
export function useSupporterFocus({
  bins,
  rolling,
  schedule,
  clock,
  setPaused,
  departmentLabels,
  creditName,
  openRoll,
  onShown,
}: FocusOptions) {
  const t = useTranslation();
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [flyTo, setFlyTo] = useState<FlyToRequest | null>(null);
  const flyNonce = useRef(0);
  const [findQuery, setFindQuery] = useState('');
  const [findStatus, setFindStatus] = useState<string | null>(null);
  const [spotlight, setSpotlight] = useState<string | null>(null);
  const linkLanded = useRef(false);
  const onShownRef = useLatestRef(onShown);

  const flyToBin = useCallback((id: string) => {
    flyNonce.current += 1;
    setFlyTo({ id, nonce: flyNonce.current });
  }, []);

  const pauseSeated = useCallback(
    (id: string, from: RollSchedule | null, jump: boolean) => {
      const seated = from?.seatTimes.get(id);
      if (seated !== undefined) {
        clock.seek(jump ? seated + SEATED_AFTER : Math.max(clock.time, seated + SEATED_AFTER));
      }
      setPaused(true);
    },
    [clock, setPaused]
  );

  /** `jump` goes straight to their credit; otherwise the roll only nudges forward to the drop. */
  const showSupporter = useCallback(
    (id: string, jump: boolean) => {
      setFocusedId(id);
      if (rolling) pauseSeated(id, schedule, jump);
      else flyToBin(id);
      const bin = bins.find((b) => b.id === id);
      if (bin) onShownRef.current(bin);
    },
    [rolling, schedule, bins, pauseSeated, flyToBin, onShownRef]
  );

  const togglePause = useCallback(() => {
    const next = !clock.isPaused;
    setPaused(next);
    if (!next) setFocusedId(null);
  }, [clock, setPaused]);

  const onCredit = useCallback(
    (id: string) => {
      if (rolling && clock.isPaused && focusedId === id) togglePause();
      else showSupporter(id, false);
    },
    [rolling, clock, focusedId, togglePause, showSupporter]
  );

  const onKeyboardFocus = useCallback(
    (id: string) => {
      const at = schedule?.creditTimes.get(id);
      if (at !== undefined) clock.seek(at);
      setPaused(true);
      // An earlier selection would keep the camera and card on someone else.
      setFocusedId((current) => (current === id ? current : null));
    },
    [schedule, clock, setPaused]
  );

  const findText = useCallback(() => {
    const found = findSupporter(bins, findQuery);
    if (!found) {
      const query = findQuery.trim();
      setFindStatus(query ? t('supporters.find.notFound', { name: query }) : null);
      return;
    }
    showSupporter(found.bin.id, true);
    setFindStatus(
      found.exactMatches > 1
        ? t('supporters.find.multiple', { count: found.exactMatches, name: found.bin.name })
        : t('supporters.find.department', {
            name: found.bin.name,
            department: departmentLabels[departmentOf(found.bin)],
          })
    );
  }, [bins, findQuery, showSupporter, departmentLabels, t]);

  const linked = useMemo(() => {
    const found = creditName ? findSupporter(bins, creditName) : null;
    return found && found.exactMatches > 0 ? found.bin : null;
  }, [bins, creditName]);

  /**
   * Called once the credits are laid out (with no schedule under reduced
   * motion): a shared link lands on its supporter then, because seeking to
   * their credit needs the roll measured first.
   */
  const landCreditLink = useCallback(
    (measured: RollSchedule | null) => {
      if (linkLanded.current || !linked) return;
      linkLanded.current = true;
      setFocusedId(linked.id);
      setSpotlight(linked.name);
      if (measured) {
        openRoll();
        pauseSeated(linked.id, measured, true);
      } else {
        flyToBin(linked.id);
      }
    },
    [linked, openRoll, pauseSeated, flyToBin]
  );

  useEffect(() => {
    if (!spotlight) return;
    const timer = setTimeout(() => setSpotlight(null), SPOTLIGHT_MS);
    return () => clearTimeout(timer);
  }, [spotlight]);

  return {
    focusedId,
    setFocusedId,
    flyTo,
    findQuery,
    setFindQuery,
    findStatus,
    spotlight,
    showSupporter,
    togglePause,
    onCredit,
    onKeyboardFocus,
    findText,
    landCreditLink,
  };
}
