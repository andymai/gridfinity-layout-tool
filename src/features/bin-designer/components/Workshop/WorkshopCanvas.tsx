/**
 * The Workshop 3D editor canvas — replaces the bin PreviewCanvas while the
 * designer holds an assembly. Parts render as instant client-side proxies;
 * the exact worker-fused solid joins in a later phase.
 *
 * Shift+drag over empty space draws a DOM marquee that adds the covered
 * parts to the selection. The scene flags pointerdowns it claims (part
 * grabs, gizmos) via `gestureStartRef` so the marquee leaves those alone —
 * scene handlers run first because the canvas is this wrapper's child.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { PerspectiveCamera } from 'three';
import { GizmoHelper, GizmoViewcube } from '@react-three/drei';
import type { OrbitControls as OrbitControlsType } from 'three-stdlib';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { detectWebGL, WebGLFallback, WebGLErrorBoundary } from '@/shared/webgl';
// Side-effect: must run before any <Text> mounts under this Canvas.
import '@/shared/webgl/configureTroikaText';
import { useThreeColors } from '@/shared/hooks/useThemeEffect';
import { useTranslation } from '@/i18n';
import {
  clearPreviewCanvas,
  setPreviewCanvas,
  setPreviewContext,
} from '@/features/bin-designer/utils/thumbnail';
import { useDesignerKeyboard } from '@/features/bin-designer/hooks/useDesignerKeyboard';
import { usePresetTransition } from '@/features/bin-designer/components/PreviewCanvas/previewCanvasCamera';
import type { Projection } from '@/shared/components/preview/CameraRig';
import { SpaceMouseController } from '@/shared/spacemouse/components/SpaceMouseController';
import { assemblyHeightUnits } from '@/shared/types/assemblyPlacement';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';
import { WorkshopScene, type MarqueeRect } from './WorkshopScene';
import { WorkshopViewBar } from './WorkshopViewBar';
import { WorkshopSelectionToolbar } from './WorkshopSelectionToolbar';
import { WorkshopHoverTip, type HoverTipTarget } from './WorkshopHoverTip';
import { WorkshopContextMenu, type WorkshopMenuState } from './WorkshopContextMenu';

const noop = (): void => undefined;

/** Registers this canvas with the thumbnail pipeline (see PreviewContextSync). */
function WorkshopContextSync() {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    if (camera instanceof PerspectiveCamera) {
      setPreviewContext(gl, scene, camera);
    }
  }, [gl, scene, camera]);
  return null;
}

/**
 * Corner view cube. Lives in GizmoHelper's portal scene, so the thumbnail
 * and GLB pipelines (which traverse the main scene) never see it.
 */
function WorkshopViewCube() {
  const colors = useThreeColors();
  const t = useTranslation();
  // Box material order is +x,-x,+y,-y,+z,-z — in this Z-up scene that is
  // right, left, BACK, FRONT, TOP, BOTTOM (drei's Y-up default face list
  // would print Top on the back wall).
  const faces = [
    t('workshop.cube.right'),
    t('workshop.cube.left'),
    t('workshop.cube.back'),
    t('workshop.cube.front'),
    t('workshop.cube.top'),
    t('workshop.cube.bottom'),
  ];
  return (
    <GizmoHelper alignment="top-right" margin={[56, 56]}>
      <GizmoViewcube
        faces={faces}
        color={colors.workshopCubeFace}
        hoverColor={colors.workshopCubeHover}
        textColor={colors.workshopCubeText}
        strokeColor={colors.workshopCubeStroke}
        opacity={0.92}
      />
    </GizmoHelper>
  );
}

