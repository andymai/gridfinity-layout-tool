import { useCallback, useEffect, useRef, useState } from 'react';
import { readAchievements, saveAchievements, type AchievementId } from '../utils/achievements';

const TOAST_MS = 4200;

export interface Achievements {
  /** The achievement being announced, or null. */
  toast: AchievementId | null;
  /** Records it once per browser; only a first unlock is announced. */
  unlock: (id: AchievementId) => void;
}

export function useAchievements(): Achievements {
  const unlocked = useRef<Set<AchievementId> | null>(null);
  const [queue, setQueue] = useState<AchievementId[]>([]);

  const unlock = useCallback((id: AchievementId) => {
    unlocked.current ??= readAchievements();
    if (unlocked.current.has(id)) return;
    unlocked.current.add(id);
    saveAchievements(unlocked.current);
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
