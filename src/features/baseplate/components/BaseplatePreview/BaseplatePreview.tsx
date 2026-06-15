/**
 * Three.js 3D preview canvas for the standalone baseplate page.
 *
 * Renders the generated baseplate mesh with lighting, gradient background,
 * footprint grid, axis labels, dimension annotations, and orbit controls.
 *
 * Pockets are always centered at origin (aligned with the FootprintGrid).
 * The slab extends asymmetrically when padding differs per side.
 */

import { useRef, useCallback, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useShallow } from 'zustand/react/shallow';
import type { OrbitControls as OrbitControlsType } from 'three-stdlib';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';
import { FootprintGrid } from '@/shared/components/preview/FootprintGrid';
import { BinAxisLabels } from '@/shared/components/preview/BinAxisLabels';
import { GradientBackground } from '@/shared/components/preview/GradientBackground';
import { useLayoutStore } from '@/core/store/layout';
import { useBaseplatePageStore } from '../../store/baseplatePageStore';
import { SplitBaseplateMeshes } from './SplitBaseplateMeshes';
import { StackedBaseplateMeshes } from './StackedBaseplateMeshes';
import { StackSeparationSlider } from './StackSeparationSlider';
import { ConnectorKeyMeshes } from './ConnectorKeyMeshes';
import { GhostPaddingOutline } from './GhostPaddingOutline';
import { useResponsive } from '@/shared/hooks/useResponsive';
import { useSettingsStore } from '@/core/store';
import { useTranslation } from '@/i18n';
import type { CameraPreset } from './cameraUtils';
import { calculateIdealDistance, calculateMaxOrbitDistance } from './cameraUtils';
import { BaseplateMesh } from './BaseplateMesh';
import { SceneLighting } from './SceneLighting';
import { CameraController } from './CameraController';
import { CameraRig, type Projection } from '@/shared/components/preview/CameraRig';
import { DimensionLabels } from './DimensionLabels';
import { useBaseplatePresetTransition } from './useBaseplatePresetTransition';
import { BaseplatePreviewControls } from './BaseplatePreviewControls';
import { overlayStatusText } from './overlayStatusText';
import { useGenerationElapsed } from './useGenerationElapsed';
import { useBaseplateKeyboard } from '../../hooks/useBaseplateKeyboard';
import { PanelErrorBoundary } from '@/shell/PanelErrorBoundary';
import { detectWebGL, WebGLFallback, WebGLErrorBoundary } from '@/shared/webgl';

interface BaseplatePreviewProps {
  width: number;
  depth: number;
  gridUnitMm: number;
  paddingLeft: number;
  paddingRight: number;
  paddingFront: number;
  paddingBack: number;
}

