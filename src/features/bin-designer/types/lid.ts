/**
 * Click-lock lid type definitions.
 *
 * The lid is a parametric companion piece of a bin design that mates with
 * the bin's stacking lip via angled rails on its underside. Its outer
 * footprint is auto-derived from the bin's dimensions (or cellMask polygon)
 * and its mating profile uses the bin's existing LIP_* constants so fit
 * tracks the lip spec automatically.
 *
 * Wall thickness and fit clearance are intentionally NOT user-configurable:
 * the click-lock geometry is a single validated set of numbers, and exposing
 * those knobs invited mis-prints. See `lidConstants.ts` for the live values.
 * The floor plate is the one exception ({@link LidConfig.topThicknessMm}) —
 * it mates with nothing, so thickening it can only add stiffness.
 */

import { isPartialMask, type CellMask } from '@/shared/utils/cellMask';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';
import type { Cutout } from './cutout';

/**
 * Cap on {@link LidConfig.cutouts}.
 *
 * A lid's plate is one face, and past a couple of dozen shapes the boolean cost
 * dominates the build for no design any lid needs. Mirrored server-side in
 * `api/lib/designerValidationConstants.ts`; the client actions refuse past it so
 * an honest oversized payload is rejected rather than silently truncated.
 */
export const MAX_LID_CUTOUTS = 24;

/**
 * The slice of a design the lid resolvers below read. Declared structurally
 * rather than importing `BinParams` from the folder barrel: the barrel
 * re-exports this module, so that import would form a `lid -> index -> lid`
 * cycle. `BinParams` satisfies this shape, so callers pass params straight in.
 */
export interface LidGeometrySource {
  readonly lid: LidConfig;
  readonly base: { readonly stackingLip: boolean; readonly magnetDepth: number };
  readonly cellMask?: CellMask;
}

/**
 * Per-side clearance in mm between the lid's mating profile and the bin's
 * stacking lip surface. Single FDM-validated value — no UI knob.
 */
export const LID_FIT_CLEARANCE = 0.25;

/**
 * Tiny safety floor for rounded rectangle corner radii (avoids OCCT
 * degeneracy when an inner inset equals the outer corner radius). Lives here
 * rather than in the worker's `lidConstants` because the lid cutout window
 * derives its corner radius from the same floor on the main thread.
 */
export const LID_MIN_CORNER_RADIUS = 0.1;

/**
 * Additional per-side footprint clearance (mm) given to a magnetic lid
 *. Magnets supply all the retention, so the mating shell only
 * needs to locate the lid — any residual friction fights the magnets and makes
 * the lid feel like it has to be pressed and prised rather than snapped.
 *
 * Applies to the XY footprint ONLY. It deliberately does NOT feed
 * {@link lidAnchorZ}: that would raise the seated plane by
 * `2·√2·0.15 ≈ 0.42mm` and eat the `LID_MAGNET_SEAT_GAP` (0.2mm) the corner
 * posts rely on. Use {@link resolveLidFootprintClearance} for footprint work
 * and the bare {@link LID_FIT_CLEARANCE} for anchor/Z work.
 */
export const LID_MAGNETIC_EXTRA_CLEARANCE = 0.15;

/**
 * Per-side clearance applied to the lid's OUTER FOOTPRINT — the base value
 * plus the magnetic relief when the design actually gets retention magnets.
 *
 * The predicate mirrors the GEOMETRIC half of `usesMagneticLid` — a magnetic
 * lid on a lip-less or polygon bin falls back to a plain friction fit (no
 * corner bosses are generated), so it must keep the base clearance or it would
 * rattle. It deliberately omits that helper's `lid.enabled` term: a disabled
 * lid is never generated, so its clearance is never consumed.
 */
export function resolveLidFootprintClearance(params: LidGeometrySource): number {
  const magnetic =
    params.lid.attachment === 'magnetic' &&
    params.base.stackingLip &&
    !isPartialMask(params.cellMask);
  return magnetic ? LID_FIT_CLEARANCE + LID_MAGNETIC_EXTRA_CLEARANCE : LID_FIT_CLEARANCE;
}

/** Lid outer corner radius (mm) BEFORE clearance subtraction. Lid-specific —
 *  do NOT use the bin's `BOX_CORNER_RADIUS` (3.75mm), which would shrink
 *  the wall and shift rails. */
export const LID_CORNER_RADIUS = 4;

/** Floor plate thickness (mm) when no magnet pockets are needed. Also the
 *  minimum and default for {@link LidConfig.topThicknessMm}. */
export const LID_TOP_THICKNESS_BASE = 0.8;

/**
 * Bounds for {@link LidConfig.topThicknessMm}. The floor at 0.8mm is four
 * layers at 0.2mm — enough to bridge, but thin enough to read as flimsy and
 * translucent on a large lid. The ceiling keeps a 6×4 lid from
 * turning into an hour of solid infill; the step lands on common layer
 * heights so the plate comes out at a whole number of layers.
 */
export const LID_TOP_THICKNESS_MIN_MM = LID_TOP_THICKNESS_BASE;
export const LID_TOP_THICKNESS_MAX_MM = 5;
export const LID_TOP_THICKNESS_STEP_MM = 0.2;

/** Minimum solid material above a magnet pocket (mm) so it can't punch
 *  through to the cavity face. */
export const LID_MAGNET_CEILING = 0.6;

/**
 * Radial gap (mm) kept between the lid's magnet boss and the stacking lip's
 * inner face. The magnet centre is inset from the nominal corner by
 * `LID_MAGNET_LIP_CLEARANCE + bossRadius`, so the boss hangs into the bin mouth
 * clear of the lip when the lid seats.
 *
 * Lives here rather than in the worker's `lidConstants` because three
 * main-thread callers need it — the compatibility checks, the panel, and the
 * grip-relief depth clamp, which has to know how close a mid-span edge magnet
 * sits to the wall it would cut into.
 */
export const LID_MAGNET_LIP_CLEARANCE = 3.5;

/** Radial plastic kept around a retention magnet inside its post/boss (mm).
 *  1.0mm (2–3 perimeters at a 0.4mm nozzle) keeps the corner post slim: because
 *  the magnet inset is `LID_MAGNET_LIP_CLEARANCE + bossRadius`, a thinner wall pulls the
 *  post's cavity-facing edge inboard (~1mm per 0.5mm of wall) while the boss's
 *  lip-side edge and the magnet mating stay put. */
export const LID_MAGNET_BOSS_WALL = 1.0;

/** Radial material kept around the magnet in its post/boss (mm). */
export function retentionBossRadius(magnetDiameter: number): number {
  return magnetDiameter / 2 + LID_MAGNET_BOSS_WALL;
}

/**
 * Distance (mm) from the nominal footprint edge to the magnet centre.
 *
 * Set so the lid's boss (radius {@link retentionBossRadius}) sits fully INBOARD
 * of the bin's stacking lip: `inset - bossRadius = LID_MAGNET_LIP_CLEARANCE`, so
 * the boss can hang into the mouth without fouling the lip as the lid seats. The
 * bin's corner gusset then reaches back OUT to the interior walls to anchor
 * itself. Both parts use this same inset so their magnets stay coaxial.
 *
 * Here rather than in the worker's `retentionMagnetGeometry` for the same reason
 * {@link LID_MAGNET_LIP_CLEARANCE} is: main-thread callers need the boss
 * footprint. The lid cutout window is the one that forced the move — the editor
 * draws each boss as a keep-out, and it cannot import the worker.
 */
export function retentionMagnetInset(magnetDiameter: number): number {
  return LID_MAGNET_LIP_CLEARANCE + retentionBossRadius(magnetDiameter);
}

/**
 * Minimum solid floor kept below a tray recess (mm) so the recess can't break
 * through into the mating cavity, and the default that floor sits at.
 *
 * 1.6mm is eight layers at 0.2 — a tray holds things, so its floor is a load
 * path, not a bridge to close over. The original 0.8mm matched the plain-lid
 * plate and printed as a floor people described as extremely thin.
 */
export const LID_TRAY_FLOOR = 1.6;

/** Minimum rail length (mm) below which the worker drops the rail. */
export const LID_MIN_RAIL_LENGTH = 4;

/**
 * Bounds for {@link LidConfig.extraHeightMm} — the user-set extra internal
 * cavity depth added ABOVE the default one-grid-unit lid, so tall contents
 * poking out of a short bin are enclosed when the lid is on.
 * `0` = the standard lid (identical geometry to before this field existed).
 * Capped so the separately-printed lid stays within a typical printer's Z.
 *
 * NB: unrelated to the worker-side `LID_EXTRA_HEIGHT` (0.2mm squish fudge in
 * `lidConstants.ts`); this is a millimetre knob, hence the `_MM` suffix.
 */
export const LID_EXTRA_HEIGHT_MIN_MM = 0;
export const LID_EXTRA_HEIGHT_MAX_MM = 100;
export const LID_EXTRA_HEIGHT_STEP_MM = 1;

/**
 * Available click-rail coverage options as a percentage of edge length.
 * Lower values save filament; higher values give more grip surface.
 * 100% = full edge-to-edge rails.
 */
