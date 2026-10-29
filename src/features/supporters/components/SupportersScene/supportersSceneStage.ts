/** Where the plate is framed while credits share the screen with it. */
export interface StageFrame {
  /** Shift of the image centre, as a fraction of the canvas width and height. */
  shiftX: number;
  shiftY: number;
  /** Share of the canvas the plate is framed into. */
  widthFraction: number;
  heightFraction: number;
}

export const FULL_STAGE: StageFrame = { shiftX: 0, shiftY: 0, widthFraction: 1, heightFraction: 1 };
