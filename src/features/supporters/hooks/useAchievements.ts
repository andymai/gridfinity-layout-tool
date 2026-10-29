import { useCallback, useEffect, useRef, useState } from 'react';
import { readAchievements, saveAchievements, type AchievementId } from '../utils/achievements';

const TOAST_MS = 4200;

export interface Achievements {
  toast: AchievementId | null;
  /** Records it once per browser; only a first unlock is announced. */
  unlock: (id: AchievementId) => void;
}

export function useAchievements(): Achievements {
  const handled = useRef(new Set<AchievementId>());
  const [queue, setQueue] = useState<AchievementId[]>([]);

  // Storage is re-read on every unlock and merged, so two open tabs can't
  // overwrite each other's awards; `handled` keeps a session with blocked
  // storage from announcing the same one twice.
  const unlock = useCallback((id: AchievementId) => {
    if (handled.current.has(id)) return;
    handled.current.add(id);
    const saved = readAchievements();
    if (saved.has(id)) return;
    saved.add(id);
    saveAchievements(saved);
    setQueue((q) => [...q, id]);
  }, []);

  const toast = queue.at(0) ?? null;
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setQueue((q) => q.slice(1)), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  return { toast, unlock };
}