export const LID_CLICK_RAIL_COVERAGE_MIN = 50;
export const LID_CLICK_RAIL_COVERAGE_MAX = 100;
/**
 * 5% rather than the requested 10% for one reason: `migrateClickRailCoverage`
 * snaps every persisted value to the nearest listed option, so dropping 75 would
 * silently re-render every design saved at three-quarter coverage as 70 — a real
 * change to a printed part, with no notice. A 5% step is finer than asked for,
 * costs nothing, and keeps 75 an exact stop.
 */
export const LID_CLICK_RAIL_COVERAGE_STEP = 5;

export const LID_CLICK_RAIL_COVERAGE_OPTIONS: readonly number[] = Array.from(
  {
    length:
      (LID_CLICK_RAIL_COVERAGE_MAX - LID_CLICK_RAIL_COVERAGE_MIN) / LID_CLICK_RAIL_COVERAGE_STEP +
      1,
  },
  (_, i) => LID_CLICK_RAIL_COVERAGE_MIN + i * LID_CLICK_RAIL_COVERAGE_STEP
);

/**
 * How the lid retains onto the bin. Mutually exclusive — a lid holds by
 * exactly one mechanism:
 * - `friction`: the mating shell wraps the lip; no positive retention.
 * - `clickRails`: tapered snap rails on each enabled wall (the historical
 *   behavior; sub-controlled by {@link LidConfig.clickRails}/`clickRailCoverage`).
 * - `magnetic`: press-fit magnets in corner bosses on both the lid and the
 *   bin's stacking lip bond the lid down. Independent of the
 *   lip's grip, so it survives wall cutouts a rail lid couldn't.
 * - `slide`: a flat plate captive in a half-dovetail channel fused to two
 *   opposite inner walls, entered from a third. The only mode that is not a
 *   cap: it has no mating shell, no cavity and no seam, so the knobs that
 *   describe those are forced off (see {@link LidSlideConfig}).
 * - `hinge`: interleaved knuckles on one wall carrying a 1.75mm filament pin,
 *   so the lid stays captive and swings rather than lifting off. It is the one
 *   mode whose name describes a CONSTRAINT rather than a hold: a hinge fixes
 *   one edge and says nothing about the other three, so what keeps the lid
 *   shut is its own sub-choice ({@link LidHingeCatch}). Mutual exclusion still
 *   holds — a hinged lid is not also a rail lid — but the rule reads more
 *   precisely as "exactly one mode owns the lid/bin interface".
 */
export type LidAttachment = 'friction' | 'clickRails' | 'magnetic' | 'slide' | 'hinge';
export const LID_ATTACHMENTS: readonly LidAttachment[] = [
  'friction',
  'clickRails',
  'magnetic',
  'slide',
  'hinge',
] as const;

/**
 * Where a sliding lid's channel sits relative to the bin's rim.
 *
 * - `recessed`: the channel hangs immediately under the stacking lip, so the
 *   bin keeps the lip and stays stackable. The lip on the entry wall is
 *   notched across the opening for the plate to pass.
 * - `flush`: the plate's top face is level with the wall top and the wall's own
 *   material is the retainer. There is no room for a stacking lip at that
 *   height, so this placement requires `base.stackingLip: false` — enforced as
 *   a compatibility blocker rather than silently forced, since turning the lip
 *   off changes a part the user did not ask about.
 */
export type LidSlidePlacement = 'recessed' | 'flush';
export const LID_SLIDE_PLACEMENTS: readonly LidSlidePlacement[] = ['recessed', 'flush'] as const;

/**
 * How the user gets a purchase on the plate to pull it open.
 *
 * - `none`: a bare edge. Only sensible alongside a cutout the user has drawn.
 * - `notch`: a scallop bitten out of the plate's outer edge. Keeps a flush lid
 *   flush and prints without support, since the plate lies flat on the bed.
 * - `tab`: a lug standing proud of the outer edge, in the plate's own plane —
 *   NOT above it, so the plate still prints flat and a flush lid still clears
 *   anything stacked over it. It reaches out past the bin's face, which is what
 *   makes it grabbable with gloves on.
 */
export type LidSlidePull = 'none' | 'notch' | 'tab';
export const LID_SLIDE_PULLS: readonly LidSlidePull[] = ['none', 'notch', 'tab'] as const;

/**
 * Per-side sliding clearance (mm) between the plate and its channel.
 *
 * Exposed, unlike every other lid fit number, because a sliding fit is the one
 * that varies with printer and material rather than with geometry: the same
 * clearance that glides on one machine binds on the next. The half-dovetail
 * absorbs a range of it (the wedge takes up slop instead of rattling), which is
 * what makes a knob safe to offer at all.
 *
 * 0.25 matches {@link LID_FIT_CLEARANCE} and is the value the channel's bearing
 * overlap is sized against.
 */
export const LID_SLIDE_CLEARANCE_MIN_MM = 0.1;
export const LID_SLIDE_CLEARANCE_MAX_MM = 0.6;
export const LID_SLIDE_CLEARANCE_DEFAULT_MM = 0.25;
export const LID_SLIDE_CLEARANCE_STEP_MM = 0.05;

/**
 * Floor (mm) on a sliding lid's plate thickness.
 *
 * Eight layers at 0.2. A capping lid is held on all four sides by its own shell
 * and can be the 0.8mm {@link LID_TOP_THICKNESS_BASE}; a sliding plate is a
 * beam supported on two edges, and it also has to carry the retaining chamfer
 * through its own section — at 0.8mm that chamfer resolves to 0.2mm and the
 * joint barely engages. Lives here rather than in `slideLidPlan` because
 * {@link resolveLidPlateThickness} applies it and the plan reads the result;
 * the other direction would close an import cycle.
 */
export const LID_SLIDE_PLATE_MIN_MM = 1.6;

/** Sliding-lid configuration. Read only when `attachment === 'slide'`. */
export interface LidSlideConfig {
  /** See {@link LidSlidePlacement}. */
  readonly placement: LidSlidePlacement;
  /**
   * The wall the plate enters and leaves through. The two walls PERPENDICULAR
   * to it carry the channel; this one carries the notch.
   *
   * Explicit rather than derived from the footprint's long axis: a dispenser
   * faces a particular way in a drawer, and rotating the whole design to change
   * which face opens is not a substitute for choosing.
   */
  readonly entrySide: LidRailSide;
  /** Per-side sliding clearance (mm). See {@link LID_SLIDE_CLEARANCE_DEFAULT_MM}. */
  readonly clearanceMm: number;
  /** See {@link LidSlidePull}. */
  readonly pull: LidSlidePull;
  /**
   * Ramped bump on the shelf that the plate's trailing edge clicks past, so a
   * knocked or tipped bin does not shed its lid — the failure the feature
   * request opens with.
   *
   * Ramped rather than square on both counts that matter: it prints without
   * support (it grows out of the shelf at 45°), and it can be pushed past by
   * hand, so the plate still comes all the way out. The end stop at the closed
   * end is unconditional and has no flag — a plate that can overshoot its own
   * seat has no defined closed position.
   */
  readonly detent: boolean;
}

/**
 * Whether this lid is a sliding plate.
 *
 * Takes the config rather than the whole design so it can be used inside
 * {@link resolveLidPlateThickness} and friends, which several modules reach
 * before they have a full `BinParams`. Deliberately does NOT consult
 * `lid.enabled`: the resolvers it gates are asked about the shape of the lid a
 * design describes, not about whether one is being built today.
 */
export function isSlideLid(lid: Pick<LidConfig, 'attachment'>): boolean {
  return lid.attachment === 'slide';
}

/**
 * This design's sliding-lid config, or the factory one when it carries no
 * opinion.
 *
 * The single reader for {@link LidConfig.slide}: the field is absent on every
 * design that has never used a sliding lid, and every consumer would otherwise
 * need its own fallback — which is one more place for the default to drift.
 */
export function resolveLidSlide(lid: Pick<LidConfig, 'slide'>): LidSlideConfig {
  return lid.slide ?? DEFAULT_LID_SLIDE_CONFIG;
}

/** True when this config is the factory one, so migration can drop it. */
export function isDefaultLidSlide(slide: LidSlideConfig): boolean {
  return (
    slide.placement === DEFAULT_LID_SLIDE_CONFIG.placement &&
    slide.entrySide === DEFAULT_LID_SLIDE_CONFIG.entrySide &&
    slide.clearanceMm === DEFAULT_LID_SLIDE_CONFIG.clearanceMm &&
    slide.pull === DEFAULT_LID_SLIDE_CONFIG.pull &&
    slide.detent === DEFAULT_LID_SLIDE_CONFIG.detent
  );
}

/** Factory sliding-lid config. Only read when the attachment is `'slide'`. */
export const DEFAULT_LID_SLIDE_CONFIG: LidSlideConfig = {
  // Keeps the bin a Gridfinity bin: the lip survives and nothing else in the
  // design has to change to try the feature out.
  placement: 'recessed',
  entrySide: 'front',
  clearanceMm: LID_SLIDE_CLEARANCE_DEFAULT_MM,
  pull: 'notch',
  detent: true,
} as const;

