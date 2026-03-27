/** SVG icon for Assembled -- 2x2 grid of squares packed tight */
export function IconAssembled() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="4.5" height="4.5" rx="0.8" fill="currentColor" opacity="0.6" />
      <rect x="8.5" y="3" width="4.5" height="4.5" rx="0.8" fill="currentColor" opacity="0.6" />
      <rect x="3" y="8.5" width="4.5" height="4.5" rx="0.8" fill="currentColor" opacity="0.6" />
      <rect x="8.5" y="8.5" width="4.5" height="4.5" rx="0.8" fill="currentColor" opacity="0.6" />
    </svg>
  );
}

/** SVG icon for Exploded -- 2x2 grid of squares spread to corners */
export function IconExploded() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="4.5" height="4.5" rx="0.8" fill="currentColor" opacity="0.6" />
      <rect x="10.5" y="1" width="4.5" height="4.5" rx="0.8" fill="currentColor" opacity="0.6" />
      <rect x="1" y="10.5" width="4.5" height="4.5" rx="0.8" fill="currentColor" opacity="0.6" />
      <rect x="10.5" y="10.5" width="4.5" height="4.5" rx="0.8" fill="currentColor" opacity="0.6" />
    </svg>
  );
}

/** SVG icon for Front preset -- cube with front face highlighted */
export function IconFront() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 5l6-3 6 3v6l-6 3-6-3V5z" stroke="currentColor" strokeWidth="1.2" opacity="0.4" />
      <path d="M2 5l6 3v6l-6-3V5z" fill="currentColor" opacity="0.6" />
      <path d="M2 5l6 3v6l-6-3V5z" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

/** SVG icon for Side preset -- cube with side face highlighted */
export function IconSide() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 5l6-3 6 3v6l-6 3-6-3V5z" stroke="currentColor" strokeWidth="1.2" opacity="0.4" />
      <path d="M14 5l-6 3v6l6-3V5z" fill="currentColor" opacity="0.6" />
      <path d="M14 5l-6 3v6l6-3V5z" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

/** SVG icon for Top preset -- cube with top face highlighted */
export function IconTop() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 5l6-3 6 3v6l-6 3-6-3V5z" stroke="currentColor" strokeWidth="1.2" opacity="0.4" />
      <path d="M2 5l6-3 6 3-6 3-6-3z" fill="currentColor" opacity="0.6" />
      <path d="M2 5l6-3 6 3-6 3-6-3z" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

/** SVG icon for Isometric preset -- cube corner perspective */
export function IconIso() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M2 5l6-3 6 3v6l-6 3-6-3V5z"
        fill="currentColor"
        opacity="0.15"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path d="M8 8v6M2 5l6 3M14 5l-6 3" stroke="currentColor" strokeWidth="1" opacity="0.5" />
    </svg>
  );
}

/** SVG icon for Reset -- circular arrow */
export function IconReset() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3.5 2.5v3.5H7"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3.5 6C4.5 3.5 6.8 2 9 2c3 0 5 2.5 5 5.5S12 13 9 13c-2 0-3.7-1-4.5-2.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}
