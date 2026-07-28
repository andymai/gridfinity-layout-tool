/**
 * Resolved lid-geometry inputs derived from BinParams.
 *
 * The lid builder pipeline takes a `LidInputs` value rather than raw
 * `BinParams` so each builder phase only needs the fields it cares about
 * and the conversions (clearance, corner radius, anchor Z) happen once.
 */

import type {
  BinParams,
  LidAttachment,
  LidCompatibilitySide,
  TextFontFamily,
  TextMode,
} from '@/shared/types/bin';
import type { MagnetAnchor } from '@/core/types';
import {
  checkLidCompatibility,
  computeDisabledRails,
  resolveLidFootprintClearance,
  resolveLidPlateThickness,
  resolveLidCavityExtraMm,
} from '@/shared/types/bin';
import { isPartialMask, type CellMask } from '@/shared/utils/cellMask';
import { LID_FIT_CLEARANCE, LID_CORNER_RADIUS, lidAnchorZ, lidWallBottomZ } from './lidConstants';
import { resolveOverhang, overhangExpansion, hasOverhang } from './overhang';

/**
 * Resolved lid-top text (issue #2695): the trimmed string plus the effective
 * style — the design's `textDefaults` merged with the shared surface-text
 * override. Null when there's no text or a gate rejects it (stackable top,
 * polygon footprint).
 */
export interface LidTextInputs {
  readonly value: string;
  readonly font: TextFontFamily;
  readonly mode: TextMode;
  readonly depth: number;
  readonly margin: number;
  readonly minFontSize: number;
  readonly maxFontSize: number;
  readonly fontSizeOverride?: number;
}