/* ──────────────────────────────────────────────────────────────────────
 * Hinged lid
 * ──────────────────────────────────────────────────────────────────── */

/**
 * How a hinged lid is held SHUT. The hinge itself only controls one edge —
 * without a catch the lid is held closed by nothing but its own weight.
 *
 * - `none`: bare. Honest for a lid that only keeps dust out, and the right
 *   answer when the design already has a cutout the user grabs instead.
 * - `detent`: a ramped bump on the wall opposite the axis that the lid's edge
 *   clicks past. Reuses the click-rail cross-section, prints without support,
 *   and can be pushed past by hand.
 * - `magnets`: a press-fit pair in bosses on the lid edge and the bin's lip.
 *   The strongest hold and the only one that survives a wall cutout opposite
 *   the hinge, at the cost of two magnets the user has to source.
 */
export type LidHingeCatch = 'none' | 'detent' | 'magnets';
export const LID_HINGE_CATCHES: readonly LidHingeCatch[] = ['none', 'detent', 'magnets'] as const;

/**
 * Nominal diameter (mm) of the pin the hinge is designed around: a plain
 * 1.75mm filament offcut, which every user of this app has by definition.
 */
export const LID_HINGE_PIN_MM = 1.75;

/**
 * Running bore (mm) through the knuckles. 0.25 over the pin, the same
 * per-side working clearance a Gridfinity foot takes in its cell — loose
 * enough to swing freely on a printer that already seats bins, tight enough
 * that the lid does not rattle.
 */
export const LID_HINGE_BORE_MM = 2.0;

/**
 * Bore (mm) of the ENTRY knuckle only — undersized so the pin press-fits
 * there and cannot walk out, while every other knuckle stays a running fit.
 * The far end is left open on purpose: the hinge stays serviceable, because a
 * second offcut drives the pin back out.
 */
export const LID_HINGE_ENTRY_BORE_MM = 1.85;

/**
 * Material (mm) around the bore. Sets the barrel radius, and with it both how
 * far the knuckles stand proud of the rim and how much lip the notch eats —
 * so it is a geometry constant, not a knob.
 */
export const LID_HINGE_KNUCKLE_WALL_MM = 1.2;

/** Outer radius (mm) of the hinge barrel. Derived so the two cannot drift. */
export const LID_HINGE_BARREL_RADIUS_MM = LID_HINGE_BORE_MM / 2 + LID_HINGE_KNUCKLE_WALL_MM;

/**
 * Gap (mm) between the barrel's outer surface and the wall's outer face.
 *
 * Sitting the barrel exactly TANGENT to that face is the obvious construction
 * and the wrong one. Tangency means the cylinder meets the plane along a single
 * line, and a boolean over a knife-edge contact is where kernels produce
 * slivers and coincident faces: it showed up here as broken parity in the
 * column probes — an odd crossing count, which `meshAssertions` warns reads a
 * lower surface as an upper one — while every mesh statistic stayed plausible.
 *
 * A small deliberate relief removes the degeneracy, and it reads better: the
 * barrel becomes a distinct element with its own shadow line instead of
 * smearing into the wall face. The footprint is unaffected either way, since
 * this only ever moves the barrel further INBOARD.
 */
export const LID_HINGE_FACE_RELIEF_MM = 0.2;

/**
 * Where the lid comes to rest, in degrees from shut.
 *
 * Past vertical on purpose: at 90° a lid balances and falls shut on the hand
 * reaching into the bin, and every impact is taken by the pin. Past it, gravity
 * holds the lid open and the load sits on two broad butting faces instead.
 *
 * It costs nothing to build — the faces that butt are the trim planes the
 * swing clearance already requires, so this number IS that trim's angle.
 */
export const LID_HINGE_STOP_ANGLE_DEG = 105;

/**
 * Extra reach (mm) the stop lobe gets past the corner it lands on.
 *
 * The lobe only has to REACH the bin's lip-top outer corner — the stop angle is
 * set by the trim plane's tilt, not by this, because a plane through the axis
 * contains that corner at one angle whatever its radius. So this is margin
 * against tessellation and print tolerance, and nothing more. Every millimetre
 * of it is a millimetre the lobe sweeps outside the bin's footprint while the
 * lid is open, which is why it is small.
 */
export const LID_HINGE_STOP_MARGIN_MM = 0.15;

/**
 * Angular width (deg) of the stop lobe on each lid knuckle.
 *
 * Wide enough to be a lug rather than a knife edge, narrow enough that the
 * barrel still reads as one continuous cylinder: at this width the lobe adds
 * ~0.7mm to the knuckle's silhouette at its peak, which looks like the cam it
 * is. Its leading face is the trim plane itself, so widening it can only ever
 * move the trailing edge — the stop angle cannot drift with this number.
 */
export const LID_HINGE_STOP_SECTOR_DEG = 24;

/**
 * Edge break (mm) on both lips of the hinge seam.
 *
 * The gap itself is constant for free (both faces are surfaces of revolution
 * about the axis), but a bare 0.25mm hairline at FDM resolution reads as a
 * part that did not quite fit. Chamfering both sides turns it into a shadow
 * groove that reads as intent, breaks the two edges that would scuff first,
 * and gives the nose's first layer somewhere to go when it spreads.
 */
export const LID_HINGE_SEAM_CHAMFER_MM = 0.4;

/**
 * Per-side running clearance (mm) between a knuckle and its neighbour, and
 * between the barrel and the pocket it swings in.
 *
 * Exposed for the same reason {@link LID_SLIDE_CLEARANCE_DEFAULT_MM} is, and
 * no other lid fit number: a running fit is the one that varies with printer
 * and material rather than with geometry. Filament itself runs 1.70-1.80mm,
 * so the pin this hinge is built around is not even a fixed diameter.
 */
export const LID_HINGE_FIT_MIN_MM = 0.15;
export const LID_HINGE_FIT_MAX_MM = 0.4;
export const LID_HINGE_FIT_DEFAULT_MM = 0.25;
export const LID_HINGE_FIT_STEP_MM = 0.05;

/**
 * Target knuckle width (mm) the layout aims for before rounding to an odd
 * count. Wide enough that a knuckle root is not a stress riser, narrow enough
 * that a 1u wall still gets three.
 */
export const LID_HINGE_KNUCKLE_TARGET_MM = 11;

/**
 * Rail coverage a hinged lid's detent takes, as a fraction of its wall.
 *
 * Shorter than any coverage the click-rail control offers, and deliberately: a
 * click-lock lid is meant to resist being lifted anywhere along its edge, while
 * a hinged lid is meant to be FLIPPED. A full-length rail opposite a hinge is a
 * lid that has to be prised. Centred, which is where an unsupported free edge
 * lifts first.
 */
export const LID_HINGE_DETENT_COVERAGE = 0.4;

/** Narrowest knuckle (mm) worth building. Below it the root snaps off. */
export const LID_HINGE_KNUCKLE_MIN_MM = 5;

/** Bounds on the knuckle count within one run. Always odd — see the plan. */
export const LID_HINGE_MIN_KNUCKLES = 3;
export const LID_HINGE_MAX_KNUCKLES = 15;

/**
 * How far (mm) the barrel stays clear of each corner of its wall.
 *
 * The corner is where the hinge wall and its neighbours meet, and it is also
 * where the lid's side shells come down. Keeping the barrel out of it leaves
 * the corner intact for both.
 */
export const LID_HINGE_CORNER_INSET_MM = 3;

/**
 * Shortest surviving stretch (mm) of wall that can carry a knuckle group.
 *
 * A run has to hold at least {@link LID_HINGE_MIN_KNUCKLES} at the minimum
 * width to be worth anything; below that the stretch is skipped rather than
 * filled with knuckles too small to hold.
 */
export const LID_HINGE_MIN_RUN_MM = LID_HINGE_MIN_KNUCKLES * LID_HINGE_KNUCKLE_MIN_MM;

/**
 * Hinged-lid configuration. Read only when `attachment === 'hinge'`.
 *
 * Deliberately three fields. The knuckle layout is derived from the wall
 * (see `@/shared/utils/hingeLidPlan`) because a count is not a choice anyone
 * has a basis to make, and the bore is fixed because the pin is fixed. What
 * is left is the two things that are genuinely the user's: which way the bin
 * opens, and what holds it shut — plus the one fit number that varies by
 * machine.
 */
export interface LidHingeConfig {
  /**
   * The wall the axis runs along.
   *
   * Explicit rather than derived from the footprint, for the same reason
   * {@link LidSlideConfig.entrySide} is: a bin faces a particular way in a
   * drawer, and rotating the whole design to change which way the lid opens
   * is not a substitute for choosing.
   */
  readonly side: LidRailSide;
  /** See {@link LidHingeCatch}. */
  readonly catchMode: LidHingeCatch;
  /** Per-side running clearance (mm). See {@link LID_HINGE_FIT_DEFAULT_MM}. */
  readonly fitClearanceMm: number;
}

/**
 * Whether this lid is hinged.
 *
 * Takes the config rather than the whole design, and deliberately does NOT
 * consult `lid.enabled` — both for the same reasons {@link isSlideLid} does
 * not.
 */
