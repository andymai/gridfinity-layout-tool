/**
 * Point-to-point and wall-thickness measuring in the 3D preview (#3696).
 *
 * Picking does NOT go through the R3F event system or a scene object. The
 * component raycasts the worker's mesh arrays directly
 * ({@link raycastTriangles}), for two reasons: `BinMesh` only attaches pointer
 * handlers while a color tool is active, and anything mesh-shaped added to this
 * scene is swept into the published GLB by `exportPreviewGlb`. Everything drawn
 * here is a drei `<Line>` or a troika `<Text>`, both of which that export
 * filters out structurally.
 *
 * Two ways in, matching the 2D ruler's sticky/transient pair:
 *   - the toolbar toggle, where a click places a point and orbit stays live
 *     between clicks so the far point can be brought into view;
 *   - shift+drag on desktop, which suspends orbit for the length of the drag.
 *
 * A drag is told from a click by pointer travel, not by timing, so touch taps
 * place points and touch drags still orbit.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Line, Text } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { Vector2, Vector3 } from 'three';
import { useShallow } from 'zustand/react/shallow';
import { useTranslation } from '@/i18n';
import { useDesignerStore } from '@/features/bin-designer/store';
import {
  measureBetween,
  probeThickness,
  raycastTriangles,
  snapToCreaseEdges,
  type MeasurePoint,
  type Vec3,
} from '@/features/bin-designer/utils/measure3d';

/** Pointer travel (px) past which a gesture is an orbit, not a pick. */
const DRAG_SLOP_PX = 4;
/** Snap radius in screen pixels, widened for touch where there is no hover. */
const SNAP_RADIUS_PX = 10;
const SNAP_RADIUS_TOUCH_PX = 22;
/** Half-length of a point marker's crosshair arms, in screen pixels. */
const MARKER_PX = 7;
const LABEL_PX = 13;

/** Reads against both themes and against the user's chosen bin color. */
const MEASURE_COLOR = '#ff8a3d';
const MEASURE_LABEL_BG = '#1b1b22';

type Screen = { readonly x: number; readonly y: number };

/** OrbitControls exposes `enabled`; R3F types the default controls opaquely. */
function hasEnabled(value: unknown): value is { enabled: boolean } {
  return typeof value === 'object' && value !== null && 'enabled' in value;
}

function toVector3(p: Vec3): Vector3 {
  return new Vector3(p.x, p.y, p.z);
}

