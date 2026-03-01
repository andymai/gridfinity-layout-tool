/**
 * Lock badge overlay for locked cutouts in the 2D editor.
 *
 * Uses drei <Html> to render a small lock icon at a world-space position,
 * typically the top-right corner of a locked cutout's bounding box.
 */

import { Html } from '@react-three/drei';

interface LockBadge3DProps {
  /** World-space X position (mm) */
  readonly worldX: number;
  /** World-space Y position (mm) */
  readonly worldY: number;
}

export function LockBadge3D({ worldX, worldY }: LockBadge3DProps) {
  return (
    <Html position={[worldX, worldY, 0.1]} style={{ pointerEvents: 'none' }} center>
      <div
        className="flex items-center justify-center rounded-full bg-surface-elevated/80 border border-stroke-subtle shadow-sm"
        style={{ width: 16, height: 16 }}
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          className="text-content-tertiary"
          aria-hidden="true"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>
    </Html>
  );
}