export function isHingeLid(lid: Pick<LidConfig, 'attachment'>): boolean {
  return lid.attachment === 'hinge';
}

/**
 * This design's hinge config, or the factory one when it carries no opinion.
 *
 * The single reader for {@link LidConfig.hinge}: the field is absent on every
 * design that has never used a hinge, and every consumer would otherwise need
 * its own fallback — which is one more place for the default to drift.
 */
export function resolveLidHinge(lid: Pick<LidConfig, 'hinge'>): LidHingeConfig {
  return lid.hinge ?? DEFAULT_LID_HINGE_CONFIG;
}

/** True when this config is the factory one, so migration can drop it. */
export function isDefaultLidHinge(hinge: LidHingeConfig): boolean {
  return (
    hinge.side === DEFAULT_LID_HINGE_CONFIG.side &&
    hinge.catchMode === DEFAULT_LID_HINGE_CONFIG.catchMode &&
    hinge.fitClearanceMm === DEFAULT_LID_HINGE_CONFIG.fitClearanceMm
  );
}

/** Factory hinge config. Only read when the attachment is `'hinge'`. */
export const DEFAULT_LID_HINGE_CONFIG: LidHingeConfig = {
  // The wall furthest from the user in a drawer, so the open lid falls away
  // from the hand rather than across the opening.
  side: 'back',
  catchMode: 'detent',
  fitClearanceMm: LID_HINGE_FIT_DEFAULT_MM,
} as const;

/** The wall opposite a hinge — where the catch and the thumb lift belong. */
export function hingeOppositeSide(side: LidRailSide): LidRailSide {
  switch (side) {
    case 'front':
      return 'back';
    case 'back':
      return 'front';
    case 'left':
      return 'right';
    case 'right':
      return 'left';
  }
}

/**
 * Bounds for the dedicated lid-retention magnet. Separate from
 * the bin's `base` magnet so a design can hold its lid with a different magnet
 * than it uses in its feet. Defaults to the common 6mm × 2mm disc.
 */
export const LID_MAGNET_DIAMETER_MIN_MM = 3;
export const LID_MAGNET_DIAMETER_MAX_MM = 15;
export const LID_MAGNET_DIAMETER_DEFAULT_MM = 6;
export const LID_MAGNET_DEPTH_MIN_MM = 1;
export const LID_MAGNET_DEPTH_MAX_MM = 6;
export const LID_MAGNET_DEPTH_DEFAULT_MM = 2;
export const LID_MAGNET_DIMENSION_STEP_MM = 0.5;

/**
 * Bounds for the optional edge-retention magnets. Four corner
 * magnets pin only the corners of a lid, so on a large lid the middle of a long
 * unsupported span bows up. `edgeMagnets` adds this many extra magnets along
 * each sufficiently long edge — evenly spaced between the corners — pulling the
 * centre of the span down too.
 *
 * `0` = the classic four-corner lid, and the default, so every older design
 * regenerates byte-identically. The magnets only materialise on edges long
 * enough to keep each one clear of its neighbours and the corners (see
 * `retentionMagnetPositions`), so a small lid with a non-zero count simply gets
 * none — the count is a ceiling, not a guarantee.
 */
export const LID_MAGNET_EDGE_COUNT_MIN = 0;
export const LID_MAGNET_EDGE_COUNT_MAX = 3;
export const LID_MAGNET_EDGE_COUNT_DEFAULT = 0;
export const LID_MAGNET_EDGE_COUNT_STEP = 1;

/**
 * Bounds for the {@link LidTrayConfig} recess — a shallow tray shelled into the
 * lid's top face (offered only when the lid has no stackable baseplate). Depth
 * is how far the recess sinks below the top surface; wall is the rim thickness
 * kept between the recess and the lid's outer perimeter.
 */
export const LID_TRAY_DEPTH_MIN_MM = 1;
export const LID_TRAY_DEPTH_MAX_MM = 30;
export const LID_TRAY_DEPTH_DEFAULT_MM = 4;
export const LID_TRAY_WALL_MIN_MM = 1;
export const LID_TRAY_WALL_MAX_MM = 10;
export const LID_TRAY_WALL_DEFAULT_MM = 2;
export const LID_TRAY_DIMENSION_STEP_MM = 0.5;

/** Dedicated lid-retention magnet dimensions (mm). See {@link LidAttachment}. */
export interface LidMagnetConfig {
  readonly diameter: number;
  readonly depth: number;
  /**
   * Extra magnets placed along each long edge, between the corners (issue
   *). Anti-sag reinforcement for large lids — `0` keeps the four-corner
   * lid. Bounded by {@link LID_MAGNET_EDGE_COUNT_MIN}/{@link LID_MAGNET_EDGE_COUNT_MAX};
   * only actually placed on edges long enough to space them clear of the
   * corners, so the value is a ceiling per edge rather than a guarantee.
   */
  readonly edgeMagnets: number;
}

/**
 * Shelled "tray" recess on the lid's top face. Only meaningful
 * when the lid is NOT stackable — a stack grid and a recess can't share the
 * top surface, so `resolveLidInputs` forces `enabled` off when `stackableTop`
 * is on.
 */
export interface LidTrayConfig {
  readonly enabled: boolean;
  readonly depthMm: number;
  readonly wallMm: number;
}

/**
 * Effective floor-plate thickness (mm) — a FLOOR, never a cap, so no
 * combination of settings can punch a magnet pocket into the cavity or break
 * through a tray recess.
 *
 * The single source of truth: the worker, the preview, the thumbnail, and the
 * export assembly all size and position the lid from this.
 *
 * `topThicknessMm` measures a different surface depending on whether a tray is
 * cut into the top. Without one it is the whole plate. With one it is the
 * material left UNDER the recess — the dimension a user actually cares about,
 * since that is the tray's own floor. Treating it as the whole plate made the
 * knob inert: `max(plate, recess + floor)` pinned a default 4mm tray at 4.8mm,
 * so every value below that changed nothing visible and the floor was always
 * the bare minimum.
 */
export function resolveLidPlateThickness(params: LidGeometrySource): number {
  const { lid, base } = params;
  // A sliding lid IS the plate — no stack grid over it, no recess in it, no
  // magnet pocket under it, because `isSlideLid` forces all three off. Its
  // thickness is therefore the knob alone, and every term below would be
  // reading a field the geometry does not build.
  if (isSlideLid(lid)) return Math.max(LID_SLIDE_PLATE_MIN_MM, lid.topThicknessMm);
  if (lid.tray.enabled && !lid.stackableTop) {
    // A tray forces `stackableTop` off, so magnet pockets can't also apply.
    return Math.max(
      LID_TOP_THICKNESS_BASE,
      lid.tray.depthMm + Math.max(lid.topThicknessMm, LID_TRAY_FLOOR)
    );
  }
  const magnetNeed =
    lid.magnetHoles && lid.stackableTop ? base.magnetDepth + LID_MAGNET_CEILING : 0;
  return Math.max(LID_TOP_THICKNESS_BASE, lid.topThicknessMm, magnetNeed);
}

/**
 * The thickness breakdown a tray lid's UI reports: what the user set, what the
 * recess takes, and what the plate ends up at. Derived from the same resolver
 * the geometry uses so the readout can't drift from the printed part.
 */
export function resolveLidTrayBreakdown(params: LidGeometrySource): {
  /** Solid material left below the recess. */
  readonly floorMm: number;
  /** Depth of the recess cut into the top face. */
  readonly recessMm: number;
  /** Total plate thickness — floor plus recess. */
  readonly overallMm: number;
} | null {
  if (!params.lid.tray.enabled || params.lid.stackableTop) return null;
  if (isSlideLid(params.lid)) return null;
  const overallMm = resolveLidPlateThickness(params);
  return {
    floorMm: overallMm - params.lid.tray.depthMm,
    recessMm: params.lid.tray.depthMm,
    overallMm,
  };
}

/**
 * Total cavity depth (mm) added below the standard one-grid-unit lid — the
 * `extraHeightMm` knob PLUS however much the floor plate grew past its 0.8mm
 * baseline. Feeds `lidAnchorZ`/`lidWallBottomZ` everywhere.
 *
 * Why the plate growth belongs here: the floor is built downward from the top
 * face (`Z ∈ [-plateThickness, 0]`), so every millimetre of extra plate eats a
 * millimetre of the cavity the bin's stacking lip has to enter. Past
 * `|anchorZ|` (~2.09mm) the plate fills the lip's space outright and the lid
 * can no longer seat — a 5mm plate leaves a solid block with a 0.79mm skirt.
 * Deepening the anchor in lockstep keeps the plate-to-anchor gap constant, so
 * the lid just gets taller (exactly what `extraHeightMm` already does).
 */
export function resolveLidCavityExtraMm(params: LidGeometrySource): number {
  // There is no cavity on a sliding lid, so there is nothing for either term to
  // deepen. Returning the plate's growth anyway would feed `lidAnchorZ` a seam
  // plane for a joint this lid does not have, and `tallLidShortBin` would warn
  // about a lever arm that is not there.
  if (isSlideLid(params.lid)) return 0;
  return params.lid.extraHeightMm + (resolveLidPlateThickness(params) - LID_TOP_THICKNESS_BASE);
}

