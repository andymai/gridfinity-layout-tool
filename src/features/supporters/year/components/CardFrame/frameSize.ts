import { createContext, useContext } from 'react';

export interface FrameSize {
  /** Screen px per card px. */
  readonly scale: number;
  /** Device pixels per card px, capped so a big screen does not draw huge canvases. */
  readonly resolution: number;
  /** The frame's own size in screen px. */
  readonly width: number;
  readonly height: number;
  /** Where the card's top-left corner sits inside the frame, screen px. */
  readonly left: number;
  readonly top: number;
}

/** Before the first measure, and under jsdom, which lays nothing out. */
export const FALLBACK_FRAME: FrameSize = {
  scale: 0.4,
  resolution: 0.8,
  width: 432,
  height: 768,
  left: 0,
  top: 0,
};

export const FrameContext = createContext<FrameSize>(FALLBACK_FRAME);

export function useFrameSize(): FrameSize {
  return useContext(FrameContext);
}