/** Geometric inputs derived from BinParams. */
export interface LidInputs {
  readonly lidOuterW: number;
  readonly lidOuterD: number;
  readonly lidCornerR: number;
  /**
   * Per-side FOOTPRINT clearance. `LID_FIT_CLEARANCE`, plus
   * `LID_MAGNETIC_EXTRA_CLEARANCE` on a lid that actually gets retention
   * magnets, so they aren't fighting a friction fit (#2761). NOT every
   * `attachment: 'magnetic'` config: a lip-less or polygon bin generates no
   * corner bosses and keeps the base value — see
   * `resolveLidFootprintClearance`. Not the anchor clearance either;
   * `anchorZ`/`wallBottomZ` are deliberately computed from the base value.
   */
  readonly fitClearance: number;
  readonly topThickness: number;
  /**
   * Total cavity depth added below the standard one-grid-unit lid — the
   * `extraHeightMm` knob plus floor-plate growth. Retention bosses hang from
   * the cavity BOTTOM, so they lengthen by this to stay at the lip.
   */
  readonly cavityExtraMm: number;
  /**
   * Cavity inner-face inset from the lid's outer perimeter. The wall in
   * the lip-mating zone is `cavityInset - LIP_BIG_TAPER = LID_WALL_THICKNESS`
   * (= 1.85mm); above the lip the chamfer hasn't kicked in yet so the
   * wall reads as the full `cavityInset` (= 3.75mm).
   */
  readonly cavityInset: number;
  readonly stackableTop: boolean;
  /**
   * Cut the stack top as a single perimeter pocket instead of one pocket per
   * cell (#2930). Already gated on `stackableTop` here. See
   * {@link LidConfig.stackLipOnly}.
   */
  readonly stackLipOnly: boolean;
  /**
   * When true, the stack grid is NOT fused into the lid — it's emitted as a
   * standalone companion slab (glued on by the user). Already gated on
   * `stackableTop` here, so consumers can check it directly. See
   * {@link LidConfig.separateStackPlate}.
   */
  readonly separateStackPlate: boolean;
  readonly magnetHoles: boolean;
  readonly magnetDiameter: number;
  readonly magnetDepth: number;
  /** Retention mode. Drives which retention geometry the builder emits. */
  readonly attachment: LidAttachment;
  /**
   * Whether to emit lid-to-bin retention magnets (issue #2694). True only when
   * `attachment === 'magnetic'` and the footprint is rectangular (polygon bins
   * are excluded). Dedicated dims — independent of the stack `magnet*` fields.
   */
  readonly retentionMagnets: boolean;
  readonly retentionMagnetDiameter: number;
  readonly retentionMagnetDepth: number;
  /** Extra magnets per long edge (#2844); 0 = the classic four-corner lid. */
  readonly retentionMagnetEdgeMagnets: number;
  /**
   * Resolved tray recess. `enabled` is already gated on `!stackableTop` here,
   * so the builder can trust it directly. Dimensions are pre-clamped upstream.
   */
  readonly tray: { readonly enabled: boolean; readonly depthMm: number; readonly wallMm: number };
  /** Magnet anchor (default 'edge'), injected from the layout so lid holes mate
   * with the bin base. See `MagnetAnchor` in `@/core/types`. */
  readonly magnetAnchor?: MagnetAnchor;
  readonly cellsX: number;
  readonly cellsY: number;
  /**
   * Which side the half-unit cell sits on for fractional bins. Mirrors the
   * bin's base-socket placement so the lid's magnet holes line up with the
   * feet of the bin stacked on top. See {@link BinParams.fractionalEdgeX}.
   */
  readonly fractionalEdgeX: 'start' | 'end';
  readonly fractionalEdgeY: 'start' | 'end';
  readonly gridUnitMm: number;
  /** Y-axis grid pitch (mm). Equals gridUnitMm for a square grid. */
  readonly gridUnitMmY: number;
  readonly heightUnitMm: number;
  /**
   * Per-side rail engagement overrides driven by feature conflicts.
   * Aggregated from `computeDisabledRails(params)` so the lid builder
   * shares one source of truth with the LidSection panel. Any side in
   * this set is skipped during click-rail placement regardless of the
   * user's persisted `clickRails[side]` flag.
   *
   * Replaces the older `omitFrontBackRails` boolean — the granular
   * `Set<side>` lets label tabs disable only the BACK rail (instead of
   * symmetrically skipping front+back), and lets wall cutouts/handles
   * skip only the affected sides.
   */
  readonly disabledRails: ReadonlySet<LidCompatibilitySide>;
  /**
   * Per-side click-rail engagement. When all four are `false` the lid
   * is friction-fit (no positive snap). Combined with `disabledRails`
   * to produce the effective per-side rail set during placement — a
   * side gets a rail only when its `clickRails[side]` flag is true AND
   * it's not in `disabledRails`.
   */
  readonly clickRails: {
    readonly front: boolean;
    readonly back: boolean;
    readonly left: boolean;
    readonly right: boolean;
  };
  /**
   * Click-rail coverage as a fraction (0..1) of each wall's edge length.
   * Rails are always centered; a value of 1 keeps the historical
   * edge-to-edge behavior, lower values shrink the rail toward the
   * midpoint to save filament. Ignored when `clickRails === false`.
   */
  readonly clickRailCoverage: number;
  /** Z of the bin's lip top in lid-local coords when snapped (the "anchor" line). */
  readonly anchorZ: number;
  /** Z of the bottom of the mating wall (where the wall ends and rails begin). */
  readonly wallBottomZ: number;
  /** Custom-shape mask if the bin has one. Undefined = rectangular. */
  readonly cellMask: CellMask | undefined;
  /**
   * Lid-top text, or null when absent/gated off. Rendered on the plain top
   * face, or the tray floor when the tray recess is active. Gates mirror the
   * LidSection UI: a stackable top owns the surface, and polygon lids are
   * excluded (auto-fit assumes a rectangular face — same rectangularity
   * restriction as `retentionMagnets`).
   */
  readonly text: LidTextInputs | null;
  /**
   * Outer-perimeter shift (mm) caused by asymmetric overhang. The lid's
   * perimeter, mating shell, floor, and click rails translate by this amount
   * so they wrap the bin's overhang-shifted outer body, while the stack grid
   * and magnet holes stay on the nominal socket grid (origin) to keep mating
   * with the bin's base sockets. Zero for symmetric/absent overhang and for
   * polygon bins (which suppress overhang, mirroring the box builder).
   */
  readonly outerOffsetX: number;
  readonly outerOffsetY: number;
}