/** Wall sides that can carry a click rail. Same axis convention as the bin. */
export type LidRailSide = 'front' | 'back' | 'left' | 'right';
export const LID_RAIL_SIDES: readonly LidRailSide[] = ['front', 'back', 'left', 'right'] as const;

/**
 * Per-side click-rail toggle. Each wall is independent — users can ship
 * a one-sided "hinge" lid (only front/back), a label-friendly symmetric
 * pair (left/right only), or any other combination. All four false ⇒
 * friction-fit lid (no snap engagement at all).
 */
export interface LidClickRails {
  readonly front: boolean;
  readonly back: boolean;
  readonly left: boolean;
  readonly right: boolean;
}

/**
 * Grip-relief mode — how material is removed at the lid/bin seam so the lid
 * can be got off again (discussion: a well-fitting click-lock lid has
 * no purchase for a fingernail and came off with a screwdriver).
 *
 * All three remove material from the lid only; `chamfer` and `reveal` treat
 * the seam line, `scallop` cuts a fingertip pocket that also bites into the
 * floor plate's outer edge.
 */
export type LidGripMode = 'none' | 'chamfer' | 'reveal' | 'scallop';

export const LID_GRIP_MODES: readonly LidGripMode[] = [
  'none',
  'chamfer',
  'reveal',
  'scallop',
] as const;

/**
 * Span bounds (mm) for a relief along one wall.
 *
 * Coverage is a percentage so it reads like `clickRailCoverage`, but a rail
 * wants to scale with the wall (more rail = more retention) and a grip does
 * not: 50% of a 6-wide lid is a 126mm trench, and no hand needs that. The
 * clamp keeps the span between "one fingertip" and "a whole hand" whatever
 * the lid measures.
 */
export const LID_GRIP_SPAN_MIN_MM = 15;
export const LID_GRIP_SPAN_MAX_MM = 40;

/** Coverage bounds (%) for {@link LidGripConfig.coverage}. */
export const LID_GRIP_COVERAGE_MIN = 10;
export const LID_GRIP_COVERAGE_MAX = 100;
export const LID_GRIP_COVERAGE_STEP = 5;
export const LID_GRIP_COVERAGE_DEFAULT = 50;

/**
 * Material kept between a relief's inner face and the mating cavity (mm).
 *
 * Three perimeters at 0.4mm. Below this the wall stops being a wall — and the
 * failure is invisible to every cheap assertion, since a lid whose relief has
 * broken through into the cavity is still a closed, watertight surface.
 */
export const LID_GRIP_MIN_WALL_MM = 1.2;

/** Requested (pre-clamp) inward depth per mode, in mm. */
export const LID_GRIP_CHAMFER_MM = 1;
export const LID_GRIP_REVEAL_DEPTH_MM = 1;
export const LID_GRIP_SCALLOP_DEPTH_MM = 1.5;

/** Height of the reveal groove above the seam (mm). */
export const LID_GRIP_REVEAL_HEIGHT_MM = 1.6;
/**
 * How far a scallop ASKS to reach above the seam (mm) when
 * {@link LidGripConfig.heightMm} is left on auto.
 *
 * A request, not a height: the whole skirt above the seam is only `|anchorZ|`
 * tall — about 2.1mm on a default lid, since a lid is a thin cap — so this is
 * clamped by {@link resolveLidGripHeightPlan}. Set generously so lids that are
 * genuinely taller (`extraHeightMm`, a thick floor plate) get the deeper
 * pocket their extra skirt allows.
 */
export const LID_GRIP_SCALLOP_HEIGHT_MM = 4;

/**
 * Bounds for a user-set {@link LidGripConfig.heightMm}.
 *
 * The floor is four layers at 0.2mm; below that a pocket stops reading as a
 * pocket. The ceiling serves the tall lid the request came from: a deep
 * `extraHeightMm` skirt can carry a genuine fingertip pocket, not just a nail
 * catch. Both bounds land on whole layers at the common layer height, since
 * layer adhesion is the thing being traded here.
 */
export const LID_GRIP_HEIGHT_MIN_MM = 0.8;
export const LID_GRIP_HEIGHT_MAX_MM = 10;
export const LID_GRIP_HEIGHT_STEP_MM = 0.2;

/**
 * Solid lid kept above a relief (mm).
 *
 * Two jobs. It stops a scallop on a standard lid reaching past `Z = 0` and
 * notching the top face, turning a grip pocket into a bite out of the outline.
 * And it is the load path: the lid exports rotated 180°, so this skin's layer
 * lines run across the pocket and a thin one peels there rather than breaks.
 * That is the failure the reporter of predicted at the original 0.4mm,
 * which is two layers. Four layers hold. Raising it shortens an already skirt-bound relief
 * on existing designs, which is the intended trade.
 */
export const LID_GRIP_TOP_SKIN_MM = 0.8;

/**
 * How tall the relief ASKS to be (mm): the user's value, or the mode's own
 * request when left on auto.
 *
 * Only the two modes with a height independent of their depth read the stored
 * value; see {@link lidGripHeightAdjustable}. A chamfer's 45° section is sized
 * by whichever of depth and height is scarcer, so it has no height control,
 * and a knob the user cannot see must not move the geometry. Switching scallop
 * → chamfer therefore lands on exactly the chamfer that mode built before this
 * field existed.
 */
export function lidGripRequestedHeightMm(grip: Pick<LidGripConfig, 'mode' | 'heightMm'>): number {
  if (!lidGripHeightAdjustable(grip.mode) || grip.heightMm === null) {
    return lidGripHeightMm(grip.mode);
  }
  return Math.min(Math.max(grip.heightMm, LID_GRIP_HEIGHT_MIN_MM), LID_GRIP_HEIGHT_MAX_MM);
}

/**
 * Whether {@link LidGripConfig.heightMm} means anything in this mode, and so
 * whether the panel offers the control. Shared with the panel so a mode that
 * ignores the field can never be shown a field that does nothing.
 */
export function lidGripHeightAdjustable(mode: LidGripMode): boolean {
  return mode === 'reveal' || mode === 'scallop';
}

/**
 * The resolved height of a grip relief, what bounded it, and what it leaves
 * behind. Same contract as {@link LidGripDepthPlan}: the geometry silently
 * takes less than was asked for, and the panel needs enough to say why.
 */
export interface LidGripHeightPlan {
  /** What the geometry actually cuts above the seam. */
  readonly heightMm: number;
  readonly requestedMm: number;
  /** Whole skirt above the seam: the budget `heightMm` is drawn from. */
  readonly skirtMm: number;
  /** Solid lid left above the relief. Never below {@link LID_GRIP_TOP_SKIN_MM}. */
  readonly skinMm: number;
  readonly clamped: boolean;
  /**
   * `skirt`: the lid is not tall enough; a taller lid buys more.
   * `depth`: a chamfer's 45° section ran out of depth first, which the depth
   *          clamp's own hint already explains.
   */
  readonly limitedBy: 'skirt' | 'depth' | null;
}

/**
 * Resolve how tall a grip relief may cut, and how much lid that leaves above
 * it.
 *
 * `anchorZ` is the seam plane in lid-local Z (negative, from
 * {@link lidAnchorZ}); the lid's top face is Z = 0. `depthMm` is the resolved
 * cut depth ({@link resolveLidGripDepth}), which a chamfer's height is tied
 * to. Folding that in here rather than at the cutter keeps the panel's readout
 * describing the geometry that is actually built.
 *
 * Shared with the panel so the readout and the geometry cannot disagree.
 */
export function resolveLidGripHeightPlan(
  grip: Pick<LidGripConfig, 'mode' | 'heightMm'>,
  anchorZ: number,
  depthMm: number
): LidGripHeightPlan {
  const skirtMm = Math.max(-anchorZ, 0);
  const available = Math.max(skirtMm - LID_GRIP_TOP_SKIN_MM, 0);
  const requestedMm = lidGripRequestedHeightMm(grip);
  const fitsSkirt = Math.min(requestedMm, available);
  // A 45° wedge's two legs are equal, so a chamfer is sized by whichever of
  // depth and height is scarcer.
  const heightMm = grip.mode === 'chamfer' ? Math.min(fitsSkirt, depthMm) : fitsSkirt;

  return {
    heightMm,
    requestedMm,
    skirtMm,
    skinMm: Math.max(skirtMm - heightMm, 0),
    clamped: heightMm < requestedMm,
    limitedBy: fitsSkirt < requestedMm ? 'skirt' : heightMm < requestedMm ? 'depth' : null,
  };
}

/** Below this effective depth a relief is not worth generating (mm). */
export const LID_GRIP_MIN_USEFUL_DEPTH_MM = 0.4;

/**
 * Per-side relief toggles. Structurally identical to {@link LidClickRails} and
 * indexed by the same {@link LidRailSide}, so a side that carries both is
 * directly comparable when the rail has to be split around the relief.
 */
export interface LidGripSides {
  readonly front: boolean;
  readonly back: boolean;
  readonly left: boolean;
  readonly right: boolean;
}

