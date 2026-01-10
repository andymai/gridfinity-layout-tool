import { useMemo, useCallback, useRef, useState, useEffect } from "react"
import { Canvas } from "@react-three/fiber"
import { useShallow } from "zustand/shallow"
import { useLayoutStore, useUIStore } from "../../store"
import {
  STAGING_ID,
  DEFAULT_CATEGORY_COLOR,
  calcMaxGridUnits,
} from "../../constants"
import { useResponsive } from "../../hooks/useResponsive"
import { use3DPreviewKeyboard } from "../../hooks/use3DPreviewKeyboard"
import { getLayerZStart } from "../../utils/collision"
import { darkenColor } from "../../utils/isometric"
import { Scene, type SceneHandle } from "./IsometricPreview/Scene"
import { BinMesh } from "./IsometricPreview/BinMesh"
import { SplitLineOverlay } from "./IsometricPreview/SplitLineOverlay"
import { BinCornerMarkers } from "./IsometricPreview/BinCornerMarkers"

// Height units (7mm) to grid units (42mm) conversion for proper proportions
const HEIGHT_TO_GRID_SCALE = 7 / 42

const PREVIEW_SIZE_SMALL = 280 // Default small preview

interface IsometricPreviewProps {
  inline?: boolean // When true, fills container instead of using fixed sizing
}

/**
 * Isometric 3D preview of the drawer layout using Three.js.
 * Shows all layers stacked with bins colored by category.
 */
