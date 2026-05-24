/** SVG icons for the bin-designer 3D preview controls. */

/** Front preset — cube with front face highlighted */
export function IconFront() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 5l6-3 6 3v6l-6 3-6-3V5z" stroke="currentColor" strokeWidth="1.2" opacity="0.4" />
      <path d="M2 5l6 3v6l-6-3V5z" fill="currentColor" opacity="0.6" />
      <path d="M2 5l6 3v6l-6-3V5z" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

/** Side preset — cube with side face highlighted */
export function IconSide() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 5l6-3 6 3v6l-6 3-6-3V5z" stroke="currentColor" strokeWidth="1.2" opacity="0.4" />
      <path d="M14 5l-6 3v6l6-3V5z" fill="currentColor" opacity="0.6" />
      <path d="M14 5l-6 3v6l6-3V5z" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

/** Top preset — cube with top face highlighted */
export function IconTop() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 5l6-3 6 3v6l-6 3-6-3V5z" stroke="currentColor" strokeWidth="1.2" opacity="0.4" />
      <path d="M2 5l6-3 6 3-6 3-6-3z" fill="currentColor" opacity="0.6" />
      <path d="M2 5l6-3 6 3-6 3-6-3z" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

/** Isometric preset — cube corner perspective */
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

/** Reset — circular arrow */
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

/** Wireframe — grid mesh */
export function IconWireframe() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="12" height="12" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M2 6h12M2 10h12M6 2v12M10 2v12"
        stroke="currentColor"
        strokeWidth="0.8"
        opacity="0.7"
      />
    </svg>
  );
}

/** X-ray — eye with pupil */
export function IconXray() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 8s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="8" cy="8" r="1.8" stroke="currentColor" strokeWidth="1.2" opacity="0.7" />
    </svg>
  );
}

/** Perspective projection — converging lines */
export function IconPerspective() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 13l5-9 5 9M4.5 9.5h6.5" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

/** Orthographic projection — square with cross (no convergence) */
export function IconOrthographic() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="10" height="10" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <path d="M3 8h10M8 3v10" stroke="currentColor" strokeWidth="0.8" opacity="0.7" />
    </svg>
  );
}

/** Assembled — 2x2 grid of squares packed tight */
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

/** Exploded — 2x2 grid of squares spread to corners */
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