/** Grip relief configuration. Nested on {@link LidConfig}. */
export interface LidGripConfig {
  /** `'none'` disables the feature entirely — the default, so a saved design
   *  from before this existed regenerates byte-identically. */
  readonly mode: LidGripMode;
  /** Which walls carry the relief. Ignored when `mode` is `'none'`. */
  readonly sides: LidGripSides;
  /** Percentage of each wall's straight run, centered, then clamped to
   *  [{@link LID_GRIP_SPAN_MIN_MM}, {@link LID_GRIP_SPAN_MAX_MM}]. */
  readonly coverage: number;
  /**
   * How far the relief reaches above the seam (mm), or `null` for the mode's
   * own request (4mm for a scallop, 1.6mm for a shadow line).
   *
   * `null` rather than a number so a saved design carries no opinion until the
   * user forms one, and so switching modes tracks the mode rather than
   * stranding a value the new mode never asked for. Always a REQUEST:
   * {@link resolveLidGripHeightPlan} still clamps it against the skirt, and a
   * chamfer ignores it entirely.
   *
   * The knob exists because the auto height is generous by design and the lid
   * prints upside down: on a tall lid a 4mm scallop leaves the material above
   * it thin enough to peel along a layer line.
   */
  readonly heightMm: number | null;
  /**
   * Also dip the BIN's stacking lip to full lip height across the relief span,
   * so a finger gets under the lid rather than only against it.
   *
   * Placement is inherited from the fields above rather than configured
   * separately: a dip that does not line up with the lid's own relief is a
   * wasted pair of prints. Off by default — this changes bin geometry, and the
   * lip it removes is what an upper bin registers against when stacked.
   */
  readonly binDip: boolean;
}

/** Click-lock lid configuration. Stored as a sub-object on `BinParams`. */
export interface LidConfig {
  /** Master toggle. When false, no lid is generated regardless of other fields. */
  readonly enabled: boolean;
  /**
   * Retention mechanism. Exactly one of friction/clickRails/
   * magnetic. `clickRails` reads the per-side {@link clickRails} object and
   * `clickRailCoverage`; `magnetic` reads {@link retentionMagnet}; `friction`
   * uses neither. The worker forces the click rails off unless this is
   * `'clickRails'`, so switching modes preserves the per-side selection
   * without generating it.
   *
   * Migration: legacy designs (pre-attachment) derive this from their rails —
   * any side `true` → `'clickRails'`, otherwise `'friction'`.
   */
  readonly attachment: LidAttachment;
  /** Include Gridfinity stack-grid pattern on top of lid (other bins stack on it). */
  readonly stackableTop: boolean;
  /**
   * Cut ONE pocket spanning the whole footprint instead of one per grid cell
   * — a perimeter stacking lip, no interior grid ridges. Requires
   * `stackableTop`. Same baseplate-spec taper outside, so an upper bin still
   * seats; it just locates on the outer lip rather than cell-by-cell.
   *
   * NB: unrelated to `base.stackingLip`, which is the BIN's own top-rim lip.
   */
  readonly stackLipOnly: boolean;
  /** Include magnet holes in the lid (uses bin's BaseConfig magnetDiameter).
   *  Requires `stackableTop`: pockets only do something when a bin can
   *  stack on the lid above them. */
  readonly magnetHoles: boolean;
  /**
   * Print the stack-grid baseplate as a SEPARATE companion piece instead of
   * fusing it onto the lid's top. Requires `stackableTop` — the baseplate IS
   * the stack grid, so it only exists when a stackable top is enabled.
   *
   * Why split: on export the lid rotates 180° (floor down) so its mating
   * cavity/rails print support-free — but that same rotation flips a fused
   * stack grid pockets-down onto the bed, a mess of overhangs. Split, the
   * baseplate prints flat (pockets up, glue-face down) and the user glues it
   * onto the lid's flat top. The glue face is the slab's flat Z=0 bottom and
   * its outline matches the lid footprint, so edges seat flush.
   */
  readonly separateStackPlate: boolean;
  /**
   * Per-side click-rail engagement. Each wall is independent. When all
   * four are `false`, the lid is friction-fit only (mating cavity wraps
   * the lip, no positive snap). When some are `false` the lid clicks
   * asymmetrically — useful for hinged-feel removal or for designs
   * where one wall has cutouts/labels that conflict with a rail.
   * `clickRailCoverage` applies to whichever sides are enabled.
   *
   * Migration: legacy `boolean` values get expanded by `migrateParams`:
   * `true` → all four sides true, `false` → all four false.
   */
  readonly clickRails: LidClickRails;
  /**
   * Click-rail coverage as a percentage of each wall's edge length (50–100).
   * Rails are always centered on their wall; lower values shorten them
   * symmetrically to save filament. Use a value from
   * `LID_CLICK_RAIL_COVERAGE_OPTIONS`. Only affects sides where
   * `clickRails[side]` is `true`.
   */
  readonly clickRailCoverage: number;
  /**
   * Extra internal cavity depth (mm) added ABOVE the default one-grid-unit
   * lid, so contents that stick up out of a short bin are enclosed when the
   * lid is on ( — e.g. a toothpick holder). `0` reproduces the
   * standard lid exactly. Clamped to
   * [{@link LID_EXTRA_HEIGHT_MIN_MM}, {@link LID_EXTRA_HEIGHT_MAX_MM}].
   * The lip-mating shell and click rails stay at the bottom of the cavity;
   * this only lengthens the plain wall above the lip.
   */
  readonly extraHeightMm: number;
  /**
   * Floor plate thickness (mm) — the solid slab between the lid's top face
   * and its mating cavity. A FLOOR, not a cap: magnet pockets
   * and a tray recess still raise the plate above this when they need more
   * material (see {@link resolveLidPlateThickness}). Nothing mates with this
   * surface, so
   * raising it only trades filament for stiffness and opacity.
   */
  readonly topThicknessMm: number;
  /**
   * Dedicated retention-magnet dimensions used only when
   * {@link attachment} === `'magnetic'`. Independent of the bin's `base`
   * magnet so the lid and feet can take different discs.
   */
  readonly retentionMagnet: LidMagnetConfig;
  /**
   * Optional shelled tray recess on the top face. Only takes effect when the
   * lid is not stackable (a stack grid owns the top surface otherwise).
   */
  readonly tray: LidTrayConfig;
  /**
   * Grip relief at the lid/bin seam (discussion). Opt-in; see
   * {@link LidGripConfig}.
   */
  readonly grip: LidGripConfig;
  /**
   * Carve the lid's seating envelope out of the bin's interior.
   *
   * The top of the cavity's perimeter belongs to the lid: a seated rail hangs
   * 3.05mm below the wall top and reaches inboard of the inner wall face. With
   * this on, that ring is cut from the interior as the last operation on the
   * bin, so dividers, label shelves and scoop arcs step aside by construction
   * and the rails run unbroken. With it off, the rails notch around each
   * feature instead — correct, but it costs snap on a dense grid.
   *
   * `true` for new designs, and `migrateParams` backfills `false` when the
   * field is absent so every design published before it regenerates
   * byte-identically. Deliberately unlike the default-off treatment and
   * Got: those were features, and this is the resolution of a defect.
   */
  readonly relieveInterior: boolean;
  /**
   * Sliding-lid geometry. Read only when {@link attachment} is `'slide'`, so
   * switching modes preserves it exactly as the per-side `clickRails` selection
   * and the `retentionMagnet` dimensions are preserved.
   *
   * ABSENT rather than defaulted when it carries no opinion, and `migrateParams`
   * collapses a default-valued object back to absent — the same treatment
   * `cutouts` gets, for the same reason. `communityParamsFingerprint` hashes the
   * whole params object and keys both the duplicate guard and the moderation
   * tombstone (CLAUDE.md gotcha #13a), so a field that were always present would
   * re-hash every design already published and stop old takedowns matching a
   * re-publish. Read it through {@link resolveLidSlide}.
   */
  readonly slide?: LidSlideConfig;
  /**
   * Hinge geometry. Read only when {@link attachment} is `'hinge'`, so
   * switching modes preserves it exactly as `slide` and `retentionMagnet` are
   * preserved.
   *
   * ABSENT rather than defaulted when it carries no opinion, and
   * `migrateParams` collapses a default-valued object back to absent — the
   * same treatment `slide` gets, for the same reason (CLAUDE.md gotcha #13a:
   * `communityParamsFingerprint` hashes the whole params object and keys the
   * moderation tombstone, so an always-present field would re-hash every
   * design already published). Read it through {@link resolveLidHinge}.
   */
  readonly hinge?: LidHingeConfig;
  /**
   * Shapes cut clean through the lid's plate — a dispensing slot, a vent, a
   * pass-through for a cable. The same {@link Cutout} the interior uses, so the
   * pen tool, the pathfinder group ops, clearance and the entry chamfer all apply
   * unchanged; `lidCutoutBuilder` documents what the HOST overrides on each shape,
   * and `lidCutoutPlan` owns the frame they are measured in.
   *
   * ABSENT rather than `[]` when there are none, and `migrateParams` collapses an
   * empty array back to absent. `communityParamsFingerprint` hashes the whole
   * params object and keys both the duplicate guard and the moderation tombstone
   * (CLAUDE.md gotcha #13a), so a field that is always present would re-hash every
   * design already published and stop old takedowns matching a re-publish. Same
   * reason `migrateSurfaceText` collapses empty text to `undefined`.
   */
  readonly cutouts?: Cutout[];
}

