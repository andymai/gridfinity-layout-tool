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
      ref={containerRef}
      className={`relative rounded-lg overflow-hidden shadow-lg border border-stroke-subtle select-none ${
        inline ? "w-full h-full flex items-center justify-center" :
        isPreviewExpanded ? "" : "absolute top-14 right-4"
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
      {/* Reset view button - resets rotation, zoom, and pan */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          sceneRef.current?.resetView()
        }}
        className={`absolute bottom-1 left-1 group flex items-center rounded transition-all duration-200 hover:scale-105 ${
          isPreviewExpanded && !isMobile ? "gap-2 px-3 py-2" : "w-9 h-9 justify-center"
        }`}
        style={{
          background: "rgba(255, 255, 255, 0.1)",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          backdropFilter: "blur(8px)",
          color: "rgba(255, 255, 255, 0.7)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)";
          e.currentTarget.style.color = "rgba(255, 255, 255, 0.95)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
          e.currentTarget.style.color = "rgba(255, 255, 255, 0.7)";
        }}
        title="Reset view (rotation, zoom, and pan)"
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
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        {isPreviewExpanded && !isMobile && (
          <span className="text-xs font-medium">Reset</span>
        )}
        {!isPreviewExpanded && (
          <span className="absolute left-full ml-2 px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" style={{
            background: "rgba(0, 0, 0, 0.9)",
            color: "white",
          }}>
            Reset
          </span>
        )}
      </button>
      {/* Camera preset buttons */}
      <div
        className={`absolute top-1 left-1/2 transform -translate-x-1/2 flex ${
          isPreviewExpanded && !isMobile ? "gap-1 p-1 rounded-lg" : "gap-0.5"
        }`}
        style={isPreviewExpanded && !isMobile ? {
          background: "rgba(0, 0, 0, 0.2)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
        } : {}}
      >
        {[
          { preset: 'isometric' as const, icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4', label: 'Isometric' },
          { preset: 'top' as const, icon: 'M3 12h18M3 6h18M3 18h18', label: 'Top' },
          { preset: 'front' as const, icon: 'M4 6h16M4 12h16M4 18h16', label: 'Front' },
          { preset: 'side' as const, icon: 'M9 5l7 7-7 7', label: 'Side' },
        ].map(({ preset, icon, label }) => (
          <button
            key={preset}
            onClick={(e) => {
              e.stopPropagation()
              sceneRef.current?.setPreset(preset)
            }}
            className={`group flex items-center rounded transition-all duration-200 hover:scale-105 ${
              isPreviewExpanded && !isMobile ? "gap-2 px-3 py-2" : "w-8 h-8 justify-center"
            }`}
            style={{
              background: "rgba(255, 255, 255, 0.1)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              backdropFilter: "blur(8px)",
              color: "rgba(255, 255, 255, 0.7)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)";
              e.currentTarget.style.color = "rgba(255, 255, 255, 0.95)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
              e.currentTarget.style.color = "rgba(255, 255, 255, 0.7)";
            }}
            title={`${label} view`}
          >
            <svg
              className={isPreviewExpanded && !isMobile ? "w-4 h-4" : "w-3.5 h-3.5"}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={icon}
              />
            </svg>
            {isPreviewExpanded && !isMobile && (
              <span className="text-xs font-medium">{label}</span>
            )}
          </button>
        ))}
      </div>
      {/* Layer controls - only show when multiple layers */}
      {layout.layers.length > 1 && (
        <div
          className={`absolute bottom-1 right-1 flex ${
            isPreviewExpanded && !isMobile ? "gap-1 p-1 rounded-lg" : "gap-0.5"
          }`}
          style={isPreviewExpanded && !isMobile ? {
            background: "rgba(0, 0, 0, 0.2)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
          } : {}}
        >
          {/* Dim inactive layers toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              toggleDimInactiveLayers()
            }}
            className={`group flex items-center rounded font-medium transition-all duration-200 hover:scale-105 ${
              isPreviewExpanded && !isMobile ? "gap-2 px-3 py-2" : "w-9 h-9 justify-center"
            }`}
            style={{
              background: dimInactiveLayers
                ? "#f59e0b"
                : "rgba(255, 255, 255, 0.1)",
              border: dimInactiveLayers
                ? "1px solid #f59e0b"
                : "1px solid rgba(255, 255, 255, 0.2)",
              backdropFilter: "blur(8px)",
              color: dimInactiveLayers ? "white" : "rgba(255, 255, 255, 0.7)",
              boxShadow: dimInactiveLayers ? "0 0 12px rgba(245, 158, 11, 0.4)" : "none",
            }}
            onMouseEnter={(e) => {
              if (!dimInactiveLayers) {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)";
                e.currentTarget.style.color = "rgba(255, 255, 255, 0.95)";
              }
            }}
            onMouseLeave={(e) => {
              if (!dimInactiveLayers) {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
                e.currentTarget.style.color = "rgba(255, 255, 255, 0.7)";
              }
            }}
            title={
              dimInactiveLayers
                ? "Dim inactive layers (on)"
                : "Dim inactive layers (off)"
            }
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
                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
            {isPreviewExpanded && !isMobile && (
              <span className="text-xs">Dim Layers</span>
            )}
            {!isPreviewExpanded && (
              <span className="absolute right-full mr-2 px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" style={{
                background: "rgba(0, 0, 0, 0.9)",
                color: "white",
              }}>
                Dim Layers
              </span>
            )}
          </button>
          {/* Slice view toggle - hide layers above active */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              toggleHideLayersAbove()
            }}
            className={`group flex items-center rounded font-medium transition-all duration-200 hover:scale-105 ${
              isPreviewExpanded && !isMobile ? "gap-2 px-3 py-2" : "w-9 h-9 justify-center"
            }`}
            style={{
              background: hideLayersAbove
                ? "#f59e0b"
                : "rgba(255, 255, 255, 0.1)",
              border: hideLayersAbove
                ? "1px solid #f59e0b"
                : "1px solid rgba(255, 255, 255, 0.2)",
              backdropFilter: "blur(8px)",
              color: hideLayersAbove ? "white" : "rgba(255, 255, 255, 0.7)",
              boxShadow: hideLayersAbove ? "0 0 12px rgba(245, 158, 11, 0.4)" : "none",
            }}
            onMouseEnter={(e) => {
              if (!hideLayersAbove) {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)";
                e.currentTarget.style.color = "rgba(255, 255, 255, 0.95)";
              }
            }}
            onMouseLeave={(e) => {
              if (!hideLayersAbove) {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
                e.currentTarget.style.color = "rgba(255, 255, 255, 0.7)";
              }
            }}
            title={hideLayersAbove ? "Slice view (on)" : "Slice view (off)"}
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
                d="M4 5h16M4 12h16m-7 7h7"
              />
            </svg>
            {isPreviewExpanded && !isMobile && (
              <span className="text-xs">Slice View</span>
            )}
            {!isPreviewExpanded && (
              <span className="absolute right-full mr-2 px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" style={{
                background: "rgba(0, 0, 0, 0.9)",
                color: "white",
              }}>
                Slice View
              </span>
            )}
          </button>
        </div>
      )}
      {/* Top button row */}
      <div
        className={`absolute top-1 right-1 flex ${
          isPreviewExpanded && !isMobile ? "gap-1 p-1 rounded-lg" : "gap-1"
        }`}
        style={isPreviewExpanded && !isMobile ? {
          background: "rgba(0, 0, 0, 0.2)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
        } : {}}
      >
        {/* Expand/Collapse button */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            togglePreviewExpanded()
          }}
          className={`group flex items-center rounded transition-all duration-200 hover:scale-105 ${
            isPreviewExpanded && !isMobile ? "gap-2 px-3 py-2" : "w-9 h-9 justify-center"
          }`}
          style={{
            background: "rgba(255, 255, 255, 0.1)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            backdropFilter: "blur(8px)",
            color: "rgba(255, 255, 255, 0.7)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)";
            e.currentTarget.style.color = "rgba(255, 255, 255, 0.95)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
            e.currentTarget.style.color = "rgba(255, 255, 255, 0.7)";
          }}
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
            <>
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
              <span className="absolute right-full mr-2 px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" style={{
                background: "rgba(0, 0, 0, 0.9)",
                color: "white",
              }}>
                Expand
              </span>
            </>
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
          className={`group flex items-center rounded transition-all duration-200 hover:scale-105 ${
            isPreviewExpanded && !isMobile ? "gap-2 px-3 py-2" : "w-9 h-9 justify-center"
          }`}
          style={{
            background: "rgba(255, 255, 255, 0.1)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            backdropFilter: "blur(8px)",
            color: "rgba(255, 255, 255, 0.7)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)";
            e.currentTarget.style.color = "rgba(255, 255, 255, 0.95)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
            e.currentTarget.style.color = "rgba(255, 255, 255, 0.7)";
          }}
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
          {!isPreviewExpanded && (
            <span className="absolute right-full mr-2 px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" style={{
              background: "rgba(0, 0, 0, 0.9)",
              color: "white",
            }}>
              Close
            </span>
          )}
        </button>
      </div>

      {/* Keyboard shortcuts indicator - only shown in expanded mode on desktop */}
      {isPreviewExpanded && !isMobile && (
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
