/**
 * Direct-manipulation dimension handles for the single selected part. Each
 * handle slides along one part-local axis; the drag is resolved in SCREEN
 * space (the axis is projected through the camera at grab time, and pointer
 * travel is measured along that projected direction), which works at any
 * camera angle, under the wedge tilt, and in both projections without catch
 * planes. Values step and clamp like the inspector fields; a whole drag is
 * one undo entry, and clicking a label types an exact value.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Html } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import type { Group } from 'three';
import { Button } from '@/design-system';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { findAssemblyPart } from '@/features/bin-designer/utils/assemblyTree';
import type { AssemblyPartNode } from '@/shared/types/assembly';
import { useThreeColors } from '@/shared/hooks/useThemeEffect';
import { resizeHandlesFor, type ResizeHandleDef } from './resizeHandleConfig';
import { storeToScene, type PlacedPart } from './workshopPlacement';

const HANDLE_SIZE_MM = 3.2;
const HANDLE_HIT_RADIUS_MM = 3.6;
const LABEL_GAP_MM = 6;
const DEG = Math.PI / 180;
const NO_RAYCAST = (): null => null;

const AXIS_UNIT: Record<ResizeHandleDef['axis'], readonly [number, number, number]> = {
  x: [1, 0, 0],
  y: [0, 1, 0],
  z: [0, 0, 1],
};

function fmt(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function clampStep(raw: number, def: ResizeHandleDef): number {
  const stepped = Math.round(raw / def.step) * def.step;
  // Float-proof the step (0.2 * 3 = 0.6000000000000001 fails the schema max).
  const clean = Math.round(stepped * 100) / 100;
  return Math.min(def.max, Math.max(def.min, clean));
}

interface ResizeHandles3DProps {
  readonly placed: PlacedPart;
  readonly baseW: number;
  readonly baseD: number;
  /** Marquee suppression — a handle grab claims the pointerdown. */
  readonly onGestureStart?: () => void;
  /** Mirrors whether a handle drag is in flight (suppresses the sharp swap). */
  readonly onResizingChange?: (resizing: boolean) => void;
}

interface DragState {
  readonly def: ResizeHandleDef;
  readonly startClientX: number;
  readonly startClientY: number;
  readonly startOffset: number;
  /** Screen direction of the axis (unit) and its scale in px per local mm. */
  readonly dirX: number;
  readonly dirY: number;
  readonly pxPerMm: number;
}