/**
 * Default lid config: disabled. Sensible first-enable values:
 * - `clickRailCoverage: 50` — half-length rails save filament without
 *   sacrificing the click-lock function (rails are centered on each wall).
 * - `stackableTop: false` — keeps the lid's print-ready orientation
 *   (`exportLid` rotates 180° around X so the floor sits on the bed) free
 *   of features that fight that rotation; users opt in if they need
 *   stackability.
 */
export const DEFAULT_LID_CONFIG: LidConfig = {
  enabled: false,
  // `clickRails` preserves the historical default behavior (all four rails on)
  // so enabling a lid without touching the mode still clicks shut.
  attachment: 'clickRails',
  stackableTop: false,
  // Off: older designs keep the full per-cell grid.
  stackLipOnly: false,
  magnetHoles: false,
  separateStackPlate: false,
  clickRails: { front: true, back: true, left: true, right: true },
  clickRailCoverage: 50,
  extraHeightMm: 0,
  // Baseline, so every older design regenerates byte-identically.
  topThicknessMm: LID_TOP_THICKNESS_BASE,
  retentionMagnet: {
    diameter: LID_MAGNET_DIAMETER_DEFAULT_MM,
    depth: LID_MAGNET_DEPTH_DEFAULT_MM,
    edgeMagnets: LID_MAGNET_EDGE_COUNT_DEFAULT,
  },
  tray: {
    enabled: false,
    depthMm: LID_TRAY_DEPTH_DEFAULT_MM,
    wallMm: LID_TRAY_WALL_DEFAULT_MM,
  },
  // Off, so every older design regenerates byte-identically. The values
  // below are what a user gets on first enable: a scallop on the two long
  // walls is the arrangement the reporter asked for, and the one that most
  // obviously solves "I had to use a screwdriver".
  grip: {
    mode: 'none',
    sides: { front: true, back: true, left: false, right: false },
    coverage: LID_GRIP_COVERAGE_DEFAULT,
    heightMm: null,
    binDip: false,
  },
  // On, so a new design gets a lid that seats. `migrateParams` turns it off for
  // designs that predate it — see the field's own note.
  relieveInterior: true,
} as const;

/**
 * Extra clearance baked into the anchor calculation to compensate for
 * first-layer squish (mm).
 */
export const LID_EXTRA_HEIGHT = 0.2;

/**
 * Anchor Z in lid-local coords — where the lid's mating cavity opens up to
 * receive the bin's stacking lip when the lid is snapped on.
 *
 * Lives here rather than in the worker's `lidConstants` so the main thread can
 * use it too: the worker module pulls in brepjs/WASM and isn't importable from
 * the UI. Both the worker and the preview mirror re-export this, so there is
 * one formula rather than the two hand-synced copies this replaces.
 *
 * @param heightUnitMm Gridfinity height unit (default 7mm — base lid height)
 * @param fitClearance Per-side clearance for the chosen fit
 * @param extraCavityMm Added cavity depth — `resolveLidCavityExtraMm`, which
 *   folds in both the `extraHeightMm` knob and floor-plate growth
 */
export function lidAnchorZ(
  heightUnitMm: number,
  fitClearance: number,
  extraCavityMm: number = 0
): number {
  return (
    -(heightUnitMm + extraCavityMm) -
    LID_EXTRA_HEIGHT +
    GRIDFINITY_SPEC.LIP_HEIGHT +
    Math.SQRT2 * fitClearance * 2
  );
}

/** Bottom of the mating wall in lid-local Z — below this the click rails take over. */
export function lidWallBottomZ(
  heightUnitMm: number,
  fitClearance: number,
  extraCavityMm: number = 0
): number {
  return (
    lidAnchorZ(heightUnitMm, fitClearance, extraCavityMm) -
    GRIDFINITY_SPEC.LIP_BIG_TAPER -
    GRIDFINITY_SPEC.LIP_VERTICAL_PART
  );
}

/**
 * How far a click rail's profile hangs BELOW the mating wall's bottom.
 *
 * Summed from the steps `clickShape2D` walks down (entry chamfer, bump, its
 * 0.1 shoulder, exit chamfer, drop, tail). Lives here rather than in the
 * worker's `lidConstants` for the same reason the anchor formulas do: the
 * preview needs it and cannot import brepjs.
 */
/** Click rail engagement depth (the snap "bump" height). */
export const LID_CLICK_RAIL_BUMP = 0.6;
/** Rail entry chamfer depth (lid slides on smoothly). */
export const LID_CLICK_RAIL_ENTRY_CHAMFER = 0.8;
/** Rail exit chamfer (geometry stability). */
export const LID_CLICK_RAIL_EXIT_CHAMFER = 0.2;
/** Vertical extension below the rail bump. */
export const LID_CLICK_RAIL_DROP = 0.8;
/** Final tail length below the rail body. */
export const LID_CLICK_RAIL_TAIL = 1.25;
/** Shoulder between the rail bump and its exit chamfer. */
export const LID_CLICK_RAIL_SHOULDER = 0.1;
/** How far the rail's outer face protrudes from the corner-radius line. */
export const LID_CLICK_RAIL_OUT = 1.85;
/** Inner face of the rail, inside the bin cavity (negative = inboard). */
export const LID_CLICK_RAIL_INNER = -0.8;
/** Top entry chamfer: the rail's apex climbs this far above its own top face,
 *  blending it into the lid's cavity wall. Lives here rather than in the
 *  worker's `lidConstants` because the rail's swept Z band is what a label tab
 *  has to stay clear of, and that check runs on the main thread too. */
export const LID_CLICK_RAIL_TOP_CHAMFER = 0.8;

export const LID_CLICK_RAIL_DROP_BELOW_WALL =
  LID_CLICK_RAIL_ENTRY_CHAMFER +
  LID_CLICK_RAIL_BUMP +
  LID_CLICK_RAIL_SHOULDER +
  LID_CLICK_RAIL_EXIT_CHAMFER +
  LID_CLICK_RAIL_DROP +
  LID_CLICK_RAIL_TAIL;

/**
 * How far below the BIN's wall top a seated lid's click rail reaches (mm) —
 * the band inside the bin's mouth that has to stay clear for the rail to drop
 * into (3.05mm).
 *
 * Seating maps the lid's `anchorZ` onto the bin's lip top, so measuring from
 * the wall top means walking down the lip (`LIP_HEIGHT`) and back
 * up through the mating wall's own depth (`lidWallBottomZ`) before adding the
 * rail's drop. Bin-side code needs the number in bin terms, which is why it is
 * resolved here rather than left as the lid-local pieces.
 */
export const LID_CLICK_RAIL_BAND_BELOW_WALL_TOP =
  LID_CLICK_RAIL_DROP_BELOW_WALL +
  GRIDFINITY_SPEC.LIP_BIG_TAPER +
  GRIDFINITY_SPEC.LIP_VERTICAL_PART -
  GRIDFINITY_SPEC.LIP_HEIGHT;

/**
 * The magnet mating plane in LID-LOCAL Z — the boss's downward face, and one
 * {@link LID_MAGNET_SEAT_GAP} above the bin pad's upward face.
 *
 * Whichever of two lower bounds is deeper:
 *
 * 1. The pocket must fit under the floor plate — {@link LID_TOP_THICKNESS_BASE}
 *    of ceiling plus the magnet's own depth. The boss hangs from the cavity
 *    BOTTOM, so `extraCavityMm` lengthens the pillar rather than lifting the
 *    magnet, and a deeper lid still meets the same bin.
 * 2. `lidWallBottomZ` — the bottom of the part's own mating skirt. The bin's pad
 *    is not a free-standing post: it welds into the interior walls, so its
 *    footprint reaches back OUT under that skirt ({@link LID_MAGNET_LIP_CLEARANCE}
 *    keeps the BOSS clear of the LIP, a different pair of parts further out). A
 *    pad topping out above the skirt bottom meets it across that whole outboard
 *    band however well the magnets line up, and the lid props open on its own
 *    corners.
 *
 * On the stock 7mm lid (2) binds by ~3.2mm, so the boss is a pillar reaching
 * down to its own skirt line rather than a stub under the floor plate. Landing
 * the boss exactly ON that line rather than past it is deliberate: the part's
 * lowest point stays the skirt, so `trayBottomSkirtDepth` still describes a
 * magnetic tray and no caller has to learn about bosses. The pad then clears the
 * skirt by one seat gap — the same clearance these two parts already hold across
 * the magnets themselves, and the skirt's bottom ring is the LAST layer printed
 * (the lid rotates 180° for print), so nothing squishes into it.
 *
 * The bare {@link LID_FIT_CLEARANCE}, never `resolveLidFootprintClearance`: the
 * magnetic relief is XY-only, and feeding it here would lift the plane
 * ~0.42mm, eating twice the seat gap it is measured against.
 */
