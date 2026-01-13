import { useState, useCallback, useMemo } from 'react';

/**
 * Simplified bin for sandbox use.
 */
export interface SandboxBin {
  id: string;
  x: number;
  y: number;
  width: number;
  depth: number;
  category: string;
  label?: string;
}

/**
 * Interaction types for sandbox.
 */
export type SandboxInteraction =
  | { type: 'draw'; startX: number; startY: number; currentX: number; currentY: number }
  | { type: 'drag'; binId: string; startX: number; startY: number; deltaX: number; deltaY: number }
  | { type: 'resize'; binId: string; handle: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'; startRect: { x: number; y: number; width: number; depth: number } }
  | null;

/**
 * Sandbox category configuration.
 */
export interface SandboxCategory {
  id: string;
  name: string;
  color: string;
}

/**
 * Configuration for sandbox state.
 */
interface SandboxConfig {
  width: number;
  depth: number;
  initialBins?: SandboxBin[];
  categories?: SandboxCategory[];
}

/**
 * Default categories for sandbox.
 */
export const DEFAULT_SANDBOX_CATEGORIES: SandboxCategory[] = [
  { id: 'general', name: 'General', color: '#6366f1' },
  { id: 'tools', name: 'Tools', color: '#10b981' },
  { id: 'hardware', name: 'Hardware', color: '#f59e0b' },
];

let nextBinId = 1;

/**
 * Generate a unique ID for sandbox bins.
 */
function generateId(): string {
  return `sandbox-bin-${nextBinId++}`;
}

/**
 * Local state hook for the guide sandbox.
 * Provides isolated bin management without global store.
 */
export function useSandboxState(config: SandboxConfig) {
  const { width, depth, initialBins = [], categories = DEFAULT_SANDBOX_CATEGORIES } = config;

  // Core state
  const [bins, setBins] = useState<SandboxBin[]>(() =>
    initialBins.map((bin) => ({ ...bin, id: bin.id || generateId() }))
  );
  const [selectedBinId, setSelectedBinId] = useState<string | null>(null);
  const [interaction, setInteraction] = useState<SandboxInteraction>(null);
  const [activeCategory, setActiveCategory] = useState<string>(categories[0]?.id || 'general');

  // Get selected bin
  const selectedBin = useMemo(
    () => (selectedBinId ? bins.find((b) => b.id === selectedBinId) : null),
    [bins, selectedBinId]
  );

  // Collision detection
  const checkCollision = useCallback(
    (rect: { x: number; y: number; width: number; depth: number }, excludeId?: string): boolean => {
      for (const bin of bins) {
        if (bin.id === excludeId) continue;
        // Check AABB overlap
        if (
          rect.x < bin.x + bin.width &&
          rect.x + rect.width > bin.x &&
          rect.y < bin.y + bin.depth &&
          rect.y + rect.depth > bin.y
        ) {
          return true;
        }
      }
      return false;
    },
    [bins]
  );

  // Bounds checking
  const isInBounds = useCallback(
    (rect: { x: number; y: number; width: number; depth: number }): boolean => {
      return rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= width && rect.y + rect.depth <= depth;
    },
    [width, depth]
  );

  // Add a new bin
  const addBin = useCallback(
    (binData: Omit<SandboxBin, 'id'>): string | null => {
      const rect = { x: binData.x, y: binData.y, width: binData.width, depth: binData.depth };
      if (!isInBounds(rect) || checkCollision(rect)) {
        return null;
      }
      const id = generateId();
      const newBin: SandboxBin = { ...binData, id };
      setBins((prev) => [...prev, newBin]);
      return id;
    },
    [isInBounds, checkCollision]
  );

  // Update an existing bin
  const updateBin = useCallback(
    (binId: string, updates: Partial<Omit<SandboxBin, 'id'>>): boolean => {
      const bin = bins.find((b) => b.id === binId);
      if (!bin) return false;

      const updated = { ...bin, ...updates };
      const rect = { x: updated.x, y: updated.y, width: updated.width, depth: updated.depth };

      if (!isInBounds(rect) || checkCollision(rect, binId)) {
        return false;
      }

      setBins((prev) => prev.map((b) => (b.id === binId ? updated : b)));
      return true;
    },
    [bins, isInBounds, checkCollision]
  );

  // Delete a bin
  const deleteBin = useCallback(
    (binId: string): void => {
      setBins((prev) => prev.filter((b) => b.id !== binId));
      if (selectedBinId === binId) {
        setSelectedBinId(null);
      }
    },
    [selectedBinId]
  );

  // Select a bin (or deselect if null)
  const selectBin = useCallback((binId: string | null): void => {
    setSelectedBinId(binId);
  }, []);

  // Clear selection
  const clearSelection = useCallback((): void => {
    setSelectedBinId(null);
  }, []);

  // Reset bins to initial state
  const resetBins = useCallback((): void => {
    setBins(initialBins.map((bin) => ({ ...bin, id: bin.id || generateId() })));
    setSelectedBinId(null);
    setInteraction(null);
  }, [initialBins]);

  // Validate if a placement would be valid (for UI feedback)
  const canPlaceBin = useCallback(
    (rect: { x: number; y: number; width: number; depth: number }, excludeId?: string): boolean => {
      return isInBounds(rect) && !checkCollision(rect, excludeId);
    },
    [isInBounds, checkCollision]
  );

  return {
    // State
    bins,
    selectedBinId,
    selectedBin,
    interaction,
    categories,
    activeCategory,
    drawerSize: { width, depth },

    // Actions
    addBin,
    updateBin,
    deleteBin,
    selectBin,
    clearSelection,
    setActiveCategory,
    setInteraction,
    resetBins,

    // Validation
    canPlaceBin,
    checkCollision,
    isInBounds,
  };
}

export type SandboxState = ReturnType<typeof useSandboxState>;
