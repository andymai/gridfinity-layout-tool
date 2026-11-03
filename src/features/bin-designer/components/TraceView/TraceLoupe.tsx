import { LOUPE_ZOOM, loupeTopLeft } from '../panel/CutoutsSection/renderer/loupe';
import type { Point } from '@/shared/scanTrace';

interface TraceLoupeProps {
  readonly url: string;
  readonly image: { readonly width: number; readonly height: number };
  /** The point to centre, in photo pixels. */
  readonly at: Point;
  /** Screen pixels per photo pixel in the canvas around it. */
  readonly scale: number;
  /** Where the point is on screen, to keep the loupe off it. */
  readonly screen: Point;
  readonly canvas: { readonly width: number; readonly height: number };
}

/** The photo under a point, three times closer, for placing a ruler end or a paper corner. */
export function TraceLoupe({ url, image, at, scale, screen, canvas }: TraceLoupeProps) {
  const placed = loupeTopLeft(screen.x, canvas);
  if (!placed) return null;
  const { left, top, size } = placed;
  const s = scale * LOUPE_ZOOM;
  const half = size / 2;
  const arms = `M ${half - 26} ${half} H ${half - 8} M ${half + 8} ${half} H ${half + 26} M ${half} ${half - 26} V ${half - 8} M ${half} ${half + 8} V ${half + 26}`;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute overflow-hidden rounded-lg border-2 border-accent bg-surface shadow-lg"
      style={{
        left,
        top,
        width: size,
        height: size,
        backgroundImage: `url("${url}")`,
        backgroundRepeat: 'no-repeat',
        // Measured from the outer edge, as the crosshair is, not inside the border.
        backgroundOrigin: 'border-box',
        backgroundSize: `${image.width * s}px ${image.height * s}px`,
        backgroundPosition: `${half - at.x * s}px ${half - at.y * s}px`,
      }}
    >
      <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${size} ${size}`}>
        {/* Dark under light, so the crosshair reads over any photo. */}
        <path d={arms} stroke="rgb(0 0 0 / 0.6)" strokeWidth={4} strokeLinecap="round" />
        <path d={arms} stroke="white" strokeWidth={2} strokeLinecap="round" />
      </svg>
    </div>
  );
}
