import { useCallback, useEffect, useRef, useState } from 'react';
import { readAchievements, saveAchievement, type AchievementId } from '../utils/achievements';

const TOAST_MS = 4200;

export interface Achievements {
  toast: AchievementId | null;
  /** Records it once per browser; only a first unlock is announced. */
  unlock: (id: AchievementId) => void;
}

export function useAchievements(): Achievements {
  const handled = useRef(new Set<AchievementId>());
  const [queue, setQueue] = useState<AchievementId[]>([]);

  // `handled` keeps a session with blocked storage from announcing one twice.
  const unlock = useCallback((id: AchievementId) => {
    if (handled.current.has(id)) return;
    handled.current.add(id);
    if (readAchievements().has(id)) return;
    saveAchievement(id);
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
