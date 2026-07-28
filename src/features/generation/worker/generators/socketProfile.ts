/**
 * Shared tapered base-profile definition for the bin socket and the baseplate
 * pocket.
 *
 * The bin socket (socketBuilder) and the baseplate pocket (baseplatePockets)
 * must describe the *same* tapered frustum so a bin seats in its plate. They
 * historically duplicated the Z-breakpoints/insets; this module is the single
 * source of truth both consume, so they mate by construction at any socket
 * height.
 *
 * Coordinate system: profile top face at Z=0, bottom face at Z=-H. Insets are
 * horizontal reductions from the outer cell edge (same for socket and pocket;
 * the bin socket is additionally shrunk by CLEARANCE at the caller, giving the
 * seating gap).
 *
 * Low-profile shortening — remove from the BOTTOM: a lower profile is the
 * STANDARD base profile truncated at depth H. The whole top region — the
 * opening, the 45° big-taper mating chamfer, and as much of the straight wall as
 * fits — is copied byte-for-byte from the standard profile; the height reduction
 * is taken entirely off the bottom by capping the frustum flat at Z=-H (the cap
 * inset is interpolated to wherever the standard taper sits at that depth).
 * Because the mating region is never scaled or moved, a low bin's walls stay
 * flush with a standard baseplate pocket / bin lip at every engaged depth, so
 * seating and stacking can't drift — the same principle as the baseplate, which
 * keeps its pocket opening and removes depth from the bottom. At H=SOCKET_HEIGHT
 * nothing is truncated, so the breakpoints reproduce the historical profile
 * exactly. Valid for any H in [SOCKET_HEIGHT_MM_MIN, SOCKET_HEIGHT_MM_MAX].
 */

import {
  SOCKET_HEIGHT,
  SOCKET_BIG_TAPER,
  SOCKET_VERTICAL_PART,
  SOCKET_TAPER_WIDTH,
  CLEARANCE,
} from './generatorConstants';

/** One cross-section of the tapered profile. */
export interface SocketProfileSection {
  /** Z position, <= 0. Top section is 0, bottom section is -H. */
  readonly z: number;
  /** Horizontal inset from the outer cell edge (mm). */
  readonly inset: number;
}

/** Inset at the top opening (no taper yet). */
export const PROFILE_INSET_TOP = 0;
/** Inset at the end of the big taper / start of the vertical wall. */
export const PROFILE_INSET_MID = SOCKET_BIG_TAPER - CLEARANCE / 2; // 2.15mm
/** Inset at the bottom face (full taper width). */
export const PROFILE_INSET_BOT = SOCKET_TAPER_WIDTH - CLEARANCE / 2; // 2.95mm

/**
 * The standard full-height base profile (top→bottom). Every lower profile is
 * this list truncated at depth H, so the mating region is always identical.
 * Z breakpoints at H=5: 0 / -0.25 / -2.4 / -4.2 / -5.0.
 */
const STANDARD_PROFILE: readonly SocketProfileSection[] = [
  { z: 0, inset: PROFILE_INSET_TOP },
  { z: -(CLEARANCE / 2), inset: PROFILE_INSET_TOP },
  { z: -SOCKET_BIG_TAPER, inset: PROFILE_INSET_MID },
  { z: -(SOCKET_BIG_TAPER + SOCKET_VERTICAL_PART), inset: PROFILE_INSET_MID },
  { z: -SOCKET_HEIGHT, inset: PROFILE_INSET_BOT },
];

/**
 * Full profile used for export-fidelity sockets and pockets: the standard
 * profile truncated at Z=-H. Sections above the cut are copied verbatim (the
 * mating region is held standard); the bottom is a flat cap whose inset is
 * interpolated to where the standard taper sits at depth H. At H=SOCKET_HEIGHT
 * this returns the five historical breakpoints bit-for-bit.
 */
export function socketProfileSections(
  socketHeightMm: number = SOCKET_HEIGHT
): SocketProfileSection[] {
  // pattern-check: skip — reworking a pure geometry function's math, no GoF pattern applies
  const zCut = -socketHeightMm;
  const out: SocketProfileSection[] = [];
  for (let i = 0; i < STANDARD_PROFILE.length; i++) {
    const s = STANDARD_PROFILE[i];
    if (s.z > zCut) {
      out.push(s); // above the cut — standard section, kept as-is
      continue;
    }
    if (s.z === zCut) {
      out.push(s); // cut lands exactly on a standard breakpoint
      return out;
    }
    // First breakpoint below the cut: interpolate the flat bottom cap where the
    // standard taper crosses depth H (i >= 1 here — the top section is at Z=0,
    // always above any valid cut).
    const prev = STANDARD_PROFILE[i - 1];
    const t = (zCut - prev.z) / (s.z - prev.z);
    out.push({ z: zCut, inset: prev.inset + t * (s.inset - prev.inset) });
    return out;
  }
  return out; // H >= SOCKET_HEIGHT (clamped): the full standard profile
}

/**
 * The inset of the truncated profile's bottom face at height H. Consumers that
 * extend the cutter past the profile bottom (e.g. a baseplate through-cut, a lid
 * stack-grid) must continue straight down from THIS inset — not a hardcoded
 * PROFILE_INSET_BOT — or the extension would step in/out and leave a ledge.
 * Equals PROFILE_INSET_BOT at H=SOCKET_HEIGHT.
 */
export function socketBottomInset(socketHeightMm: number = SOCKET_HEIGHT): number {
  const sections = socketProfileSections(socketHeightMm);
  return sections[sections.length - 1].inset;
}

/**
 * Simplified 2-section profile (top + truncated bottom) for cheap preview
 * tessellation. Reuses the full profile's endpoints so the bottom inset and
 * depth match the export exactly (just without the intermediate taper detail).
 */
export function socketProfileSectionsSimplified(
  socketHeightMm: number = SOCKET_HEIGHT
): SocketProfileSection[] {
  const full = socketProfileSections(socketHeightMm);
  return [full[0], full[full.length - 1]];
}
