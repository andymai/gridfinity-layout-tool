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

/** One key per award, so two tabs earning different ones never write the same entry. */
const keyFor = (id: AchievementId) => `gridfinity-supporters-achievement-${id}`;

/** A per-browser keepsake, so blocked storage just means none earned yet. */
export function readAchievements(): Set<AchievementId> {
  try {
    return new Set(ACHIEVEMENT_IDS.filter((id) => localStorage.getItem(keyFor(id)) === '1'));
  } catch {
    return new Set();
  }
}

export function saveAchievement(id: AchievementId): void {
  try {
    localStorage.setItem(keyFor(id), '1');
  } catch {
    // Blocked storage: the toast still shows, it just shows again next visit.
  }
}
