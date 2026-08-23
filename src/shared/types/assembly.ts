/**
 * Workshop assembly — a part-based item built on a base-only Gridfinity
 * footprint (socket + floor plate, no walls).
 *
 * The structure is an attachment tree: a child's transform is expressed in
 * its parent's frame, and `seatZ` is measured from the parent's SEAT PLANE
 * (top face), not the floor — so resizing a parent carries its subtree in
 * all three axes without transform rewrites. Roots seat on the base floor.
 *
 * `array` and `mirror` are properties of a node, never cloned nodes; the
 * generator and proxy scene expand them at evaluation time, which is what
 * keeps "edit one, the whole row updates" true.
 */
import type { PathPoint } from '@/shared/types/bin';

export const ASSEMBLY_PART_TYPES = [
  'post',
  'fin',
  'block',
  'tube',
  'cradle',
  'hook',
  'arch',
  'comb',
  'riser',
  'boreBank',
  'cutter',
] as const;

export type AssemblyPartType = (typeof ASSEMBLY_PART_TYPES)[number];

export interface PartTransform {
  /** X offset in mm, in the parent's frame. */
  readonly x: number;
  /** Y offset in mm, in the parent's frame. */
  readonly y: number;
  /** Height in mm above the parent's seat plane. Negative sinks a cutter. */
  readonly seatZ: number;
  /** Rotation around vertical in degrees. */
  readonly rotZDeg: number;
}

/** Linear repetition of a node and its whole subtree. */
export interface PartArray {
  readonly count: number;
  /** X step between copies in mm. */
  readonly dx: number;
  /** Y step between copies in mm. */
  readonly dy: number;
}

export interface PostParams {
  readonly diameter: number;
  readonly height: number;
  /** Sides lean inward this many degrees; 0 is a straight cylinder. */
  readonly taperDeg: number;
  readonly tipChamfer: number;
}

export interface FinParams {
  readonly length: number;
  readonly thickness: number;
  readonly height: number;
  /** Lean back from vertical in degrees (0..45 for printability). */
  readonly leanDeg: number;
  /**
   * Which local axis the lean displaces. 'thickness' (default) tips the
   * plate over its long bottom edge; 'length' shears along the plate's run —
   * the tool rack's geometry once its fin row is rotated onto the base.
   */
  readonly leanAxis?: 'thickness' | 'length';
}

export interface BlockParams {
  /** Presentation tilt about the part's X axis; the base stays buried. */
  readonly tiltDeg?: number;
  readonly width: number;
  readonly depth: number;
  readonly height: number;
  /** Slopes the top face; 0 is flat. `height` is the tall edge. */
  readonly wedgeAngleDeg: number;
}

export interface TubeParams {
  /** Collar recess so a tool's shoulder sits flat; 0 = off. */
  readonly counterboreDiameter?: number;
  readonly counterboreDepth?: number;
  /** Bore narrows toward the floor, gripping mixed shaft sizes. */
  readonly boreTaperDeg?: number;
  readonly boreDiameter: number;
  readonly wall: number;
  readonly height: number;
  readonly tiltDeg: number;
}

export interface CradleParams {
  readonly tiltDeg?: number;
  /** Extent along the groove axis in mm. */
  readonly length: number;
  readonly width: number;
  readonly height: number;
  readonly grooveStyle: 'round' | 'vee';
  readonly grooveWidth: number;
  readonly grooveDepth: number;
}

export interface HookParams {
  readonly stemHeight: number;
  /** Horizontal run of the J in mm. */
  readonly reach: number;
  /** Upturned tip; 0 leaves a plain L. */
  readonly lipHeight: number;
  readonly thickness: number;
  readonly width: number;
}

export interface ArchParams {
  /** Clear distance between the uprights in mm. */
  readonly span: number;
  readonly height: number;
  readonly style: 'rod' | 'bridge';
  readonly rodDiameter: number;
  readonly bridgeWidth: number;
  readonly uprightThickness: number;
  readonly depth: number;
}

export interface CombParams {
  /** Run of the bar along its local X, slots cut across the depth. */
  readonly width: number;
  readonly depth: number;
  readonly height: number;
  readonly slotCount: number;
  readonly slotWidth: number;
  /** Slot opening depth, measured down from the top face. */
  readonly slotDepth: number;
}

export interface BoreBankParams {
  readonly width: number;
  readonly depth: number;
  readonly height: number;
  readonly boreDiameter: number;
  readonly boreDepth: number;
  readonly columns: number;
  readonly rows: number;
  /** Lean of every bore toward the front face, for easy grab-and-read. */
  readonly angleDeg: number;
}