export function BaseplatePreview({
  width,
  depth,
  gridUnitMm,
  paddingLeft,
  paddingRight,
  paddingFront,
  paddingBack,
}: BaseplatePreviewProps) {
  const t = useTranslation();
  const controlsRef = useRef<OrbitControlsType>(null);
  const invalidateRef = useRef<(() => void) | null>(null);
  const { isDesktop } = useResponsive();
  const filamentColor = useSettingsStore((s) => s.settings.baseplateFilamentColor);
  const webgl = detectWebGL();

  const {
    wasmStatus,
    hasMesh,
    hasSplitMeshes,
    isSplit,
    splitViewMode,
    generationStatus,
    splitProgress,
    dedupStats,
  } = useBaseplatePageStore(
    useShallow((s) => ({
      wasmStatus: s.wasmStatus,
      hasMesh: s.generation.mesh !== null && s.generation.mesh.vertices !== null,
      hasSplitMeshes: s.pieceMeshes.length > 0,
      isSplit: s.tiling?.isSplit ?? false,
      splitViewMode: s.splitViewMode,
      generationStatus: s.generation.status,
      splitProgress: s.splitProgress,
      dedupStats: s.dedupStats,
    }))
  );

  const setSplitViewMode = useBaseplatePageStore((s) => s.setSplitViewMode);
  const setSelectedPieceLabel = useBaseplatePageStore((s) => s.setSelectedPieceLabel);
  const handlePointerMissed = useCallback(() => {
    setSelectedPieceLabel(null);
  }, [setSelectedPieceLabel]);

  // Camera preset state
  const [activePreset, setActivePreset] = useState<CameraPreset | null>(null);
  // Projection + xray state (ephemeral, per-viewport)
  const [projection, setProjection] = useState<Projection>('perspective');
  const [xray, setXray] = useState(false);

  const toggleProjection = useCallback(() => {
    setProjection((p) => (p === 'perspective' ? 'orthographic' : 'perspective'));
  }, []);
  const toggleXray = useCallback(() => {
    setXray((x) => !x);
  }, []);

  useBaseplateKeyboard({
    onToggleXray: toggleXray,
    onToggleProjection: toggleProjection,
  });

  const setCameraPreset = useBaseplatePresetTransition(
    controlsRef,
    invalidateRef,
    width,
    depth,
    gridUnitMm,
    paddingLeft,
    paddingRight,
    paddingFront,
    paddingBack
  );

  const handleCameraPreset = useCallback(
    (preset: CameraPreset) => {
      setActivePreset(preset);
      setCameraPreset(preset);
    },
    [setCameraPreset]
  );

  const handleResetView = useCallback(() => {
    setActivePreset('top');
    setCameraPreset('top');
  }, [setActivePreset, setCameraPreset]);

  const handleOrbitStart = useCallback(() => {
    setActivePreset(null);
  }, []);

  const handleOrbitEnd = useCallback(() => {
    invalidateRef.current?.();
  }, []);

  const updateSetting = useSettingsStore((s) => s.updateSetting);
  const handleColorChange = useCallback(
    (color: string) => {
      updateSetting('baseplateFilamentColor', color);
    },
    [updateSetting]
  );

  const totalH = GRIDFINITY_SPEC.SOCKET_HEIGHT;

  // Stack-print preview: replaces the assembled plate with flipped towers.
  const stackPrint = useLayoutStore((s) => s.layout.baseplateParams?.stackPrint);
  const stackEnabled = stackPrint?.enabled === true;
  const [separationMm, setSeparationMm] = useState(0);
  const [stackBounds, setStackBounds] = useState<{
    widthMm: number;
    depthMm: number;
    heightMm: number;
  } | null>(null);
  const handleStackBounds = useCallback(
    (b: { widthMm: number; depthMm: number; heightMm: number }) => setStackBounds(b),
    []
  );
  const targetZ = stackEnabled && stackBounds ? stackBounds.heightMm / 2 : totalH / 2;

  const baseMaxOrbitDistance = useMemo(
    () =>
      calculateMaxOrbitDistance(
        calculateIdealDistance(
          width,
          depth,
          gridUnitMm,
          paddingLeft,
          paddingRight,
          paddingFront,
          paddingBack,
          45
        )
      ),
    [width, depth, gridUnitMm, paddingLeft, paddingRight, paddingFront, paddingBack]
  );
  // A stack is far taller/wider than one plate — let the camera pull back enough
  // to see the whole tower field.
  const maxOrbitDistance =
    stackEnabled && stackBounds
      ? Math.max(baseMaxOrbitDistance, stackBounds.heightMm * 4, stackBounds.widthMm * 3)
      : baseMaxOrbitDistance;

  const hasAnyMesh = isSplit ? hasSplitMeshes : hasMesh;
  const hasError = wasmStatus === 'error' || generationStatus === 'error';
  const isWasmLoading = !hasError && wasmStatus !== 'ready';
  const isGenerating = generationStatus === 'generating';
  /**
   * Direct-mesh preview is on screen while BREP is still in flight. The
   * canvas is interactive; the user just doesn't have the high-fidelity
   * geometry yet. Used to soften the loading indicator from a centered
   * blocking spinner into a subtle pill.
   */
  const hasDirectPreview = hasAnyMesh && isGenerating;
  /**
   * Big initial-load skeleton appears only when the canvas is genuinely
   * blank — direct-mesh normally lands within ~100ms so this is rare in
   * practice (kept as fallback for the very first render frame and for
   * the unhappy path where direct-mesh fails before BREP completes).
   */
  const showInitSkeleton = isWasmLoading && !hasAnyMesh;

  // Elapsed time tracking for generation
  const elapsedSec = useGenerationElapsed(isGenerating);

  return (
    <div
      className="relative h-full w-full touch-manipulation"
      role="img"
      aria-label={t('baseplate.title')}
    >
      {/* Initial load skeleton -- matches bin designer PreviewSkeleton.
          Only shown when the canvas is genuinely blank; direct-mesh preview
          normally hides this within ~100ms. */}
      {showInitSkeleton && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center bg-surface"
          role="status"
          aria-live="polite"
        >
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-xl bg-surface-elevated animate-pulse motion-reduce:animate-none">
              <svg
                className="h-8 w-8 text-content-tertiary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9"
                />
              </svg>
            </div>
            <p className="text-sm font-medium text-content-tertiary">
              {t('baseplate.loadingEngine')}
            </p>
          </div>
        </div>
      )}

      {!webgl.available && webgl.reason ? (
        <WebGLFallback reason={webgl.reason} component="baseplate" />
      ) : (
        <div
          className={`h-full w-full transition-opacity duration-500 ${hasAnyMesh ? 'opacity-100' : 'opacity-0'}`}
        >
          <PanelErrorBoundary panelName="3D Preview">
            <WebGLErrorBoundary component="baseplate">
              <Canvas
                frameloop="demand"
                gl={{ antialias: true }}
                onPointerMissed={handlePointerMissed}
              >
                <CameraRig
                  projection={projection}
                  initialPosition={[100, -100, 80]}
                  target={[0, 0, targetZ]}
                  far={20_000}
                />

                <GradientBackground />
                <SceneLighting />

                <CameraController
                  controlsRef={controlsRef}
                  invalidateRef={invalidateRef}
                  width={width}
                  depth={depth}
                  gridUnitMm={gridUnitMm}
                  paddingLeft={paddingLeft}
                  paddingRight={paddingRight}
                  paddingFront={paddingFront}
                  paddingBack={paddingBack}
                />

                {stackPrint && stackEnabled ? (
                  <StackedBaseplateMeshes
                    stack={stackPrint}
                    color={filamentColor}
                    separationMm={separationMm}
                    onBounds={handleStackBounds}
                  />
                ) : isSplit ? (
                  <>
                    <SplitBaseplateMeshes
                      totalWidthUnits={width}
                      totalDepthUnits={depth}
                      gridUnitMm={gridUnitMm}
                      isPreview={hasDirectPreview}
                      xray={xray}
                    />
                    <ConnectorKeyMeshes />
                  </>
                ) : (
                  <BaseplateMesh color={filamentColor} isPreview={hasDirectPreview} xray={xray} />
                )}

                {/* Single-plate overlays (ghost, grid, dimensions) don't apply to
                    the stacked tower layout — hide them while stacking. */}
                {!stackEnabled && (
                  <>
                    {/* Ghost outline only in assembled mode -- exploded scatters pieces beyond slab bounds */}
                    {splitViewMode !== 'exploded' && (
                      <GhostPaddingOutline
                        width={width}
                        depth={depth}
                        gridUnitMm={gridUnitMm}
                        paddingLeft={paddingLeft}
                        paddingRight={paddingRight}
                        paddingFront={paddingFront}
                        paddingBack={paddingBack}
                        isGenerating={generationStatus === 'generating'}
                      />
                    )}

                    <FootprintGrid width={width} depth={depth} gridUnitMm={gridUnitMm} />
                    {/* Hide measurement labels in exploded mode -- pieces scatter beyond these positions */}
                    {splitViewMode !== 'exploded' && (
                      <>
                        <BinAxisLabels width={width} depth={depth} gridUnitMm={gridUnitMm} />
                        <DimensionLabels
                          width={width}
                          depth={depth}
                          gridUnitMm={gridUnitMm}
                          paddingLeft={paddingLeft}
                          paddingRight={paddingRight}
                          paddingFront={paddingFront}
                          paddingBack={paddingBack}
                        />
                      </>
                    )}
                  </>
                )}

                <OrbitControls
                  ref={controlsRef}
                  makeDefault
                  target={[0, 0, targetZ]}
                  enableDamping
                  dampingFactor={0.12}
                  rotateSpeed={0.8}
                  minDistance={20}
                  maxDistance={maxOrbitDistance}
                  maxPolarAngle={Math.PI * 0.85}
                  minPolarAngle={Math.PI * 0.05}
                  enablePan={isDesktop}
                  onStart={handleOrbitStart}
                  onEnd={handleOrbitEnd}
                />
              </Canvas>
            </WebGLErrorBoundary>
          </PanelErrorBoundary>

          {stackEnabled && hasAnyMesh && (
            <StackSeparationSlider value={separationMm} onChange={setSeparationMm} />
          )}
        </div>
      )}

      {/* Camera controls + view toggle overlay */}
      {/* Assembled/Exploded is for split pieces; stack mode shows towers with
          their own separation slider instead, so hide that toggle there. */}
      <BaseplatePreviewControls
        activePreset={activePreset}
        isSplit={isSplit && !stackEnabled}
        splitViewMode={splitViewMode}
        filamentColor={filamentColor}
        projection={projection}
        xray={xray}
        onCameraPreset={handleCameraPreset}
        onResetView={handleResetView}
        onViewModeChange={setSplitViewMode}
        onColorChange={handleColorChange}
        onToggleProjection={toggleProjection}
        onToggleXray={toggleXray}
      />

      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center" role="alert">
          <div className="mx-4 max-w-sm rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-center shadow-lg dark:border-red-800 dark:bg-red-950">
            <p className="text-sm font-medium text-red-800 dark:text-red-200">
              {wasmStatus === 'error'
                ? t('baseplate.wasmLoadFailed')
                : t('baseplate.generationFailed')}
            </p>
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              {t('baseplate.errorRetryHint')}
            </p>
          </div>
        </div>
      )}

      {/* Bottom-center status chip. Pairs with the desaturated mesh tint so the
          two preview signals reinforce each other (geometry says "draft," chip
          spells out why). Suppressed when the canvas is blank — the initial
          skeleton already conveys "loading." */}
      {isGenerating && !showInitSkeleton && (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center"
          role="status"
          aria-live="polite"
        >
          <div className="pointer-events-auto flex items-center gap-2.5 rounded-lg border border-accent/40 bg-surface-elevated/95 px-3 py-2 font-mono text-xs shadow-lg backdrop-blur-sm">
            <svg
              className="h-4 w-4 shrink-0 text-accent animate-spin"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-20"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="3"
              />
              <path
                className="opacity-80"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span className="text-content-secondary">
              {overlayStatusText(isWasmLoading, splitProgress, dedupStats, hasDirectPreview, t)}
              {elapsedSec !== null && elapsedSec >= 3 && (
                <span className="ml-1.5 text-content-tertiary">
                  {t('baseplate.elapsed', { seconds: elapsedSec })}
                </span>
              )}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