export function resolveLidInputs(params: BinParams): LidInputs {
  const { gridUnitMm, heightUnitMm } = params;
  // Y axis uses gridUnitMmY when set (non-square grid); equals X for square.
  const gridUnitMmY = params.gridUnitMmY ?? gridUnitMm;
  // Footprint clearance: the locked-down base, plus the magnetic relief when
  // the design gets retention magnets (#2761). XY only — `anchorZ`/
  // `wallBottomZ` below stay on the base value so the magnet seat gap holds.
  const fitClearance = resolveLidFootprintClearance(params);

  // Polygon path activates when the mask is partially filled. A fully-filled
  // mask is treated as rectangular (matches the bin generator's convention).
  const cellMask = isPartialMask(params.cellMask) ? params.cellMask : undefined;

  // Retention mode (#2694). Magnetic retention needs the rectangular corner
  // geometry, so polygon bins fall back to friction (the mating shell still
  // wraps the lip). Click rails are only engaged in clickRails mode — other
  // modes force the persisted per-side flags off so switching modes keeps the
  // user's rail selection without generating it.
  const attachment = params.lid.attachment;
  // Mirror the bin-side `usesMagneticLid` predicate exactly (magnetic + lip +
  // rectangular). Without the `stackingLip` guard the lid would grow bosses in
  // a state where the bin skips its matching posts, so the pair couldn't mate.
  const retentionMagnets = attachment === 'magnetic' && params.base.stackingLip && !cellMask;

  // Tray recess only exists when the lid isn't stackable (a stack grid owns
  // the top surface otherwise).
  const trayEnabled = params.lid.tray.enabled && !params.lid.stackableTop;

  // Lid-top text (issue #2695). Shared surface style = design textDefaults
  // merged with the surface-text override; a stackable top owns the surface
  // and polygon lids are excluded (rectangular auto-fit), mirroring the UI.
  const lidTextValue = params.surfaceText?.lidText?.trim() ?? '';
  let text: LidTextInputs | null = null;
  if (lidTextValue !== '' && !params.lid.stackableTop && !cellMask) {
    const style = { ...params.textDefaults, ...params.surfaceText?.style };
    text = {
      value: lidTextValue,
      font: style.font,
      mode: style.mode,
      depth: style.depth,
      margin: style.margin,
      minFontSize: style.minFontSize,
      maxFontSize: style.maxFontSize,
      ...(style.fontSizeOverride !== undefined ? { fontSizeOverride: style.fontSizeOverride } : {}),
    };
  }

  // Floor plate takes the largest of: the user's knob, a stack-magnet pocket's
  // depth+ceiling, and a tray recess's depth+floor.
  const topThickness = resolveLidPlateThickness(params);
  // Every millimetre of plate past the 0.8mm baseline is a millimetre stolen
  // from the cavity the lip enters, so it deepens the anchor in lockstep.
  const cavityExtra = resolveLidCavityExtraMm(params);

  // Overhang grows the bin's outer body + stacking lip outward (and shifts it
  // when the two opposite sides differ). The lid wraps that expanded body, so
  // its outer footprint must grow in lockstep — otherwise the lid is sized to
  // the nominal footprint and won't seat over the overhang. Polygon bins
  // suppress overhang (matching boxBuilder), so the lid does too.
  const overhang = resolveOverhang(params.overhang);
  const expansion = !cellMask && hasOverhang(overhang) ? overhangExpansion(overhang) : null;
  const addW = expansion?.addW ?? 0;
  const addD = expansion?.addD ?? 0;
  const outerOffsetX = expansion?.offsetX ?? 0;
  const outerOffsetY = expansion?.offsetY ?? 0;

  // Lid outer footprint: `bin*42 - 2*Clearance` per side, plus the overhang
  // expansion. The lid uses its OWN corner radius (`LID_CORNER_RADIUS = 4mm`),
  // NOT the bin's `BOX_CORNER_RADIUS` (3.75mm) — using the bin value shifts
  // rails, shrinks walls, and breaks lip fit.
  const lidOuterW = params.width * gridUnitMm - 2 * fitClearance + addW;
  const lidOuterD = params.depth * gridUnitMmY - 2 * fitClearance + addD;
  // lidCornerR and cavityInset are the same expression: both are the lid's
  // effective corner radius after clearance. `cavityInset` names the semantic
  // role (inner-face distance from outer perimeter); `lidCornerR` is used by
  // geometry helpers. Cavity wall thickness in the lip-mating zone =
  // cavityInset - LIP_BIG_TAPER = 1.85mm.
  const lidCornerR = LID_CORNER_RADIUS - fitClearance;
  const cavityInset = lidCornerR;

  return {
    lidOuterW,
    lidOuterD,
    lidCornerR,
    fitClearance,
    topThickness,
    cavityExtraMm: cavityExtra,
    cavityInset,
    stackableTop: params.lid.stackableTop,
    // Only a stack top has pockets to collapse into one perimeter lip.
    stackLipOnly: params.lid.stackLipOnly && params.lid.stackableTop,
    // Splitting the stack grid off only means anything when there IS a stack
    // grid — gate on stackableTop so buildLid/buildStackPlate can trust the
    // flag directly without re-checking stackableTop.
    separateStackPlate: params.lid.separateStackPlate && params.lid.stackableTop,
    // Magnets only have a stack-grid neighbour to mate with when
    // `stackableTop` is on. Off ⇒ skip the pockets even if the user
    // last toggled magnets on.
    magnetHoles: params.lid.magnetHoles && params.lid.stackableTop,
    magnetDiameter: params.base.magnetDiameter,
    magnetDepth: params.base.magnetDepth,
    magnetAnchor: params.magnetAnchor,
    attachment,
    retentionMagnets,
    retentionMagnetDiameter: params.lid.retentionMagnet.diameter,
    retentionMagnetDepth: params.lid.retentionMagnet.depth,
    retentionMagnetEdgeMagnets: params.lid.retentionMagnet.edgeMagnets,
    tray: {
      enabled: trayEnabled,
      depthMm: params.lid.tray.depthMm,
      wallMm: params.lid.tray.wallMm,
    },
    cellsX: params.width,
    cellsY: params.depth,
    fractionalEdgeX: params.fractionalEdgeX,
    fractionalEdgeY: params.fractionalEdgeY,
    gridUnitMm,
    gridUnitMmY,
    heightUnitMm,
    // Per-side rail skips derived from feature conflicts (label tabs,
    // wall cutouts on specific sides, handles intruding into the lip
    // Z range). Centralised in `lidCompatibility.computeDisabledRails`
    // so the UI rail-summary and the worker placement code stay in sync.
    disabledRails: computeDisabledRails(checkLidCompatibility(params)),
    // Rails only engage in clickRails mode; friction/magnetic force them off so
    // the builder's rail pass is a no-op while the user's per-side choice is
    // preserved on the persisted config.
    clickRails:
      attachment === 'clickRails'
        ? params.lid.clickRails
        : { front: false, back: false, left: false, right: false },
    // Coverage stored as 0–100 percentage on LidConfig; converted to
    // a 0–1 fraction here for direct multiplication against rail lengths.
    clickRailCoverage: params.lid.clickRailCoverage / 100,
    // `extraHeightMm` (issue #2482) deepens the cavity above the lip so tall
    // contents poking out of a short bin are enclosed; 0 = standard lid.
    // Base clearance, NOT `fitClearance` — the magnetic relief is XY-only, and
    // feeding it here would lift the seated plane ~0.42mm into the corner
    // magnets' seat gap. `cavityExtra` (not just `extraHeightMm`) keeps the
    // plate from eating the lip's space; every non-worker `lidAnchorZ` caller
    // resolves the same pair so preview/thumbnail/export can't drift.
    anchorZ: lidAnchorZ(heightUnitMm, LID_FIT_CLEARANCE, cavityExtra),
    wallBottomZ: lidWallBottomZ(heightUnitMm, LID_FIT_CLEARANCE, cavityExtra),
    cellMask,
    text,
    outerOffsetX,
    outerOffsetY,
  };
}
