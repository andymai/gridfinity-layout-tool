/** Prop and overlay types for the cutout editor's scene. */

import { type RefObject } from 'react';
import type {
  Cutout,
  CutoutShape as CutoutShapeType,
  PathPoint,
} from '@/features/bin-designer/types';
import type { CellMask } from '@/shared/utils/cellMask';
import type { LidCutoutWindow } from '@/shared/utils/lidCutoutPlan';
import type { TaperBandSides } from '@/features/bin-designer/utils/binDimensions';
import type { ResizeHandle, InteractionMode, PreviewMap } from '../useCutoutInteraction';
import type { SegmentHoverInfo } from '../handlers';
import type { AlignmentGuide } from '../geometry';
import type { FitCue } from '../cutoutSectionVisibility';
import type { RulerMeasurement } from '../handlers/rulerHandler';

interface DrawingPreview {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly depth: number;
  readonly shape: CutoutShapeType;
  readonly rotation?: number;
}

interface TooltipInfo {
  readonly type: 'drag' | 'resize';
  readonly x?: number;
  readonly y?: number;
  readonly width?: number;
  readonly depth?: number;
  readonly worldX: number;
  readonly worldY: number;
}

interface GroupBoundsData {
  readonly id: '__group__';
  readonly shape: 'rectangle';
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly depth: number;
  readonly cutDepth: number;
  readonly topOffset: number;
  readonly rotation: number;
  readonly cornerRadius: number;
  readonly label: string;
  readonly groupId: null;
}

export interface SceneContentProps {
  readonly cutouts: readonly Cutout[];
  readonly binWidth: number;
  readonly binDepth: number;
  /** Non-rectangular footprint mask — when present background renders the polygon. */
  readonly cellMask?: CellMask;
  /** Per-side strip a full-depth cutout is trimmed out of; null when untapered. */
  readonly taperBand?: TaperBandSides | null;
  /**
   * Another part's footprint, drawn faintly under the board purely so the user can
   * line shapes up with it. Set when the editor is on the LID, whose window is a
   * different frame from the bin's interior. Absent on the bin's own board.
   */
  readonly referenceOutline?: { readonly width: number; readonly depth: number } | null;
  readonly lidWindow?: LidCutoutWindow | null;
  readonly binColor: string;
  /** Groups the editor is drilled into; shapes outside the branch render faded. */
  readonly groupContext?: readonly string[];
  readonly selection: ReadonlySet<string>;
  /** Cutouts stranded past the board edge — framed with a red warning outline. */
  readonly offBoardIds?: ReadonlySet<string>;
  readonly preview: PreviewMap;
  readonly mode: InteractionMode;
  readonly isDragging: boolean;
  readonly isInteracting: boolean;
  readonly memoizedDragStart?: (id: string, mmX: number, mmY: number, altKey?: boolean) => void;
  readonly onLabelDragStart?: (id: string, mmX: number, mmY: number) => void;
  readonly selectedCutout: Cutout | null;
  readonly tooltipInfo: TooltipInfo | null;
  readonly groupBounds: GroupBoundsData | null;
  readonly drawingPreview: DrawingPreview | null;
  /** Active insertion-fit cue to draw on the single-selected cutout. */
  readonly fitCue?: FitCue;
  readonly pathDrawingPreview: {
    readonly points: readonly PathPoint[];
    readonly cursorX: number;
    readonly cursorY: number;
    readonly canClose: boolean;
  } | null;
  readonly activeGuides: readonly AlignmentGuide[];
  readonly marqueeWorld: { x: number; y: number; width: number; depth: number } | null;
  readonly onBackgroundPointerDown: (
    worldX: number,
    worldY: number,
    nativeEvent: PointerEvent
  ) => void;
  readonly onPointerMove: (worldX: number, worldY: number, nativeEvent: PointerEvent) => void;
  readonly onPointerUp: () => void;
  readonly onSelectCutout: (id: string, additive: boolean) => void;
  readonly onDoubleClickCutout: (id: string) => void;
  readonly onResizeStart: (id: string, handle: ResizeHandle, mmX: number, mmY: number) => void;
  readonly onRotateStart: (id: string, startAngle: number) => void;
  readonly onGroupRotateStart: (startAngle: number) => void;
  readonly onGroupScaleStart: (mmX: number, mmY: number) => void;
  readonly segmentHover?: SegmentHoverInfo | null;
  readonly onPathDrawingVertexDown?: (index: number, mmX: number, mmY: number) => void;
  readonly onVertexPointDown?: (index: number, mmX: number, mmY: number) => void;
  readonly onVertexHandleDown?: (
    index: number,
    handleType: 'in' | 'out',
    mmX: number,
    mmY: number
  ) => void;
  /** Externally-managed camera zoom (workspace mode) */
  readonly externalZoom?: number;
  /** Externally-managed camera center (workspace mode) */
  readonly externalCameraCenter?: { x: number; y: number };
  /** Active ruler measurement */
  readonly rulerMeasurement?: RulerMeasurement | null;
  /** Ref to keep ruler handler informed of current zoom */
  readonly rulerZoomRef?: RefObject<number>;
}
