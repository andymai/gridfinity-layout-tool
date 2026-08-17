/**
 * SVG glyphs for the body-type cards.
 *
 * Drawn as side ELEVATIONS, where the interior-mode icons are plan views: body
 * type is a question about the vertical profile (is there a floor, are there
 * walls, are there feet), and a plan view cannot show any of it. Each glyph is
 * the same bin seen from the front with one part of that profile removed, so
 * the set reads as a series rather than five unrelated pictures.
 */

import type { ReactNode } from 'react';

interface IconProps {
  size?: number;
  className?: string;
}

/** Shared frame: every glyph is the same drawing with pieces taken away. */
function Elevation({ size = 20, className = '', children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}

/** Walls, floor and feet: the whole profile. */
export function BinProfileIcon(props: IconProps) {
  return (
    <Elevation {...props}>
      <path d="M3 3v12h18V3" />
      <path d="M6 15v5h5v-5" />
      <path d="M13 15v5h5v-5" />
    </Elevation>
  );
}

/** The same box with no legs under it: nothing to drop into a baseplate. */
export function FlatBaseIcon(props: IconProps) {
  return (
    <Elevation {...props}>
      <path d="M3 3v12h18V3" />
    </Elevation>
  );
}

/** Legs with no floor spanning them: open straight through. */
export function SpacerIcon(props: IconProps) {
  return (
    <Elevation {...props}>
      <path d="M3 3v12" />
      <path d="M21 3v12" />
      <path d="M3 15v5h5v-5" />
      <path d="M16 15v5h5v-5" />
    </Elevation>
  );
}

/** The profile with its walls removed: floor and feet only. */
export function BaseOnlyIcon(props: IconProps) {
  return (
    <Elevation {...props}>
      <path d="M3 10h18v5H3z" />
      <path d="M6 15v5h5v-5" />
      <path d="M13 15v5h5v-5" />
    </Elevation>
  );
}

/** Feet swapped for a lid's skirt, over the rim of the bin it caps. */
export function LidBaseIcon(props: IconProps) {
  return (
    <Elevation {...props}>
      <path d="M3 2v11h18V2" />
      <path d="M6 13v4" />
      <path d="M18 13v4" />
      <path d="M3 21h18" />
    </Elevation>
  );
}
