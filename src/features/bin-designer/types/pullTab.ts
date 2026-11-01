export type PullTabWall = 'front' | 'back' | 'left' | 'right';

/** Raised wall grip, with a blind recess facing into the bin. All sizes in mm. */
export interface PullTabConfig {
  readonly enabled: boolean;
  /**
   * The wall of a tab that stands on the front ('width') or the right
   * ('depth') alone, the only two places a tab could go before {@link walls}.
   * Every other selection writes `walls`, and this then names the axis of its
   * first wall.
   */
  readonly wall: 'width' | 'depth';
  /**
   * Every wall carrying a tab, when that is not the front or the right alone.
   *
   * Absent for those two, so a design saved before this existed builds
   * byte-identical geometry, and one that visits the picker and comes back
   * fingerprints as one that never did (`communityParamsFingerprint` hashes
   * `params` wholesale). Geometry reads it only through `resolvePullTabWalls`;
   * the shell cache key serializes it as stored, after `resolvePullTab` has
   * made it canonical.
   */
  readonly walls?: PullTabWall[];
  readonly backRecess: boolean;
  readonly thickness: number;
  readonly width: number;
  readonly widthMode: 'mm' | 'percent';
  readonly widthPercent: number;
  readonly height: number;
  readonly topRadius: number;
  readonly rootRadius: number;
  readonly recessHeight: number;
  readonly recessBorder: number;
  readonly recessDepth: number;
  readonly recessRadius: number;
  readonly recessEdgeRadius: number;
  readonly recessInsideRadius: number;
}
