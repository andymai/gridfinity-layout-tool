import { useCallback, useEffect, useRef } from 'react';
import { isSyntheticPopstate } from '@/shared/hooks/useDesignerRouting';

interface TrapHandle {
  consume: (onConsumed: () => void) => void;
}

/**
 * Traps one history entry for the lifetime of the detail overlay so
 * hardware/browser Back closes the overlay instead of the app or the
 * gallery modal underneath. The entry is pushed without a URL change (the
 * modal surface is not addressable; the /community/d/<id> route ships
 * separately). When the overlay closes by any other means, the cleanup
 * consumes the trapped entry so a later Back does not replay a stale pop.
 *
 * App-synthetic popstate dispatches (the routing helpers re-fire popstate
 * after pushState) are ignored: treating one as a real Back would mark the
 * trap consumed without popping it, stranding a duplicate entry on the stack.
 *
 * Returns consumeTrap for flows that navigate away while the overlay is
 * open (remix/edit push /designer): it pops the trapped entry first and runs
 * the navigation only once the pop has settled, because a pushState landing
 * on top of the trap would make the cleanup's history.back() pop the wrong
 * entry.
 */
export function useDetailHistoryTrap(onBack: () => void): (onConsumed: () => void) => void {
  const onBackRef = useRef(onBack);
  useEffect(() => {
    onBackRef.current = onBack;
  }, [onBack]);

  const trapRef = useRef<TrapHandle | null>(null);

  // TODO: reuse the existing trap entry for detail-to-detail transitions when
  // in-detail navigation (the similar-designs rail) ships. The dialog is
  // keyed by designId, so opening detail B over detail A runs A's cleanup
  // back() concurrently with B's mount pushState and can pop B's fresh trap.
  useEffect(() => {
    let consumed = false;
    let pending: (() => void) | null = null;
    window.history.pushState({ communityDetail: true }, '');
    const handlePop = () => {
      if (isSyntheticPopstate()) return;
      consumed = true;
      const continuation = pending;
      pending = null;
      if (continuation !== null) continuation();
      else onBackRef.current();
    };
    trapRef.current = {
      consume: (onConsumed) => {
        if (consumed) {
          onConsumed();
          return;
        }
        pending = onConsumed;
        // Marked consumed before the pop lands: if the overlay unmounts in
        // the window before the popstate is delivered, the cleanup must not
        // queue a second back() and pop the entry beneath the trap.
        consumed = true;
        window.history.back();
      },
    };
    window.addEventListener('popstate', handlePop);
    return () => {
      trapRef.current = null;
      window.removeEventListener('popstate', handlePop);
      if (!consumed) window.history.back();
    };
  }, []);

  return useCallback((onConsumed: () => void) => {
    const trap = trapRef.current;
    if (trap !== null) trap.consume(onConsumed);
    else onConsumed();
  }, []);
}
