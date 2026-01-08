import { useMemo, useCallback, useEffect, useRef } from "react"
import { Canvas } from "@react-three/fiber"
import { useShallow } from "zustand/shallow"
import { useLayoutStore, useUIStore } from "../../store"
import {
  STAGING_ID,
  DEFAULT_CATEGORY_COLOR,
  calcMaxGridUnits,
} from "../../constants"
import { useResponsive } from "../../hooks/useResponsive"
import { getLayerZStart } from "../../utils/collision"
import { darkenColor } from "../../utils/isometric"
import { Scene, type SceneHandle } from "./IsometricPreview/Scene"
import { BinMesh } from "./IsometricPreview/BinMesh"
import { SplitLineOverlay } from "./IsometricPreview/SplitLineOverlay"

// Height units (7mm) to grid units (42mm) conversion for proper proportions
const HEIGHT_TO_GRID_SCALE = 7 / 42

const PREVIEW_SIZE_SMALL = 280 // Default small preview

/**
 * Isometric 3D preview of the drawer layout using Three.js.
 * Shows all layers stacked with bins colored by category.
 */
export function IsometricPreview() {
  const sceneRef = useRef<SceneHandle>(null)
  const { isMobile, isTablet } = useResponsive()

  const {
    showIsometricPreview,
    hideLayersAbove,
    dimInactiveLayers,
    isPreviewExpanded,
    toggleHideLayersAbove,
    toggleDimInactiveLayers,
    togglePreviewExpanded,
    setPreviewExpanded,
  } = useUIStore(
    useShallow((state) => ({
      showIsometricPreview: state.showIsometricPreview,
      hideLayersAbove: state.hideLayersAbove,
      dimInactiveLayers: state.dimInactiveLayers,
      isPreviewExpanded: state.isPreviewExpanded,
      toggleHideLayersAbove: state.toggleHideLayersAbove,
      toggleDimInactiveLayers: state.toggleDimInactiveLayers,
      togglePreviewExpanded: state.togglePreviewExpanded,
      setPreviewExpanded: state.setPreviewExpanded,
    }))
  )

  // Calculate preview size based on expanded state and device
  const previewSize = useMemo(() => {
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
  }, [isPreviewExpanded, isMobile, isTablet])

  // Handle Escape key to collapse expanded preview
  useEffect(() => {
    if (!isPreviewExpanded) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPreviewExpanded(false)
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isPreviewExpanded, setPreviewExpanded])

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
      className={`rounded-lg overflow-hidden shadow-lg border border-stroke-subtle select-none ${
        isPreviewExpanded ? "" : "absolute top-14 right-4"
      }`}
      style={{
        width: previewSize,
        height: previewSize,
        zIndex: isPreviewExpanded ? undefined : 20,
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
              />
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
      {/* Reset view button - resets rotation, zoom, and pan */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          sceneRef.current?.resetView()
        }}
        className={`absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-surface/80 hover:bg-surface text-content-tertiary hover:text-content transition-colors ${
          isPreviewExpanded ? "text-xs" : "text-[10px]"
        }`}
        title="Reset view (rotation, zoom, and pan)"
      >
        Reset View
      </button>
      {/* Layer controls - only show when multiple layers */}
      {layout.layers.length > 1 && (
        <div
          className={`absolute bottom-1 right-1 flex ${
            isPreviewExpanded ? "gap-1" : "gap-0.5"
          }`}
        >
          {/* Dim inactive layers toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              toggleDimInactiveLayers()
            }}
            className={`flex items-center justify-center gap-1 rounded font-medium transition-colors ${
              isPreviewExpanded ? "h-7 px-2 text-xs" : "h-5 px-1.5 text-[9px]"
            } ${
              dimInactiveLayers
                ? "bg-accent/90 text-white"
                : "bg-surface/80 hover:bg-surface text-content-tertiary hover:text-content"
            }`}
            title={
              dimInactiveLayers
                ? "Dim inactive layers (on)"
                : "Dim inactive layers (off)"
            }
          >
            <svg
              className={isPreviewExpanded ? "w-4 h-4" : "w-3 h-3"}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
            <span>Dim</span>
          </button>
          {/* Slice view toggle - hide layers above active */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              toggleHideLayersAbove()
            }}
            className={`flex items-center justify-center gap-1 rounded font-medium transition-colors ${
              isPreviewExpanded ? "h-7 px-2 text-xs" : "h-5 px-1.5 text-[9px]"
            } ${
              hideLayersAbove
                ? "bg-accent/90 text-white"
                : "bg-surface/80 hover:bg-surface text-content-tertiary hover:text-content"
            }`}
            title={hideLayersAbove ? "Slice view (on)" : "Slice view (off)"}
          >
            <svg
              className={isPreviewExpanded ? "w-4 h-4" : "w-3 h-3"}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 5h16M4 12h16m-7 7h7"
              />
            </svg>
            <span>Slice</span>
          </button>
        </div>
      )}
      {/* Top button row */}
      <div className="absolute top-1 right-1 flex gap-1">
        {/* Expand/Collapse button */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            togglePreviewExpanded()
          }}
          className={`flex items-center justify-center rounded bg-surface/80 hover:bg-surface text-content-tertiary hover:text-content transition-colors ${
            isPreviewExpanded ? "w-7 h-7" : "w-5 h-5"
          }`}
          title={isPreviewExpanded ? "Collapse preview" : "Expand preview"}
        >
          {isPreviewExpanded ? (
            // Collapse icon (arrows pointing inward)
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
                d="M9 9L4 4m0 0v4m0-4h4m6 6l5 5m0 0v-4m0 4h-4M9 15l-5 5m0 0v-4m0 4h4m6-6l5-5m0 0v4m0-4h-4"
              />
            </svg>
          ) : (
            // Expand icon (arrows pointing outward)
            <svg
              className="w-3 h-3"
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
          className={`flex items-center justify-center rounded bg-surface/80 hover:bg-surface text-content-tertiary hover:text-content transition-colors ${
            isPreviewExpanded ? "w-7 h-7" : "w-5 h-5"
          }`}
          title={isPreviewExpanded ? "Collapse preview" : "Close preview"}
        >
          <svg
            className={isPreviewExpanded ? "w-4 h-4" : "w-3 h-3"}
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
        </button>
      </div>
    </div>
  )

  // Expanded mode: render as modal with backdrop
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
