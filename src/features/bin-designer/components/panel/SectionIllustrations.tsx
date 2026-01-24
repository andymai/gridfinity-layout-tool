/**
 * Mini SVG illustrations for panel section headers.
 *
 * Each is a 16×16 simplified diagram showing what the section controls
 * on the bin. Uses currentColor for theme consistency.
 */

/** 3D cube wireframe representing bin dimensions */
export function DimensionsIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Front face */}
      <rect x="3" y="5" width="8" height="8" rx="0.5" />
      {/* Top face (isometric) */}
      <path d="M3 5 L6 2 L14 2 L11 5" />
      {/* Right face (isometric) */}
      <path d="M11 5 L14 2 L14 10 L11 13" />
    </svg>
  );
}

/** Bottom profile showing magnet holes and baseplate interface */
export function BaseIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Bin body outline */}
      <path d="M2 4 L2 12 L14 12 L14 4" />
      {/* Base profile step */}
      <path d="M2 12 L3 14 L13 14 L14 12" />
      {/* Magnet holes */}
      <circle cx="5.5" cy="13" r="1" />
      <circle cx="10.5" cy="13" r="1" />
    </svg>
  );
}

/** Cross-section showing compartment dividers */
export function InteriorIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Outer bin walls */}
      <rect x="2" y="3" width="12" height="10" rx="0.5" />
      {/* Vertical divider */}
      <line x1="8" y1="3" x2="8" y2="13" />
      {/* Horizontal divider */}
      <line x1="2" y1="8" x2="8" y2="8" />
      {/* Scoop curve (front-right compartment) */}
      <path d="M9 13 Q9 10 12 10" />
    </svg>
  );
}

/** Bin shell outline showing wall thickness */
export function WallsIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Outer wall */}
      <rect x="2" y="3" width="12" height="10" rx="0.5" />
      {/* Inner wall (showing thickness) */}
      <rect x="4" y="5" width="8" height="6" rx="0.5" strokeDasharray="2 1" />
      {/* Wall cutout indicator (front) */}
      <path d="M6 13 L6 11 L10 11 L10 13" strokeWidth="1.5" />
    </svg>
  );
}

/** Circle cut into bin floor representing inserts */
export function InsertsIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Bin floor (top-down view) */}
      <rect x="2" y="2" width="12" height="12" rx="1" />
      {/* Circular insert */}
      <circle cx="6.5" cy="6.5" r="2.5" />
      {/* Rectangular insert */}
      <rect x="10" y="9" width="3" height="4" rx="0.5" />
    </svg>
  );
}

/** Quarter-cylinder scoop ramp at compartment front */
export function ScoopIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Bin outline */}
      <rect x="2" y="3" width="12" height="10" rx="0.5" />
      {/* Scoop curve (quarter circle at bottom) */}
      <path d="M4 13 Q4 8 9 8" />
      {/* Scoop curve (second compartment) */}
      <path d="M10 13 Q10 9 14 9" strokeDasharray="1.5 1" />
    </svg>
  );
}

/** Wall with U-shaped notch cut from top */
export function WallCutoutsIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Bin outline */}
      <path d="M2 3 L2 13 L14 13 L14 3" />
      {/* Front wall with U-notch */}
      <path d="M2 13 L5 13 L5.5 10 L10.5 10 L11 13 L14 13" strokeWidth="1.5" />
      {/* 45-degree slopes */}
      <path d="M5.5 10 L6 8.5 L10 8.5 L10.5 10" strokeDasharray="1.5 1" />
    </svg>
  );
}

/** Sparkle/star icon for coming soon features */
export function ComingSoonIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Four-point star */}
      <path d="M8 2 L9 6 L13 7 L9 8 L8 13 L7 8 L3 7 L7 6 Z" />
      {/* Small sparkle */}
      <path
        d="M12 3 L12.5 4 L13.5 4.5 L12.5 5 L12 6 L11.5 5 L10.5 4.5 L11.5 4 Z"
        strokeWidth="0.8"
      />
    </svg>
  );
}