export function ResizeHandles3D({
  placed,
  baseW,
  baseD,
  onGestureStart,
  onResizingChange,
}: ResizeHandles3DProps) {
  const colors = useThreeColors();
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const get = useThree((s) => s.get);
  const groupRef = useRef<Group | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const transactionRef = useRef(false);
  const lastValueRef = useRef<number | null>(null);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);

  useEffect(() => {
    onResizingChange?.(draggingKey !== null);
  }, [draggingKey, onResizingChange]);
  // The scene must never be left thinking a resize is stuck on after the
  // handles unmount (selection change mid-drag).
  useEffect(() => () => onResizingChange?.(false), [onResizingChange]);

  const node = placed.node;
  const handles = resizeHandlesFor(node);
  const partHeight = Math.max(placed.topZ - placed.z, 1);

  const currentNode = useCallback((): AssemblyPartNode | null => {
    const structure = useDesignerStore.getState().structure;
    return structure?.kind === 'assembly'
      ? findAssemblyPart(structure.parts, placed.selectId)
      : null;
  }, [placed.selectId]);

  const handleLocal = useCallback(
    (def: ResizeHandleDef, forNode: AssemblyPartNode): Vector3 => {
      const offset = def.offset(forNode);
      if (def.axis === 'z') return new Vector3(0, 0, offset);
      const mid = forNode.type === 'cutter' ? 0.5 : partHeight / 2;
      return def.axis === 'x' ? new Vector3(offset, 0, mid) : new Vector3(0, offset, mid);
    },
    [partHeight]
  );

  const toScreen = useCallback(
    (world: Vector3): { x: number; y: number } => {
      const projected = world.clone().project(camera);
      return {
        x: (projected.x * 0.5 + 0.5) * size.width,
        y: (1 - (projected.y * 0.5 + 0.5)) * size.height,
      };
    },
    [camera, size.height, size.width]
  );

  const endDrag = useCallback((): void => {
    if (transactionRef.current) {
      useDesignerStore.getState().commitTransaction();
      transactionRef.current = false;
    }
    const controls = get().controls as { enabled: boolean } | null;
    if (controls) controls.enabled = true;
    dragRef.current = null;
    lastValueRef.current = null;
    setDraggingKey(null);
    invalidate();
  }, [get, invalidate]);

  useEffect(() => {
    if (draggingKey === null) return;
    const onMove = (e: PointerEvent): void => {
      const drag = dragRef.current;
      const liveNode = currentNode();
      if (!drag || !liveNode) return;
      const mmDelta =
        ((e.clientX - drag.startClientX) * drag.dirX +
          (e.clientY - drag.startClientY) * drag.dirY) /
        drag.pxPerMm;
      const value = clampStep(drag.def.fromOffset(drag.startOffset + mmDelta, liveNode), drag.def);
      if (value === lastValueRef.current) return;
      lastValueRef.current = value;
      const store = useDesignerStore.getState();
      if (!transactionRef.current) {
        store.startTransaction();
        transactionRef.current = true;
      }
      store.updateAssemblyPartParams(placed.selectId, drag.def.apply(value, liveNode));
      invalidate();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
    };
  }, [currentNode, draggingKey, endDrag, invalidate, placed.selectId]);

  const beginDrag = useCallback(
    (def: ResizeHandleDef, e: { clientX: number; clientY: number }): void => {
      const group = groupRef.current;
      const liveNode = currentNode();
      if (!group || !liveNode) return;
      group.updateWorldMatrix(true, false);
      const local = handleLocal(def, liveNode);
      const p0 = toScreen(group.localToWorld(local.clone()));
      const axis = AXIS_UNIT[def.axis];
      const p1 = toScreen(group.localToWorld(local.clone().add(new Vector3(...axis))));
      const dirX = p1.x - p0.x;
      const dirY = p1.y - p0.y;
      const pxPerMm = Math.hypot(dirX, dirY);
      // An axis pointing straight at the camera has no screen direction to
      // measure along — refuse the grab instead of dividing by ~0.
      if (pxPerMm < 0.05) return;
      onGestureStart?.();
      const controls = get().controls as { enabled: boolean } | null;
      if (controls) controls.enabled = false;
      dragRef.current = {
        def,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startOffset: def.offset(liveNode),
        dirX: dirX / pxPerMm,
        dirY: dirY / pxPerMm,
        pxPerMm,
      };
      lastValueRef.current = null;
      setEditingKey(null);
      setDraggingKey(def.key);
    },
    [currentNode, get, handleLocal, onGestureStart, toScreen]
  );

  const commitTyped = useCallback(
    (def: ResizeHandleDef, text: string): void => {
      setEditingKey(null);
      const parsed = Number.parseFloat(text.replace(',', '.'));
      if (!Number.isFinite(parsed)) return;
      const liveNode = currentNode();
      if (!liveNode) return;
      const value = clampStep(parsed, def);
      if (value === def.read(liveNode)) return;
      useDesignerStore
        .getState()
        .updateAssemblyPartParams(placed.selectId, def.apply(value, liveNode));
      invalidate();
    },
    [currentNode, invalidate, placed.selectId]
  );

  return (
    <group
      ref={groupRef}
      position={[storeToScene(placed.x, baseW), storeToScene(placed.y, baseD), placed.z]}
      rotation={[0, 0, placed.rotZDeg * DEG]}
    >
      {handles.map((def) => {
        const local = handleLocal(def, node);
        const active = draggingKey === def.key;
        const labelShift = LABEL_GAP_MM;
        const labelPos: [number, number, number] =
          def.axis === 'z'
            ? [0, 0, local.z + labelShift]
            : def.axis === 'x'
              ? [local.x + labelShift, local.y, local.z]
              : [local.x, local.y + labelShift, local.z];
        return (
          <group key={def.key}>
            {/* The visible cube is deliberately small; an invisible sphere
                twice its size is the actual grab target, so the handle wins
                the raycast over the part face right behind it. */}
            <mesh
              position={[local.x, local.y, local.z]}
              renderOrder={2}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                e.stopPropagation();
                beginDrag(def, { clientX: e.nativeEvent.clientX, clientY: e.nativeEvent.clientY });
              }}
            >
              <sphereGeometry args={[HANDLE_HIT_RADIUS_MM, 8, 6]} />
              <meshBasicMaterial visible={false} />
            </mesh>
            <mesh position={[local.x, local.y, local.z]} renderOrder={2} raycast={NO_RAYCAST}>
              <boxGeometry args={[HANDLE_SIZE_MM, HANDLE_SIZE_MM, HANDLE_SIZE_MM]} />
              <meshStandardMaterial
                color={active ? colors.workshopGhost : colors.workshopPartSelected}
                emissive={active ? colors.workshopGhost : colors.workshopPartSelected}
                emissiveIntensity={active ? 0.8 : 0.45}
              />
            </mesh>
            {(editingKey === null || editingKey === def.key) && (
              <Html position={labelPos} center style={{ pointerEvents: 'auto' }}>
                {editingKey === def.key ? (
                  <input
                    // eslint-disable-next-line jsx-a11y/no-autofocus -- the user just clicked this label to type into it
                    autoFocus
                    defaultValue={fmt(def.read(node))}
                    inputMode="decimal"
                    className="w-14 rounded border border-accent bg-surface-elevated px-1 py-0.5 text-center font-mono text-label text-content shadow-sm outline-none"
                    onFocus={(e) => e.currentTarget.select()}
                    onPointerDown={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === 'Enter') commitTyped(def, e.currentTarget.value);
                      if (e.key === 'Escape') setEditingKey(null);
                    }}
                    onBlur={(e) => commitTyped(def, e.currentTarget.value)}
                  />
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto cursor-text whitespace-nowrap rounded bg-surface-elevated/95 px-1.5 py-0.5 font-mono text-label text-content shadow-sm ring-1 ring-stroke-subtle hover:ring-accent"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingKey(def.key);
                    }}
                  >
                    {fmt(def.read(node))}mm
                  </Button>
                )}
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
}