export interface RiserParams {
  /** Run of the steps along its local X. */
  readonly width: number;
  readonly stepCount: number;
  /** Tread depth per step along local Y; the lowest step is at the front. */
  readonly stepDepth: number;
  readonly stepHeight: number;
}

/**
 * 2D profile a cutter sweeps downward. Deliberately the cutout editor's
 * vocabulary — a scanned tool outline or library cutout drops in as-is.
 */
export type CutterProfile =
  | { readonly shape: 'circle'; readonly diameter: number }
  | {
      readonly shape: 'rectangle';
      readonly width: number;
      readonly depth: number;
      readonly cornerRadius: number;
    }
  | { readonly shape: 'polygon'; readonly diameter: number; readonly sides: number }
  | { readonly shape: 'slot'; readonly length: number; readonly width: number }
  | { readonly shape: 'path'; readonly points: PathPoint[] }
  | {
      readonly shape: 'outline';
      readonly points: { readonly x: number; readonly y: number }[];
    };

export interface CutterParams {
  readonly profile: CutterProfile;
  /** Cut depth in mm, measured down from the cutter's seat. */
  readonly depth: number;
  readonly clearance: number;
  readonly chamfer: number;
}

interface PartNodeBase {
  readonly id: string;
  readonly transform: PartTransform;
  readonly array?: PartArray;
  /** Also emit this subtree reflected across the assembly's mirror axis. */
  readonly mirror?: boolean;
  /** Parts seated on this part's top face. */
  readonly children: AssemblyPartNode[];
}

export interface PostNode extends PartNodeBase {
  readonly type: 'post';
  readonly params: PostParams;
}
export interface FinNode extends PartNodeBase {
  readonly type: 'fin';
  readonly params: FinParams;
}
export interface BlockNode extends PartNodeBase {
  readonly type: 'block';
  readonly params: BlockParams;
}
export interface TubeNode extends PartNodeBase {
  readonly type: 'tube';
  readonly params: TubeParams;
}
export interface CradleNode extends PartNodeBase {
  readonly type: 'cradle';
  readonly params: CradleParams;
}
export interface HookNode extends PartNodeBase {
  readonly type: 'hook';
  readonly params: HookParams;
}
export interface ArchNode extends PartNodeBase {
  readonly type: 'arch';
  readonly params: ArchParams;
}
export interface CombNode extends PartNodeBase {
  readonly type: 'comb';
  readonly params: CombParams;
}
export interface RiserNode extends PartNodeBase {
  readonly type: 'riser';
  readonly params: RiserParams;
}
export interface BoreBankNode extends PartNodeBase {
  readonly type: 'boreBank';
  readonly params: BoreBankParams;
}
export interface CutterNode extends PartNodeBase {
  readonly type: 'cutter';
  readonly params: CutterParams;
}

export type AssemblyPartNode =
  | PostNode
  | FinNode
  | BlockNode
  | TubeNode
  | CradleNode
  | HookNode
  | ArchNode
  | CombNode
  | RiserNode
  | BoreBankNode
  | CutterNode;

export type AssemblyPartParams = AssemblyPartNode['params'];

export interface AssemblyPartParamsByType {
  readonly post: PostParams;
  readonly fin: FinParams;
  readonly block: BlockParams;
  readonly tube: TubeParams;
  readonly cradle: CradleParams;
  readonly hook: HookParams;
  readonly arch: ArchParams;
  readonly comb: CombParams;
  readonly riser: RiserParams;
  readonly boreBank: BoreBankParams;
  readonly cutter: CutterParams;
}

export interface AssemblyWedge {
  /** Presentation angle of the whole build; the socket stays flat. */
  readonly angleDeg: number;
  /** Which edge stays low — the side the tools lean away from. */
  readonly lowEdge: 'front' | 'back' | 'left' | 'right';
}

export interface AssemblyBase {
  readonly wedge?: AssemblyWedge;
  /** Floor plate thickness in mm above the socket. */
  readonly floorThickness: number;
  readonly cornerRadius?: number;
}

export interface AssemblyStructure {
  readonly kind: 'assembly';
  readonly schemaVersion: 1;
  readonly base: AssemblyBase;
  readonly mirrorAxis: 'x' | 'y';
  /** Root parts, seated on the base floor. */
  readonly parts: AssemblyPartNode[];
}
