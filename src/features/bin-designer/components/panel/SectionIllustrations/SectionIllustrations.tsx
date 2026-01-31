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
    </svg>
  );
}

/** Side cross-section showing a label tab shelf on the back wall */
export function LabelTabsIcon() {
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
      {/* Bin wall cross-section */}
      <path d="M3 3 L3 13 L13 13 L13 3" />
      {/* Label tab shelf */}
      <line x1="13" y1="5" x2="9" y2="5" />
      {/* 45° support gusset */}
      <line x1="13" y1="9" x2="9" y2="5" />
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
