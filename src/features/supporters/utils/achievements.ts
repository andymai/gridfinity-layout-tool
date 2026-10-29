export const ACHIEVEMENT_IDS = [
  'satThrough',
  'foundOwnBin',
  'speedrunner',
  'poked10',
  'postCredits',
] as const;

export type AchievementId = (typeof ACHIEVEMENT_IDS)[number];

export const ACHIEVEMENT_TITLE_KEYS: Record<AchievementId, string> = {
  satThrough: 'supporters.achievements.satThrough',
  foundOwnBin: 'supporters.achievements.foundOwnBin',
  speedrunner: 'supporters.achievements.speedrunner',
  poked10: 'supporters.achievements.poked10',
  postCredits: 'supporters.achievements.postCredits',
};

const STORAGE_KEY = 'gridfinity-supporters-achievements';

/** A per-browser keepsake, so blocked or garbled storage just means none earned yet. */
export function readAchievements(): Set<AchievementId> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed.filter((id): id is AchievementId => ACHIEVEMENT_IDS.includes(id as AchievementId))
    );
  } catch {
    return new Set();
  }
}

export function saveAchievements(unlocked: Set<AchievementId>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...unlocked]));
  } catch {
    // Blocked storage: the toast still shows, it just shows again next visit.
  }
}
