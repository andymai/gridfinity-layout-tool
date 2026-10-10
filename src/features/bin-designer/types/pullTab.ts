/** Raised wall grip, with a blind recess facing into the bin. All sizes in mm. */
export interface PullTabConfig {
  readonly enabled: boolean;
  readonly wall: 'width' | 'depth';
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