interface MarqueeState {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

export function WorkshopCanvas() {
  const { structure, envelope } = useDesignerStore(
    useShallow((s) => ({ structure: s.structure, envelope: s.envelope }))
  );
  const threeColors = useThreeColors();
  // An armed click that hits no surface would otherwise be a silent no-op;
  // a brief pulse on the base plate shows where placement is valid.
  const [missFlashAt, setMissFlashAt] = useState(0);
  const [menu, setMenu] = useState<WorkshopMenuState | null>(null);
  const [projection, setProjection] = useState<Projection>('perspective');
  const [marquee, setMarquee] = useState<MarqueeState | null>(null);
  const [hoverTip, setHoverTip] = useState<HoverTipTarget | null>(null);
  const lastPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const undo = useDesignerStore((s) => s.undo);
  const redo = useDesignerStore((s) => s.redo);
  const webgl = detectWebGL();
  const controlsRef = useRef<OrbitControlsType | null>(null);
  const invalidateRef = useRef<(() => void) | null>(null);
  const suppressBaseClickRef = useRef(false);
  const gestureStartRef = useRef(false);
  const onGestureStart = useCallback(() => {
    gestureStartRef.current = true;
  }, []);
  const shouldSwallowBaseClick = useCallback(() => {
    if (!suppressBaseClickRef.current) return false;
    suppressBaseClickRef.current = false;
    return true;
  }, []);
  const pickRef = useRef<((rect: MarqueeRect) => string[]) | null>(null);
  const frameRef = useRef<(() => void) | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const isAssembly = structure?.kind === 'assembly';
  const heightUnits =
    isAssembly && envelope
      ? assemblyHeightUnits(
          structure,
          envelope.heightUnitMm,
          GRIDFINITY_SPEC.SOCKET_HEIGHT + structure.base.floorThickness,
          { w: envelope.width * envelope.gridUnitMm, d: envelope.depth * envelope.gridUnitMm }
        )
      : 6;
  const setCameraPreset = usePresetTransition(
    controlsRef,
    invalidateRef,
    envelope?.width ?? 2,
    envelope?.depth ?? 2,
    heightUnits,
    envelope?.gridUnitMm ?? 42,
    envelope?.heightUnitMm ?? 7
  );
  // R is also the selection's rotate-90 key — camera reset only takes it
  // when nothing is selected.
  const resetView = useCallback(() => {
    if (useDesignerStore.getState().ui.selectedAssemblyPartIds.length > 0) return;
    setCameraPreset('isometric');
  }, [setCameraPreset]);
  const toggleProjection = useCallback(() => {
    setProjection((p) => (p === 'perspective' ? 'orthographic' : 'perspective'));
  }, []);
  const frameSelection = useCallback(() => frameRef.current?.(), []);
  useEffect(() => () => clearPreviewCanvas(), []);
  // The bin preview mounts the shared designer shortcuts; this canvas
  // replaces it wholesale, so undo/redo and camera presets are re-bound here.
  // Render-mode shortcuts are bin-preview concerns and stay inert.
  useDesignerKeyboard({
    onCameraPreset: setCameraPreset,
    onResetView: resetView,
    onToggleWireframe: noop,
    onToggleXray: noop,
    onToggleProjection: toggleProjection,
    onUndo: undo,
    onRedo: redo,
  });

  const onPartContextMenu = useCallback((partId: string, clientX: number, clientY: number) => {
    // Right-click folds an unselected part into focus, like every desktop
    // editor — the menu then reads the selection it will act on.
    const store = useDesignerStore.getState();
    if (!store.ui.selectedAssemblyPartIds.includes(partId)) {
      store.setSelectedAssemblyPartId(partId);
    }
    setHoverTip(null);
    setMenu({ partId, x: clientX, y: clientY });
  }, []);

  const onHoverPart = useCallback((partId: string | null) => {
    setHoverTip(partId === null ? null : { partId, ...lastPointerRef.current });
  }, []);

  const endMarquee = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>): void => {
      const current = marquee;
      setMarquee(null);
      if (controlsRef.current) controlsRef.current.enabled = true;
      wrapperRef.current?.releasePointerCapture(e.pointerId);
      if (!current) return;
      const rect: MarqueeRect = {
        minX: Math.min(current.x0, current.x1),
        minY: Math.min(current.y0, current.y1),
        maxX: Math.max(current.x0, current.x1),
        maxY: Math.max(current.y0, current.y1),
      };
      const ids = pickRef.current?.(rect) ?? [];
      const store = useDesignerStore.getState();
      if (ids.length > 0) {
        const merged = [...store.ui.selectedAssemblyPartIds, ...ids];
        store.setSelectedAssemblyPartIds(merged, ids[ids.length - 1]);
      }
      // The release may still synthesize a click on the base — swallow it,
      // then disarm in case no click fires at all.
      suppressBaseClickRef.current = true;
      requestAnimationFrame(() => {
        suppressBaseClickRef.current = false;
      });
      invalidateRef.current?.();
    },
    [marquee]
  );

  if (structure?.kind !== 'assembly' || !envelope) return null;
  if (!webgl.available && webgl.reason) {
    return <WebGLFallback />;
  }

  return (
    <div
      ref={wrapperRef}
      className="relative h-full w-full"
      translate="no"
      data-testid="workshop-canvas"
      onContextMenu={(e) => e.preventDefault()}
      onPointerDownCapture={() => {
        // Reset before the canvas's own handlers get a chance to claim it.
        gestureStartRef.current = false;
        setHoverTip(null);
      }}
      onPointerDown={(e) => {
        if (e.button !== 0 || !e.shiftKey || gestureStartRef.current) return;
        // Only a press on the 3D canvas starts a marquee — shift-clicking
        // overlay chrome (view bar, selection toolbar) must stay a click.
        if ((e.target as HTMLElement).tagName !== 'CANVAS') return;
        if (useDesignerStore.getState().ui.workshopPendingPartType) return;
        const bounds = wrapperRef.current?.getBoundingClientRect();
        if (!bounds) return;
        const x = e.clientX - bounds.left;
        const y = e.clientY - bounds.top;
        setMarquee({ x0: x, y0: y, x1: x, y1: y });
        if (controlsRef.current) controlsRef.current.enabled = false;
        wrapperRef.current?.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const bounds = wrapperRef.current?.getBoundingClientRect();
        if (!bounds) return;
        lastPointerRef.current = { x: e.clientX - bounds.left, y: e.clientY - bounds.top };
        if (!marquee) return;
        setMarquee({ ...marquee, x1: e.clientX - bounds.left, y1: e.clientY - bounds.top });
      }}
      onPointerUp={(e) => {
        if (marquee) endMarquee(e);
      }}
      onPointerCancel={(e) => {
        if (marquee) endMarquee(e);
      }}
    >
      <WebGLErrorBoundary>
        <Canvas
          frameloop="demand"
          gl={{ antialias: true, localClippingEnabled: true, preserveDrawingBuffer: true }}
          onCreated={({ gl }) => setPreviewCanvas(gl.domElement)}
          onPointerMissed={() => {
            if (useDesignerStore.getState().ui.workshopPendingPartType) {
              setMissFlashAt(performance.now());
            }
          }}
        >
          <WorkshopContextSync />
          <SpaceMouseController />
          <WorkshopScene
            structure={structure}
            envelope={envelope}
            projection={projection}
            missFlashAt={missFlashAt}
            controlsRef={controlsRef}
            invalidateRef={invalidateRef}
            onPartContextMenu={onPartContextMenu}
            shouldSwallowBaseClick={shouldSwallowBaseClick}
            onGestureStart={onGestureStart}
            pickRef={pickRef}
            frameRef={frameRef}
            onHoverPart={onHoverPart}
          />
          <WorkshopViewCube />
        </Canvas>
      </WebGLErrorBoundary>
      {marquee && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-sm border"
          style={{
            left: Math.min(marquee.x0, marquee.x1),
            top: Math.min(marquee.y0, marquee.y1),
            width: Math.abs(marquee.x1 - marquee.x0),
            height: Math.abs(marquee.y1 - marquee.y0),
            // Match the 3D selection tint, not the app accent — the marquee
            // is part of the scene's selection language.
            borderColor: threeColors.workshopPartSelected,
            backgroundColor: `${threeColors.workshopPartSelected}1f`,
          }}
        />
      )}
      <WorkshopSelectionToolbar />
      {menu === null && marquee === null && <WorkshopHoverTip target={hoverTip} />}
      <WorkshopViewBar
        onPreset={setCameraPreset}
        onFit={frameSelection}
        projection={projection}
        onProjectionToggle={toggleProjection}
      />
      {menu && <WorkshopContextMenu menu={menu} onClose={() => setMenu(null)} />}
    </div>
  );
}
