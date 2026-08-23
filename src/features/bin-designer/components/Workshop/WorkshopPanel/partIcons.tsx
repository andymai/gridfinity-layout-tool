/**
 * Palette glyphs on the cutout toolbar's 14×14 stroke grammar
 * (currentColor, 1.5 weight), so the two editors read as one family.
 */
import type { ReactElement } from 'react';

const P = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const svg = (children: React.ReactNode): ReactElement => (
  <svg viewBox="0 0 14 14" width="16" height="16" aria-hidden="true" {...P}>
    {children}
  </svg>
);

export const PART_ICONS: Record<string, ReactElement> = {
  post: svg(
    <>
      <ellipse cx="7" cy="3" rx="3" ry="1.4" />
      <path d="M4 3v8c0 .8 1.3 1.4 3 1.4s3-.6 3-1.4V3" />
    </>
  ),
  fin: svg(
    <>
      <path d="M3.5 12.5h7l-2-10h-3z" />
    </>
  ),
  block: svg(
    <>
      <rect x="2.5" y="4.5" width="9" height="7" rx="1.4" />
      <path d="M2.5 7h9" opacity="0.5" />
    </>
  ),
  tube: svg(
    <>
      <circle cx="7" cy="7" r="5" />
      <circle cx="7" cy="7" r="2.4" />
    </>
  ),
  cradle: svg(
    <>
      <path d="M2 11.5V5.5h2.2a2.8 2.8 0 0 0 5.6 0H12v6z" />
    </>
  ),
  hook: svg(
    <>
      <path d="M4.5 2v8a2.5 2.5 0 0 0 5 0V8.5" />
    </>
  ),
  comb: svg(
    <>
      <path d="M2 11.5v-7h2v4h2v-4h2v4h2v-4h2v7z" />
    </>
  ),
  riser: svg(
    <>
      <path d="M2 11.5v-2.5h3v-3h3v-3h4v8.5z" />
    </>
  ),
  boreBank: svg(
    <>
      <rect x="2" y="4" width="10" height="7.5" rx="1.2" />
      <ellipse cx="4.6" cy="6.5" rx="1" ry="0.8" />
      <ellipse cx="7" cy="6.5" rx="1" ry="0.8" />
      <ellipse cx="9.4" cy="6.5" rx="1" ry="0.8" />
    </>
  ),
  arch: svg(
    <>
      <path d="M3 12V6M11 12V6" />
      <path d="M2 5.5h10" />
      <circle cx="7" cy="5.5" r="1.3" />
    </>
  ),
  hole: svg(
    <>
      <circle cx="7" cy="7" r="4.2" strokeDasharray="2.4 1.8" />
    </>
  ),
  slot: svg(
    <>
      <rect x="2" y="4.5" width="10" height="5" rx="2.5" strokeDasharray="2.4 1.8" />
    </>
  ),
};