export function IsometricPreview({ inline = false }: IsometricPreviewProps) {
  const sceneRef = useRef<SceneHandle>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const { isMobile, isTablet } = useResponsive()
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })

  const {
    showIsometricPreview,
    hideLayersAbove,
    dimInactiveLayers,
    isPreviewExpanded,
    isometricRotation,
    selectedBinIds,
    toggleHideLayersAbove,
    toggleDimInactiveLayers,
    togglePreviewExpanded,
    setPreviewExpanded,
    toggleIsometricPreview,
    setIsometricRotation,
  } = useUIStore(
    useShallow((state) => ({
      showIsometricPreview: state.showIsometricPreview,
      hideLayersAbove: state.hideLayersAbove,
      dimInactiveLayers: state.dimInactiveLayers,
      isPreviewExpanded: state.isPreviewExpanded,
      isometricRotation: state.isometricRotation,
      selectedBinIds: state.selectedBinIds,
      toggleHideLayersAbove: state.toggleHideLayersAbove,
      toggleDimInactiveLayers: state.toggleDimInactiveLayers,
      togglePreviewExpanded: state.togglePreviewExpanded,
      setPreviewExpanded: state.setPreviewExpanded,
      toggleIsometricPreview: state.toggleIsometricPreview,
      setIsometricRotation: state.setIsometricRotation,
    }))
  )

  // Track container dimensions in inline mode
  useEffect(() => {
    if (!inline || !containerRef.current) return

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        setContainerSize({ width, height })
      }
    })

    resizeObserver.observe(containerRef.current)
    return () => resizeObserver.disconnect()
  }, [inline])

  // Calculate preview size based on mode, expanded state, and device
  const previewSize = useMemo(() => {
    // In inline mode, use container dimensions (square aspect ratio)
    if (inline && containerSize.width > 0 && containerSize.height > 0) {
      return Math.min(containerSize.width, containerSize.height)
    }

    if (!isPreviewExpanded) return PREVIEW_SIZE_SMALL

    const vw = typeof window !== "undefined" ? window.innerWidth : 800
    const vh = typeof window !== "undefined" ? window.innerHeight : 600

    if (isMobile) {
      // Mobile: nearly fullscreen (98% of viewport)
      return Math.min(vw * 0.98, vh * 0.98)
    } else if (isTablet) {
      // Tablet: large but with some margin (95%)
      return Math.min(vw * 0.95, vh * 0.95)
    } else {
      // Desktop: fill most of viewport (90%)
      return Math.min(vw * 0.9, vh * 0.9)
    }
  }, [inline, containerSize, isPreviewExpanded, isMobile, isTablet])

  // Keyboard shortcuts for 3D preview navigation
  use3DPreviewKeyboard({
    sceneRef,
    isPreviewVisible: showIsometricPreview,
    isPreviewExpanded,
    togglePreviewVisibility: toggleIsometricPreview,
    togglePreviewExpanded,
    setPreviewExpanded,
    setIsometricRotation,
    isometricRotation,
  })

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        setPreviewExpanded(false)
      }
    },
    [setPreviewExpanded]
  )

  const layout = useLayoutStore((state) => state.layout)
  const activeLayerId = useUIStore((state) => state.activeLayerId)

  // Get layer indices for filtering
  const activeLayerIndex = layout.layers.findIndex(
    (l) => l.id === activeLayerId
  )

  // Calculate max print size for split line visualization
  const maxGridUnits = useMemo(
    () => calcMaxGridUnits(layout.printBedSize, layout.gridUnitMm),
    [layout.printBedSize, layout.gridUnitMm]
  )

  // Convert layout bins to renderable format with layer filtering
  const binsToRender = useMemo(() => {
    const result: Array<{
      bin: (typeof layout.bins)[0]
      x: number
      y: number
      z: number
      height: number
      clearanceHeight: number
      color: string
      opacity: number
    }> = []

    for (const bin of layout.bins) {
      if (bin.layerId === STAGING_ID) continue

      // Filter out bins from layers above active layer if hideLayersAbove is enabled
      if (hideLayersAbove && activeLayerIndex >= 0) {
        const binLayerIndex = layout.layers.findIndex(
          (l) => l.id === bin.layerId
        )
        if (binLayerIndex > activeLayerIndex) continue
      }

      const zStart =
        getLayerZStart(bin.layerId, layout.layers) * HEIGHT_TO_GRID_SCALE
      const category = layout.categories.find((c) => c.id === bin.category)
      const baseColor = category?.color || DEFAULT_CATEGORY_COLOR

      // Optionally dim non-active layers
      const isActiveLayer = bin.layerId === activeLayerId
      const isDimmed = dimInactiveLayers && !isActiveLayer
      const color = isDimmed ? darkenColor(baseColor, 0.4) : baseColor

      // Y-axis: In grid, y=0 is front (bottom), y increases toward back (top)
      // In 3D: Y=0 is front (toward camera), Y increases away (toward back)
      // Direct mapping - no flip needed
      result.push({
        bin,
        x: bin.x,
        y: bin.y,
        z: zStart,
        height: bin.height * HEIGHT_TO_GRID_SCALE,
        clearanceHeight: (bin.clearanceHeight || 0) * HEIGHT_TO_GRID_SCALE,
        color,
        opacity: isDimmed ? 0.5 : 1,
      })
    }

    // Sort bins for correct depth ordering with camera at front-right viewing toward center
    // Camera is at: (centerX + dist, centerY - dist, centerZ + dist) = (X+, Y-, Z+)
    // Distance from camera increases as X decreases and Y increases
    // So depth = (x - y): low value = far, high value = close
    result.sort((a, b) => {
      // Layer depth (z) is primary
      if (a.z !== b.z) {
        return a.z - b.z
      }

      // Within same layer, sort by distance from camera
      // Camera at (X+, Y-) means close bins have high (x-y), far bins have low (x-y)
      // Sort ascending (x-y) to render far bins first (with low z-offsets)
      const depthA = a.x - a.y
      const depthB = b.x - b.y

      return depthA - depthB
    })

    // Add tiny z-offsets to prevent z-fighting on coplanar surfaces
    // 0.0002 units = 0.2mm per bin - imperceptible but prevents flickering
    result.forEach((binData, index) => {
      binData.z += index * 0.0002
    })

    return result
  }, [
    layout,
    activeLayerId,
    hideLayersAbove,
    activeLayerIndex,
    dimInactiveLayers,
  ])

  if (!showIsometricPreview) {
    return null
  }

  // Preview container content (shared between small and expanded modes)
  const previewContent = (
    <div
      ref={containerRef}
      className={`relative overflow-hidden select-none ${
        inline ? "w-full h-full flex items-center justify-center" :
        isPreviewExpanded ? "rounded-lg shadow-lg border border-stroke-subtle" : "absolute top-14 right-4 rounded-lg shadow-lg border border-stroke-subtle"
      }`}
      style={{
        width: inline ? undefined : previewSize,
        height: inline ? undefined : previewSize,
        zIndex: isPreviewExpanded ? undefined : inline ? undefined : 20,
      }}
    >
      <Canvas
        orthographic
        camera={{
          position: [10, 10, 10],
          zoom: 30,
          near: 0.1,
          far: 1000,
        }}
        style={{ background: "#0a0a0f" }}
      >
        <Scene
          ref={sceneRef}
          drawerWidth={layout.drawer.width}
          drawerDepth={layout.drawer.depth}
          drawerHeight={layout.drawer.height}
          gridUnitMm={layout.gridUnitMm}
          layoutName={layout.name}
          isExpanded={isPreviewExpanded}
        >
          {binsToRender.map((binData) => (
              <group key={binData.bin.id}>
                <BinMesh
                  bin={binData.bin}
                  x={binData.x}
                  y={binData.y}
                  z={binData.z}
                  height={binData.height}
                  color={binData.color}
                  opacity={binData.opacity}
                  isSelected={selectedBinIds.includes(binData.bin.id)}
                />
                {/* Corner markers for architectural drawing style */}
                <BinCornerMarkers
                  x={binData.x}
                  y={binData.y}
                  z={binData.z}
                  width={binData.bin.width}
                  depth={binData.bin.depth}
                  height={binData.height}
                  opacity={binData.opacity}
                />
                {/* Clearance zone visualization - translucent box above bin */}
                {binData.clearanceHeight > 0 && (
                  <mesh
                    position={[
                      binData.x + binData.bin.width / 2,
                      binData.y + binData.bin.depth / 2,
                      binData.z + binData.height + binData.clearanceHeight / 2,
                    ]}
                  >
                    <boxGeometry
                      args={[
                        binData.bin.width - 0.05,
                        binData.bin.depth - 0.05,
                        binData.clearanceHeight,
                      ]}
                    />
                    <meshStandardMaterial
                      color="#ff6b6b"
                      transparent
                      opacity={0.25 * binData.opacity}
                      depthWrite={false}
                    />
                  </mesh>
                )}
                {/* Split lines for oversized bins */}
                {(binData.bin.width > maxGridUnits ||
                  binData.bin.depth > maxGridUnits) && (
                  <SplitLineOverlay
                    x={binData.x}
                    y={binData.y}
                    z={binData.z}
                    width={binData.bin.width}
                    depth={binData.bin.depth}
                    height={binData.height}
                    maxGridUnits={maxGridUnits}
                    opacity={binData.opacity}
                  />
                )}
              </group>
          ))}
        </Scene>
      </Canvas>
      {/* Empty state - shown when no bins are placed */}
      {binsToRender.length === 0 && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ zIndex: 10 }}
        >
          <div
            className="flex flex-col items-center gap-3 px-6 py-8 rounded-lg text-center"
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              maxWidth: isPreviewExpanded ? "400px" : "240px",
            }}
          >
            {/* SVG Icon - Box/Cube */}
            <svg
              className={isPreviewExpanded ? "w-12 h-12" : "w-10 h-10"}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              style={{ color: "rgba(255, 255, 255, 0.6)" }}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
            {/* Heading */}
            <h3
              className={`font-semibold ${
                isPreviewExpanded ? "text-lg" : "text-base"
              }`}
              style={{ color: "rgba(255, 255, 255, 0.9)" }}
            >
              No Bins Yet
            </h3>
            {/* Message */}
            <p
              className={isPreviewExpanded ? "text-sm" : "text-xs"}
              style={{ color: "rgba(255, 255, 255, 0.7)" }}
            >
              Place bins on the grid to see your 3D layout
            </p>
          </div>
        </div>
      )}
      {/* Camera preset buttons */}
      <div
        className={`absolute top-1 left-1/2 transform -translate-x-1/2 flex ${
          isPreviewExpanded && !isMobile ? "gap-1 p-1 rounded-lg bg-surface/50" : "gap-0.5"
        }`}
      >
        {/* Isometric view - 3D cube */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            sceneRef.current?.setPreset('isometric')
          }}
          className={`btn btn-ghost ${
            isPreviewExpanded && !isMobile ? "gap-2 px-3 py-2" : "w-8 h-8 p-0"
          }`}
          title="Isometric view"
        >
          <svg
            className={isPreviewExpanded && !isMobile ? "w-4 h-4" : "w-4 h-4"}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
          </svg>
          {isPreviewExpanded && !isMobile && (
            <span className="text-xs font-medium">3D</span>
          )}
        </button>
        {/* Top view - eye looking down */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            sceneRef.current?.setPreset('top')
          }}
          className={`btn btn-ghost ${
            isPreviewExpanded && !isMobile ? "gap-2 px-3 py-2" : "w-8 h-8 p-0"
          }`}
          title="Top view"
        >
          <svg
            className={isPreviewExpanded && !isMobile ? "w-4 h-4" : "w-4 h-4"}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
            {/* Grid from above */}
            <rect x="4" y="4" width="16" height="16" strokeWidth={2} rx="1" />
            <line x1="12" y1="4" x2="12" y2="20" strokeWidth={1.5} />
            <line x1="4" y1="12" x2="20" y2="12" strokeWidth={1.5} />
          </svg>
          {isPreviewExpanded && !isMobile && (
            <span className="text-xs font-medium">Top</span>
          )}
        </button>
        {/* Front view - rectangle wider than tall */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            sceneRef.current?.setPreset('front')
          }}
          className={`btn btn-ghost ${
            isPreviewExpanded && !isMobile ? "gap-2 px-3 py-2" : "w-8 h-8 p-0"
          }`}
          title="Front view"
        >
          <svg
            className={isPreviewExpanded && !isMobile ? "w-4 h-4" : "w-4 h-4"}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
            {/* Wide rectangle - front elevation */}
            <rect x="3" y="8" width="18" height="10" strokeWidth={2} rx="1" />
            <line x1="3" y1="13" x2="21" y2="13" strokeWidth={1.5} />
          </svg>
          {isPreviewExpanded && !isMobile && (
            <span className="text-xs font-medium">Front</span>
          )}
        </button>
        {/* Side view - rectangle taller than wide */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            sceneRef.current?.setPreset('side')
          }}
          className={`btn btn-ghost ${
            isPreviewExpanded && !isMobile ? "gap-2 px-3 py-2" : "w-8 h-8 p-0"
          }`}
          title="Side view"
        >
          <svg
            className={isPreviewExpanded && !isMobile ? "w-4 h-4" : "w-4 h-4"}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
            {/* Tall rectangle - side elevation */}
            <rect x="7" y="3" width="10" height="18" strokeWidth={2} rx="1" />
            <line x1="7" y1="12" x2="17" y2="12" strokeWidth={1.5} />
          </svg>
          {isPreviewExpanded && !isMobile && (
            <span className="text-xs font-medium">Side</span>
          )}
        </button>
      </div>
      {/* Layer controls - only show when multiple layers */}
      {layout.layers.length > 1 && (
        <div
          className={`absolute bottom-1 right-1 flex ${
            isPreviewExpanded && !isMobile ? "gap-1 p-1 rounded-lg bg-surface/50" : "gap-0.5"
          }`}
        >
          {/* Focus active layer - dims other layers */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              toggleDimInactiveLayers()
            }}
            className={`btn ${dimInactiveLayers ? 'btn-primary' : 'btn-ghost'} ${
              isPreviewExpanded && !isMobile ? "gap-2 px-3 py-2" : "w-8 h-8 p-0"
            }`}
            title={dimInactiveLayers ? "Focus active layer (on)" : "Focus active layer (off)"}
          >
            <svg
              className={isPreviewExpanded && !isMobile ? "w-5 h-5" : "w-4 h-4"}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* Eye icon - focus/visibility */}
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            {isPreviewExpanded && !isMobile && (
              <span className="text-xs">Focus</span>
            )}
          </button>
          {/* Show all layers toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              toggleHideLayersAbove()
            }}
            className={`btn ${hideLayersAbove ? 'btn-ghost' : 'btn-primary'} ${
              isPreviewExpanded && !isMobile ? "gap-2 px-3 py-2" : "w-8 h-8 p-0"
            }`}
            title={hideLayersAbove ? "Show all layers" : "Showing all layers"}
          >
            <svg
              className={isPreviewExpanded && !isMobile ? "w-5 h-5" : "w-4 h-4"}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* Stacked layers icon */}
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
            {isPreviewExpanded && !isMobile && (
              <span className="text-xs">All</span>
            )}
          </button>
        </div>
      )}
      {/* Top button row */}
      <div
        className={`absolute top-1 right-1 flex ${
          isPreviewExpanded && !isMobile ? "gap-1 p-1 rounded-lg bg-surface/50" : "gap-0.5"
        }`}
      >
        {/* Expand/Collapse button */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            togglePreviewExpanded()
          }}
          className={`btn btn-ghost ${
            isPreviewExpanded && !isMobile ? "gap-2 px-3 py-2" : "w-8 h-8 p-0"
          }`}
          title={isPreviewExpanded ? "Collapse preview" : "Expand preview"}
        >
          {isPreviewExpanded ? (
            <>
              <svg
                className={isMobile ? "w-4 h-4" : "w-5 h-5"}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 9L4 4m0 0v4m0-4h4m6 6l5 5m0 0v-4m0 4h-4M9 15l-5 5m0 0v-4m0 4h4m6-6l5-5m0 0v4m0-4h-4"
                />
              </svg>
              {!isMobile && <span className="text-xs font-medium">Collapse</span>}
            </>
          ) : (
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5"
              />
            </svg>
          )}
        </button>
        {/* Close button */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            if (isPreviewExpanded) {
              setPreviewExpanded(false)
            } else {
              useUIStore.getState().toggleIsometricPreview()
            }
          }}
          className={`btn btn-ghost ${
            isPreviewExpanded && !isMobile ? "gap-2 px-3 py-2" : "w-8 h-8 p-0"
          }`}
          title={isPreviewExpanded ? "Collapse preview" : "Close preview"}
        >
          <svg
            className={isPreviewExpanded && !isMobile ? "w-5 h-5" : "w-4 h-4"}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
          {isPreviewExpanded && !isMobile && (
            <span className="text-xs font-medium">Close</span>
          )}
        </button>
      </div>

      {/* Keyboard shortcuts indicator - only shown in expanded mode on desktop */}
      {isPreviewExpanded && !isMobile && !isTablet && (
        <div
          className="absolute bottom-16 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-lg text-xs"
          style={{
            background: "rgba(0, 0, 0, 0.8)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            pointerEvents: "none",
          }}
        >
          <div className="flex items-center gap-4 text-content-secondary">
            <span><kbd className="px-1.5 py-0.5 rounded bg-surface-elevated text-content">V</kbd> Toggle</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-surface-elevated text-content">Space</kbd> Expand</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-surface-elevated text-content">R</kbd> Reset</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-surface-elevated text-content">←→</kbd> Rotate</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-surface-elevated text-content">Esc</kbd> Close</span>
          </div>
        </div>
      )}
    </div>
  )

  // Expanded mode: render as modal with backdrop (takes priority over inline mode)
  if (isPreviewExpanded) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-fade-in"
        onClick={handleBackdropClick}
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {previewContent}
      </div>
    )
  }

  // Small mode: render in corner
  return previewContent
}
