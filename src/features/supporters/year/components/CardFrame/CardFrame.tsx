import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { CARD_H, CARD_W } from '../../cards/scene';
import { FALLBACK_FRAME as FALLBACK, FrameContext, type FrameSize } from './frameSize';

const MAX_DPR = 2;

function measure(element: HTMLElement): FrameSize {
  const width = element.clientWidth;
  const height = element.clientHeight;
  if (width <= 0 || height <= 0) return FALLBACK;
  const scale = Math.min(width / CARD_W, height / CARD_H);
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  return {
    scale,
    resolution: scale * Math.min(MAX_DPR, dpr),
    width,
    height,
    left: (width - CARD_W * scale) / 2,
    top: (height - CARD_H * scale) / 2,
  };
}

export interface CardFrameProps {
  /** Fills the whole frame, past the card's own edges on a tall phone. */
  readonly background: string;
  /** Laid out in card px, 1080 × 1920. */
  readonly children: ReactNode;
  /** Over everything, in screen px: the fill between cards. */
  readonly overlay?: ReactNode;
}

/**
 * The card's 1080 × 1920 layout scaled to fit the screen, centred, with the
 * card colour filling any space around it. Only a resize moves the layout.
 */
export function CardFrame({ background, children, overlay }: CardFrameProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<FrameSize>(FALLBACK);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = (): void => {
      const next = measure(element);
      setSize((prev) =>
        prev.width === next.width &&
        prev.height === next.height &&
        prev.resolution === next.resolution
          ? prev
          : next
      );
    };
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <FrameContext.Provider value={size}>
      <div ref={ref} className="relative min-h-0 flex-1 overflow-hidden" style={{ background }}>
        <div
          className="absolute"
          style={{
            left: size.left,
            top: size.top,
            width: CARD_W,
            height: CARD_H,
            transform: `scale(${size.scale})`,
            transformOrigin: '0 0',
          }}
        >
          {children}
        </div>
        {overlay}
      </div>
    </FrameContext.Provider>
  );
}