export function MeasureTool() {
  const t = useTranslation();
  const { camera, gl, size, invalidate, controls, raycaster } = useThree();

  const { active, mode, points } = useDesignerStore(
    useShallow((s) => ({
      active: s.ui.measure.active,
      mode: s.ui.measure.mode,
      points: s.ui.measure.points,
    }))
  );
  const addMeasurePoint = useDesignerStore((s) => s.addMeasurePoint);
  const setMeasurePoints = useDesignerStore((s) => s.setMeasurePoints);
  const clearMeasure = useDesignerStore((s) => s.clearMeasure);
  const setMeasureActive = useDesignerStore((s) => s.setMeasureActive);

  const [hover, setHover] = useState<MeasurePoint | null>(null);

  /** World mm per screen pixel at `at`, for both camera projections. */
  const worldPerPixel = useCallback(
    (at: Vec3): number => {
      const probe = toVector3(at).project(camera);
      const right = toVector3(at)
        .add(new Vector3().setFromMatrixColumn(camera.matrixWorld, 0))
        .project(camera);
      const dx = ((right.x - probe.x) * size.width) / 2;
      const dy = ((right.y - probe.y) * size.height) / 2;
      const pixels = Math.hypot(dx, dy);
      return pixels > 1e-6 ? 1 / pixels : 0;
    },
    [camera, size.width, size.height]
  );

  /** Resolve a screen position to a snapped point on the model, or null. */
  const pick = useCallback(
    (screen: Screen, touch: boolean): { point: MeasurePoint; normal: Vec3; view: Vec3 } | null => {
      // Read imperatively rather than from a captured render value: the DOM
      // listeners outlive any single render, and depending on the mesh here
      // would re-register every one of them on each generation tick.
      const live = useDesignerStore.getState().generation.mesh;
      const rect = gl.domElement.getBoundingClientRect();
      const ndc = new Vector2(
        ((screen.x - rect.left) / rect.width) * 2 - 1,
        -((screen.y - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(ndc, camera);
      const { origin, direction } = raycaster.ray;

      const hit = raycastTriangles(
        origin,
        direction,
        live?.vertices ?? null,
        live?.indices ?? null
      );
      if (!hit) return null;

      const radiusPx = touch ? SNAP_RADIUS_TOUCH_PX : SNAP_RADIUS_PX;
      const tolerance = worldPerPixel(hit.point) * radiusPx;
      return {
        point: snapToCreaseEdges(hit.point, live?.edgeVertices ?? null, tolerance),
        normal: hit.normal,
        view: direction,
      };
    },
    [camera, gl, raycaster, worldPerPixel]
  );

  const commit = useCallback(
    (screen: Screen, touch: boolean) => {
      const result = pick(screen, touch);
      if (!result) return;
      const live = useDesignerStore.getState();
      if (live.ui.measure.mode === 'thickness') {
        const probe = probeThickness(
          result.point,
          result.normal,
          result.view,
          live.generation.mesh?.vertices ?? null,
          live.generation.mesh?.indices ?? null
        );
        // No material behind the face is a real answer, so leave whatever was
        // measured before rather than replacing it with a half-measurement.
        if (probe) setMeasurePoints([probe.from, probe.to]);
        return;
      }
      addMeasurePoint(result.point);
    },
    [pick, addMeasurePoint, setMeasurePoints]
  );

  // ── Pointer plumbing ───────────────────────────────────────────────
  //
  // The in-flight gesture lives in a ref, not in the effect's closure: the
  // effect re-registers whenever any of its dependencies change identity, and
  // a re-register mid-drag would otherwise reset the gesture and strand
  // OrbitControls disabled.
  const gestureRef = useRef({ x: 0, y: 0, id: -1, moved: false, scrub: false });
  const hoverFrameRef = useRef(0);

  useEffect(() => {
    const el = gl.domElement;
    const down = gestureRef.current;

    const setControls = (enabled: boolean): void => {
      if (hasEnabled(controls)) controls.enabled = enabled;
    };

    const onPointerDown = (e: PointerEvent): void => {
      // Shift+drag is the transient path and works even with the tool off; it
      // has no touch equivalent, so it is gated to a mouse.
      const scrub = e.shiftKey && e.pointerType === 'mouse';
      if (!useDesignerStore.getState().ui.measure.active && !scrub) return;
      down.x = e.clientX;
      down.y = e.clientY;
      down.id = e.pointerId;
      down.moved = false;
      down.scrub = scrub;
      if (scrub) {
        // Suspend orbit for the drag, else the camera moves under the ruler.
        setControls(false);
        const result = pick({ x: e.clientX, y: e.clientY }, false);
        if (result) setMeasurePoints([result.point]);
      }
    };

    const onPointerMove = (e: PointerEvent): void => {
      if (down.id === e.pointerId) {
        if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > DRAG_SLOP_PX) down.moved = true;
        if (down.scrub) {
          const result = pick({ x: e.clientX, y: e.clientY }, false);
          const anchored = useDesignerStore.getState().ui.measure.points;
          if (result && anchored.length > 0) setMeasurePoints([anchored[0], result.point]);
          return;
        }
      }
      if (!useDesignerStore.getState().ui.measure.active || e.pointerType === 'touch') return;
      // One pick per frame: the raycast walks every triangle, and pointermove
      // fires far more often than the canvas redraws.
      if (hoverFrameRef.current !== 0) return;
      hoverFrameRef.current = requestAnimationFrame(() => {
        hoverFrameRef.current = 0;
        setHover(pick({ x: e.clientX, y: e.clientY }, false)?.point ?? null);
        invalidate();
      });
    };

    const onPointerUp = (e: PointerEvent): void => {
      if (down.id !== e.pointerId) return;
      const wasScrub = down.scrub;
      const moved = down.moved;
      down.id = -1;
      down.scrub = false;
      if (wasScrub) {
        setControls(true);
        invalidate();
        return;
      }
      // A drag was an orbit, not a pick. Timing would misread a slow, deliberate
      // tap as a drag; travel does not.
      if (moved) return;
      commit({ x: e.clientX, y: e.clientY }, e.pointerType === 'touch');
      invalidate();
    };

    const onPointerLeave = (): void => {
      setHover(null);
      invalidate();
    };

    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      const live = useDesignerStore.getState().ui.measure;
      if (!live.active && live.points.length === 0) return;
      // First Escape drops the measurement, a second exits the tool, so an
      // accidental pick does not cost the mode.
      if (live.points.length > 0) clearMeasure();
      else setMeasureActive(false);
      invalidate();
    };

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerleave', onPointerLeave);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      if (hoverFrameRef.current !== 0) {
        cancelAnimationFrame(hoverFrameRef.current);
        hoverFrameRef.current = 0;
      }
      // Deliberately does NOT touch orbit. This cleanup runs on every
      // dependency change, not only on unmount, so releasing here would hand
      // the camera back mid-drag and let it swing under the ruler. The
      // unmount-only effect below owns the release.
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [gl, controls, pick, commit, invalidate, clearMeasure, setMeasureActive, setMeasurePoints]);

  // Release orbit if the component goes away mid-scrub, which would otherwise
  // leave the camera permanently frozen with nothing naming the cause. Empty
  // deps so this cleanup runs on unmount and never on a re-register; the
  // controls object is read through a ref because it is not a dependency here.
  const controlsRef = useRef<unknown>(null);
  useEffect(() => {
    controlsRef.current = controls;
  }, [controls]);
  useEffect(
    () => () => {
      const held = controlsRef.current;
      if (gestureRef.current.scrub && hasEnabled(held)) held.enabled = true;
    },
    []
  );

  // ── Drawing ────────────────────────────────────────────────────────
  // Hover is DERIVED away when the tool is off rather than cleared in an
  // effect: a stale value cannot show through, and there is no extra render.
  const liveHover = active ? hover : null;
  const anchor = points.length > 0 ? points[0] : null;
  const end = points.length > 1 ? points[1] : active && mode === 'points' ? liveHover : null;
  const span = anchor && end ? measureBetween(anchor, end) : null;

  const scaleAt = useMemo(() => (p: Vec3 | null) => (p ? worldPerPixel(p) : 0), [worldPerPixel]);

  const markers = useMemo(() => {
    const shown: Array<{ readonly p: Vec3; readonly key: string }> = points.map((p, i) => ({
      p,
      key: `pt-${i}`,
    }));
    if (mode === 'points' && liveHover && points.length < 2) {
      shown.push({ p: liveHover, key: 'hover' });
    }
    return shown.map(({ p, key }) => {
      const r = scaleAt(p) * MARKER_PX;
      return {
        key,
        segments: [
          [
            [p.x - r, p.y, p.z],
            [p.x + r, p.y, p.z],
          ],
          [
            [p.x, p.y - r, p.z],
            [p.x, p.y + r, p.z],
          ],
          [
            [p.x, p.y, p.z - r],
            [p.x, p.y, p.z + r],
          ],
        ] as Array<Array<[number, number, number]>>,
      };
    });
  }, [points, mode, liveHover, scaleAt]);

  if (!active && points.length === 0) return null;

  const label =
    span &&
    (mode === 'thickness'
      ? t('binDesigner.measure.thicknessValue', { mm: span.distance.toFixed(2) })
      : t('binDesigner.measure.distanceValue', { mm: span.distance.toFixed(2) }));
  const deltas =
    span && mode === 'points'
      ? t('binDesigner.measure.deltas', {
          dx: span.dx.toFixed(2),
          dy: span.dy.toFixed(2),
          dz: span.dz.toFixed(2),
        })
      : null;

  const mid =
    anchor && end
      ? { x: (anchor.x + end.x) / 2, y: (anchor.y + end.y) / 2, z: (anchor.z + end.z) / 2 }
      : null;
  const labelSize = mid ? scaleAt(mid) * LABEL_PX : 0;

  return (
    <group renderOrder={10}>
      {markers.map(({ key, segments }) =>
        segments.map((pts, i) => (
          <Line
            key={`${key}-${i}`}
            points={pts}
            color={MEASURE_COLOR}
            lineWidth={1.5}
            depthTest={false}
            transparent
          />
        ))
      )}

      {anchor && end && (
        <Line
          points={[
            [anchor.x, anchor.y, anchor.z],
            [end.x, end.y, end.z],
          ]}
          color={MEASURE_COLOR}
          lineWidth={2}
          dashed={points.length < 2}
          dashSize={1.5}
          gapSize={1}
          depthTest={false}
          transparent
        />
      )}

      {mid && label && (
        <Text
          position={[mid.x, mid.y, mid.z + labelSize]}
          fontSize={labelSize}
          color={MEASURE_COLOR}
          outlineWidth={labelSize * 0.12}
          outlineColor={MEASURE_LABEL_BG}
          anchorX="center"
          anchorY="bottom"
          depthOffset={-10}
        >
          {label}
        </Text>
      )}

      {mid && deltas && (
        <Text
          position={[mid.x, mid.y, mid.z - labelSize * 0.4]}
          fontSize={labelSize * 0.7}
          color={MEASURE_COLOR}
          outlineWidth={labelSize * 0.1}
          outlineColor={MEASURE_LABEL_BG}
          anchorX="center"
          anchorY="top"
          depthOffset={-10}
        >
          {deltas}
        </Text>
      )}
    </group>
  );
}