export function lidRetentionInterfaceZ(
  heightUnitMm: number,
  extraCavityMm: number,
  magnetDepth: number
): number {
  const pocketFitZ = -(LID_TOP_THICKNESS_BASE + magnetDepth) - extraCavityMm;
  const skirtBottomZ = lidWallBottomZ(heightUnitMm, LID_FIT_CLEARANCE, extraCavityMm);
  return Math.min(pocketFitZ, skirtBottomZ);
}

/**
 * Depth of a tray bin's skirt — how far the mating geometry hangs
 * below its floor, and so how far the whole bin is lifted for Z=0 to stay the
 * absolute bottom.
 *
 * `wallBottomZ` alone is not enough: click rails hang below the mating wall, and
 * omitting them sinks the model under the print bed. Retention bosses normally
 * need no term — {@link lidRetentionInterfaceZ} lands them ON the wall line for
 * exactly this reason.
 *
 * The exception is a magnet deep enough that the pocket-fit bound wins, i.e.
 * `LID_TOP_THICKNESS_BASE + depth > -wallBottomZ` (~5mm on a stock 7mm joint).
 * Such a tray's bosses hang below the bed by the difference, unchanged from
 * and tracked separately — it is a property of the depth knob, not
 * of the seating plane, and the lid (which is not lifted) never shows it.
 *
 * Shared by the worker's `deriveDimensions` and the preview's `binDimensions`
 * so the two cannot disagree about where a tray's floor is.
 */
export function trayBottomSkirtDepth(
  heightUnitMm: number,
  fitClearance: number,
  extraCavityMm: number,
  hasClickRails: boolean
): number {
  return (
    -lidWallBottomZ(heightUnitMm, fitClearance, extraCavityMm) +
    (hasClickRails ? LID_CLICK_RAIL_DROP_BELOW_WALL : 0)
  );
}

/**
 * Span (mm) a relief occupies on one wall, given that wall's straight run.
 *
 * `usableEdgeMm` is the run between the corner radii — the same quantity
 * `buildClickRails` shortens rails against — so a relief can never wrap a
 * corner. The clamp is applied after the percentage, then re-clamped to the
 * run itself so a short wall gets a short relief rather than an overhanging
 * one.
 */
export function resolveLidGripSpanMm(usableEdgeMm: number, coveragePct: number): number {
  const requested = usableEdgeMm * (coveragePct / 100);
  const clamped = Math.min(Math.max(requested, LID_GRIP_SPAN_MIN_MM), LID_GRIP_SPAN_MAX_MM);
  return Math.min(clamped, usableEdgeMm);
}

/** Pre-clamp inward depth (mm) the chosen mode asks for. */
export function lidGripRequestedDepthMm(mode: LidGripMode): number {
  switch (mode) {
    case 'none':
      return 0;
    case 'chamfer':
      return LID_GRIP_CHAMFER_MM;
    case 'reveal':
      return LID_GRIP_REVEAL_DEPTH_MM;
    case 'scallop':
      return LID_GRIP_SCALLOP_DEPTH_MM;
  }
}

/** How far above the seam (mm) the chosen mode reaches. */
export function lidGripHeightMm(mode: LidGripMode): number {
  switch (mode) {
    case 'none':
      return 0;
    case 'chamfer':
      return LID_GRIP_CHAMFER_MM;
    case 'reveal':
      return LID_GRIP_REVEAL_HEIGHT_MM;
    case 'scallop':
      return LID_GRIP_SCALLOP_HEIGHT_MM;
  }
}

/**
 * The resolved depth of a grip relief and why it is what it is.
 *
 * `depthMm` is what the geometry actually cuts. It is silently reduced from
 * `requestedDepthMm` whenever a variant leaves less material than the mode
 * asks for, because the alternative — refusing to generate — makes legal lid
 * configurations unreachable for a reason the user did not choose. The panel
 * reads `clamped`/`limitedBy` to say so rather than leaving a shallow relief
 * looking like a defect.
 */
export interface LidGripDepthPlan {
  readonly depthMm: number;
  readonly requestedDepthMm: number;
  readonly clamped: boolean;
  /** What bound the depth, when clamped. `null` when the mode got what it asked for. */
  readonly limitedBy: 'cavity' | 'trayWall' | 'edgeMagnet' | null;
  /** True when nothing useful survives the clamp and the relief is dropped. */
  readonly suppressed: boolean;
}

interface GripDepthBudget {
  readonly limit: number;
  readonly by: Exclude<LidGripDepthPlan['limitedBy'], null>;
}

/**
 * Resolve how deep a grip relief may cut on this design.
 *
 * Three independent budgets, each the distance from the lid's outer face to
 * something the relief must not reach, less {@link LID_GRIP_MIN_WALL_MM}:
 *
 * - `cavity`   — the mating cavity, at `LID_CORNER_RADIUS - fitClearance`.
 *   Always binding; breaching it opens the lid into its own lip pocket.
 * - `trayWall` — a tray recess is inset from the outer face by `tray.wallMm`,
 *   and a scallop cutting the plate edge would open the tray's side.
 * - `edgeMagnet` — a magnetic lid's mid-span edge bosses sit
 *   {@link LID_MAGNET_LIP_CLEARANCE} inboard of the footprint edge, which is
 *   exactly where a centered relief cuts. Corner bosses are not a factor: a
 *   relief never reaches a corner.
 */
export function resolveLidGripDepth(params: LidGeometrySource): LidGripDepthPlan {
  const mode = params.lid.grip.mode;
  const requestedDepthMm = lidGripRequestedDepthMm(mode);
  if (mode === 'none') {
    return { depthMm: 0, requestedDepthMm: 0, clamped: false, limitedBy: null, suppressed: true };
  }

  const budgets: GripDepthBudget[] = [
    {
      limit: LID_CORNER_RADIUS - resolveLidFootprintClearance(params) - LID_GRIP_MIN_WALL_MM,
      by: 'cavity',
    },
  ];
  if (params.lid.tray.enabled && !params.lid.stackableTop) {
    budgets.push({ limit: params.lid.tray.wallMm - LID_GRIP_MIN_WALL_MM, by: 'trayWall' });
  }
  if (params.lid.attachment === 'magnetic' && params.lid.retentionMagnet.edgeMagnets > 0) {
    budgets.push({ limit: LID_MAGNET_LIP_CLEARANCE - LID_GRIP_MIN_WALL_MM, by: 'edgeMagnet' });
  }

  const tightest = budgets.reduce((a, b) => (b.limit < a.limit ? b : a));
  const depthMm = Math.max(Math.min(requestedDepthMm, tightest.limit), 0);
  const clamped = depthMm < requestedDepthMm;

  return {
    depthMm,
    requestedDepthMm,
    clamped,
    limitedBy: clamped ? tightest.by : null,
    suppressed: depthMm < LID_GRIP_MIN_USEFUL_DEPTH_MM,
  };
}

/**
 * Whether a mode can be built on this design.
 *
 * Only one combination is impossible: a `reveal` steps the lid's outer face
 * inward, and that face is what a bin stacked on the lid registers against.
 * `chamfer` and `scallop` cut above the seam without moving the registration
 * surface, so they compose with a stackable top freely.
 *
 * The server mirrors this rule in `api/lib/designerValidation.ts`; a synced
 * design that violated it would be rejected there, so the UI must not offer it
 * and the geometry must not build it.
 */
export function lidGripModeAllowed(params: LidGeometrySource, mode: LidGripMode): boolean {
  if (mode !== 'reveal') return true;
  return !params.lid.stackableTop && !params.lid.separateStackPlate;
}

/**
 * Whether any wall carries the relief. Shared with the panel, which has to
 * warn about "no walls selected" before the depth clamp gets a say.
 */
export function hasAnyLidGripSide(sides: LidGripSides): boolean {
  return LID_RAIL_SIDES.some((side) => sides[side]);
}

/** Whether this design generates any grip relief at all. */
export function hasLidGrip(params: LidGeometrySource): boolean {
  // A grip relief treats the seam between a lid's skirt and the bin's rim. A
  // sliding plate has neither, and the dedicated pull is what gives a finger
  // somewhere to go — so the stored mode is preserved but never built.
  if (isSlideLid(params.lid)) return false;
  const { mode, sides } = params.lid.grip;
  return (
    mode !== 'none' &&
    lidGripModeAllowed(params, mode) &&
    hasAnyLidGripSide(sides) &&
    !resolveLidGripDepth(params).suppressed
  );
}

/**
 * Whether the bin's stacking lip gets dipped under the relief.
 *
 * Gated on the relief actually existing: a dip on its own would cut a gap in
 * the lip with no lid feature above it to reach through.
 */
export function hasBinLipDip(params: LidGeometrySource): boolean {
  return params.lid.grip.binDip && hasLidGrip(params);
}

/**
 * Vertical gap (mm) between the lid boss's magnet face and the bin pad's, when
 * seated. Keeps the corner posts from bottoming out and lifting the lid off its
 * lip; the magnets pull across it. Mirrored by the worker's `lidConstants`.
 */
export const LID_MAGNET_SEAT_GAP = 0.2;
