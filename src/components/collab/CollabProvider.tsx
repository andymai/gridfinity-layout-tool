/**
 * Collaborative editing provider component.
 *
 * Wraps children with Liveblocks RoomProvider when in collaborative mode.
 * Handles user identification, initial presence, and storage setup.
 */

import type { ReactNode } from 'react';
import { useMemo, useCallback, useRef, useEffect } from 'react';
import {
  RoomProvider,
  useUpdateMyPresence,
  useMutation,
  useStorage,
  useStatus,
  isLiveblocksConfigured,
  type LiveblocksStorage,
  type UserPresence,
  type InteractionHint,
} from '../../liveblocks.config';
import { useLibraryStore } from '../../store/library';
import { useLayoutStore } from '../../store/layout';
import { useSettingsStore } from '../../store/settings';
import { useUIStore } from '../../store/ui';
import { generateId, STAGING_ID, CONSTRAINTS } from '../../constants';
import { generateGuestName, generateGuestColor } from '../../utils/guestNames';
import { PresenceContext, type CollabPresenceActions } from '../../contexts/PresenceContext';
import { MutationsContext, type Mutations, LocalMutationsProvider } from '../../context/MutationsContext';
import type { Coord, Layout, Bin, Layer, Category, Drawer } from '../../types';
import type { Result, ValidationError, LayoutError } from '../../result';
import {
  ok,
  err,
  OK,
  validationOutOfBounds,
  validationCollision,
  validationInvalidLayer,
  layoutLayerLimit,
  layoutLastEntity,
  layoutInvalidOperation,
  layoutCategoryLimit,
} from '../../result';
import { canPlaceBin, clamp } from '../../utils/validation';
import { throttle } from '../../utils/throttle';
import { useCollabSync } from '../../hooks/useCollabSync';
import { useCloudShareAutoSync } from '../../hooks/useCloudShareAutoSync';

interface CollabProviderProps {
  /** The share ID for the collaborative session */
  shareId: string;
  /** Child components to render inside the provider */
  children: ReactNode;
}

/**
 * Get or create a stable user ID from localStorage.
 * This acts as a browser fingerprint for owner identification.
 */
function getUserId(): string {
  const key = 'gridfinity-user-id';
  try {
    let userId = localStorage.getItem(key);
    if (!userId) {
      userId = generateId();
      localStorage.setItem(key, userId);
    }
    return userId;
  } catch {
    // Fallback for private browsing or storage quota errors
    // Generate a temporary ID for this session
    return generateId();
  }
}

/**
 * Get the user's display name from library settings.
 * Falls back to a fun generated name if no author name is set.
 */
function useUserName(userId: string): string {
  const authorName = useLibraryStore((state) => state.library.settings.authorName);
  return authorName || generateGuestName(userId);
}

/**
 * CollabProvider wraps the app with Liveblocks RoomProvider
 * to enable real-time collaboration.
 *
 * If Liveblocks is not configured (no API key), falls back to
 * LocalMutationsProvider for local-only mode.
 *
 * @example
 * ```tsx
 * <CollabProvider shareId="abc123xyz">
 *   <App />
 * </CollabProvider>
 * ```
 */
export function CollabProvider({ shareId, children }: CollabProviderProps) {
  // If Liveblocks is not configured, fall back to local-only mode
  // This allows the app to function without collaborative features
  if (!isLiveblocksConfigured) {
    return <LocalMutationsProvider>{children}</LocalMutationsProvider>;
  }

  return <LiveblocksCollabProvider shareId={shareId}>{children}</LiveblocksCollabProvider>;
}

/**
 * Inner component that actually uses Liveblocks.
 * This is separated to avoid conditional hooks in the outer component.
 */
function LiveblocksCollabProvider({ shareId, children }: CollabProviderProps) {
  const roomId = `gridfinity-${shareId}`;
  const userId = useMemo(() => getUserId(), []);
  const userName = useUserName(userId);
  const layout = useLayoutStore((state) => state.layout);

  // Check if user is owner (layout exists in their library with matching ID)
  // Since share IDs equal layout UUIDs, we check entry.id directly
  const entries = useLibraryStore((state) => state.library.entries);
  const cloudShare = useMemo(
    () => entries.find((e) => e.id === shareId)?.cloudShare ?? null,
    [entries, shareId]
  );

  // Initial presence - cursor starts as null (outside grid)
  // Color is deterministically generated from userId for variety
  const initialPresence: UserPresence = useMemo(
    () => ({
      cursor: null,
      name: userName,
      color: generateGuestColor(userId),
      interaction: { type: 'idle' },
    }),
    [userName, userId]
  );

  // Initial storage - the layout data to sync
  // If user is owner, include deleteToken so any collaborator can sync to blob
  const initialStorage: LiveblocksStorage = useMemo(
    () => ({
      layout,
      metadata: {
        ownerId: userId,
        permission: cloudShare?.permission ?? 'edit',
        version: 1,
        // Owner shares the deleteToken so any collaborator can persist to blob
        deleteToken: cloudShare?.deleteToken,
      },
    }),
    // Only use layout on initial mount, not on every change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <RoomProvider
      id={roomId}
      initialPresence={initialPresence}
      initialStorage={initialStorage}
    >
      <PresenceProvider shareId={shareId}>{children}</PresenceProvider>
    </RoomProvider>
  );
}

/**
 * Inner component that provides presence actions and handles sync.
 * Must be inside RoomProvider to access Liveblocks hooks.
 */
function PresenceProvider({ shareId, children }: { shareId: string; children: ReactNode }) {
  const updateMyPresence = useUpdateMyPresence();

  // Enable bidirectional sync between Liveblocks and Zustand
  useCollabSync();

  // Auto-sync layout changes to cloud share storage (only owner has cloudShare info)
  useCloudShareAutoSync(shareId, true);

  // Auto-dismiss Liveblocks badge (injected asynchronously by Liveblocks SDK)
  useEffect(() => {
    const dismissBadge = () => {
      const hideButton = document.getElementById('liveblocks-badge-hide-button');
      if (hideButton) {
        hideButton.click();
        return true;
      }
      return false;
    };

    // Try immediately, then poll briefly in case badge loads async
    if (!dismissBadge()) {
      const interval = setInterval(() => {
        if (dismissBadge()) {
          clearInterval(interval);
        }
      }, 100);

      // Stop polling after 3 seconds
      const timeout = setTimeout(() => clearInterval(interval), 3000);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, []);

  // Create throttled cursor update (50ms = 20fps)
  const throttledUpdateCursorRef = useRef<((cursor: Coord | null) => void) | null>(null);

  useEffect(() => {
    throttledUpdateCursorRef.current = throttle((cursor: Coord | null) => {
      updateMyPresence({ cursor });
    }, 50);

    return () => {
      throttledUpdateCursorRef.current = null;
    };
  }, [updateMyPresence]);

  // Create throttled selection update (100ms = 10fps, less frequent than cursor)
  const throttledUpdateSelectionRef = useRef<((binIds: string[]) => void) | null>(null);

  useEffect(() => {
    throttledUpdateSelectionRef.current = throttle((binIds: string[]) => {
      updateMyPresence({ selectedBinIds: binIds });
    }, 100);

    return () => {
      throttledUpdateSelectionRef.current = null;
    };
  }, [updateMyPresence]);

  // Auto-broadcast selection changes from UI store
  useEffect(() => {
    // Track previous selection to detect changes
    let prevSelection = useUIStore.getState().selectedBinIds;

    // Subscribe to entire state and filter for selection changes
    const unsubscribe = useUIStore.subscribe((state) => {
      const currentSelection = state.selectedBinIds;
      // Only update if selection actually changed
      if (
        currentSelection.length !== prevSelection.length ||
        currentSelection.some((id, i) => id !== prevSelection[i])
      ) {
        prevSelection = currentSelection;
        if (throttledUpdateSelectionRef.current) {
          throttledUpdateSelectionRef.current(currentSelection);
        }
      }
    });

    // Broadcast initial selection state
    if (throttledUpdateSelectionRef.current) {
      throttledUpdateSelectionRef.current(prevSelection);
    }

    return unsubscribe;
  }, []);

  const updateCursor = useCallback(
    (cursor: Coord | null) => {
      if (throttledUpdateCursorRef.current) {
        throttledUpdateCursorRef.current(cursor);
      }
    },
    []
  );

  const updateInteraction = useCallback(
    (interaction: InteractionHint) => {
      updateMyPresence({ interaction });
    },
    [updateMyPresence]
  );

  const updateSelection = useCallback(
    (binIds: string[]) => {
      if (throttledUpdateSelectionRef.current) {
        throttledUpdateSelectionRef.current(binIds);
      }
    },
    []
  );

  const clearPresence = useCallback(() => {
    updateMyPresence({
      cursor: null,
      interaction: { type: 'idle' },
      selectedBinIds: [],
    });
  }, [updateMyPresence]);

  const presenceActions: CollabPresenceActions = useMemo(
    () => ({
      updateCursor,
      updateInteraction,
      updateSelection,
      clearPresence,
    }),
    [updateCursor, updateInteraction, updateSelection, clearPresence]
  );

  return (
    <PresenceContext.Provider value={presenceActions}>
      <CollabMutationsProvider>{children}</CollabMutationsProvider>
    </PresenceContext.Provider>
  );
}

/**
 * Provider for collaborative mutations.
 * Uses Liveblocks useMutation hook to sync changes in real-time.
 * Falls back to local mutations when connection fails.
 */
function CollabMutationsProvider({ children }: { children: ReactNode }) {
  const store = useLayoutStore();
  const status = useStatus();
  const remoteLayout = useStorage((root) => root?.layout) as Layout | null;

  // Check if Liveblocks connection is ready
  // Storage must be loaded for mutations to work
  const isConnected = status === 'connected' && remoteLayout !== null;

  // Liveblocks mutation for updating layout
  const updateLiveblocksLayout = useMutation(
    ({ storage }, updater: (layout: Layout) => Layout) => {
      const currentLayout = storage.get('layout') as Layout;
      const newLayout = updater(currentLayout);
      storage.set('layout', newLayout);
    },
    []
  );

  // Helper to get current layout
  // Use remote in collab mode when connected, otherwise local
  const getLayout = useCallback((): Layout => {
    if (isConnected && remoteLayout) {
      return remoteLayout;
    }
    return store.layout;
  }, [isConnected, remoteLayout, store.layout]);

  // Helper to execute mutation - falls back to local store when not connected
  const executeMutation = useCallback(
    (localAction: () => void, remoteAction: () => void) => {
      if (isConnected) {
        try {
          remoteAction();
        } catch (error) {
          // If Liveblocks throws (e.g., storage not loaded), fall back to local
          if (import.meta.env.DEV) {
            console.warn('[CollabProvider] Liveblocks mutation failed, falling back to local:', error);
          }
          localAction();
        }
      } else {
        // Fall back to local mutations when not connected
        localAction();
      }
    },
    [isConnected]
  );

  // ====== BIN OPERATIONS ======

  const addBin = useCallback(
    (binData: Omit<Bin, 'id'>): Result<string, ValidationError> => {
      const layout = getLayout();
      const id = generateId();
      const bin: Bin = { ...binData, id };

      // Validate placement (skip for staging)
      if (bin.layerId !== STAGING_ID) {
        const layer = layout.layers.find((l) => l.id === bin.layerId);
        if (!layer) {
          return err(validationInvalidLayer(bin.layerId));
        }

        const validationResult = canPlaceBin(
          { x: bin.x, y: bin.y, width: bin.width, depth: bin.depth, height: bin.height },
          bin.layerId,
          layout
        );
        if (!validationResult.valid) {
          const reason = validationResult.reason ?? 'out_of_bounds';
          if (reason === 'collision') {
            return err(validationCollision());
          }
          return err(validationOutOfBounds(reason, {
            x: bin.x,
            y: bin.y,
            width: bin.width,
            depth: bin.depth,
          }));
        }
      }

      executeMutation(
        () => store.addBin(binData),
        () => updateLiveblocksLayout((currentLayout) => ({
          ...currentLayout,
          bins: [...currentLayout.bins, bin],
        }))
      );

      return ok(id);
    },
    [getLayout, executeMutation, store, updateLiveblocksLayout]
  );

  const updateBin = useCallback(
    (id: string, updates: Partial<Bin>): Result<void, LayoutError> => {
      const layout = getLayout();
      const bin = layout.bins.find((b) => b.id === id);
      if (!bin) {
        return err(layoutInvalidOperation('updateBin', `Bin ${id} not found`));
      }

      executeMutation(
        () => store.updateBin(id, updates),
        () => updateLiveblocksLayout((currentLayout) => ({
          ...currentLayout,
          bins: currentLayout.bins.map((b) =>
            b.id === id ? { ...b, ...updates } : b
          ),
        }))
      );

      return OK;
    },
    [getLayout, executeMutation, store, updateLiveblocksLayout]
  );

  const deleteBin = useCallback(
    (id: string): Result<void, LayoutError> => {
      const layout = getLayout();
      const bin = layout.bins.find((b) => b.id === id);
      if (!bin) {
        return err(layoutInvalidOperation('deleteBin', `Bin ${id} not found`));
      }

      executeMutation(
        () => store.deleteBin(id),
        () => updateLiveblocksLayout((currentLayout) => ({
          ...currentLayout,
          bins: currentLayout.bins.filter((b) => b.id !== id),
        }))
      );

      return OK;
    },
    [getLayout, executeMutation, store, updateLiveblocksLayout]
  );

  const deleteBins = useCallback(
    (ids: string[]): Result<void, LayoutError> => {
      executeMutation(
        () => ids.forEach((id) => store.deleteBin(id)),
        () => updateLiveblocksLayout((currentLayout) => ({
          ...currentLayout,
          bins: currentLayout.bins.filter((b) => !ids.includes(b.id)),
        }))
      );

      return OK;
    },
    [executeMutation, store, updateLiveblocksLayout]
  );

  const duplicateBin = useCallback(
    (id: string): Result<string, ValidationError | LayoutError> => {
      const layout = getLayout();
      const bin = layout.bins.find((b) => b.id === id);
      if (!bin) {
        return err(layoutInvalidOperation('duplicateBin', `Bin ${id} not found`));
      }

      // For staging bins, just create a copy in staging
      if (bin.layerId === STAGING_ID) {
        return addBin({
          layerId: STAGING_ID,
          x: 0,
          y: 0,
          width: bin.width,
          depth: bin.depth,
          height: bin.height,
          clearanceHeight: bin.clearanceHeight,
          category: bin.category,
          label: bin.label,
          notes: bin.notes,
          customProperties: bin.customProperties,
        });
      }

      // Try adjacent positions
      const offsets = [
        { dx: bin.width, dy: 0 },
        { dx: 0, dy: -bin.depth },
        { dx: -bin.width, dy: 0 },
        { dx: 0, dy: bin.depth },
      ];

      for (const { dx, dy } of offsets) {
        const newX = bin.x + dx;
        const newY = bin.y + dy;

        const result = canPlaceBin(
          { x: newX, y: newY, width: bin.width, depth: bin.depth, height: bin.height },
          bin.layerId,
          layout,
          id
        );

        if (result.valid) {
          return addBin({
            layerId: bin.layerId,
            x: newX,
            y: newY,
            width: bin.width,
            depth: bin.depth,
            height: bin.height,
            clearanceHeight: bin.clearanceHeight,
            category: bin.category,
            label: bin.label,
            notes: bin.notes,
            customProperties: bin.customProperties,
          });
        }
      }

      // Fallback to staging
      return addBin({
        layerId: STAGING_ID,
        x: 0,
        y: 0,
        width: bin.width,
        depth: bin.depth,
        height: bin.height,
        clearanceHeight: bin.clearanceHeight,
        category: bin.category,
        label: bin.label,
        notes: bin.notes,
        customProperties: bin.customProperties,
      });
    },
    [getLayout, addBin]
  );

  const moveBinToStaging = useCallback(
    (id: string): Result<void, LayoutError> => {
      const layout = getLayout();
      const bin = layout.bins.find((b) => b.id === id);
      if (!bin) {
        return err(layoutInvalidOperation('moveBinToStaging', `Bin ${id} not found`));
      }

      executeMutation(
        () => store.moveBinToStaging(id),
        () => updateLiveblocksLayout((currentLayout) => ({
          ...currentLayout,
          bins: currentLayout.bins.map((b) =>
            b.id === id ? { ...b, layerId: STAGING_ID } : b
          ),
        }))
      );

      return OK;
    },
    [getLayout, executeMutation, store, updateLiveblocksLayout]
  );

  const moveBinFromStaging = useCallback(
    (id: string, layerId: string, x: number, y: number): Result<void, ValidationError | LayoutError> => {
      const layout = getLayout();
      const bin = layout.bins.find((b) => b.id === id);
      if (!bin) {
        return err(layoutInvalidOperation('moveBinFromStaging', `Bin ${id} not found`));
      }

      const layer = layout.layers.find((l) => l.id === layerId);
      if (!layer) {
        return err(validationInvalidLayer(layerId));
      }

      const validationResult = canPlaceBin(
        { x, y, width: bin.width, depth: bin.depth, height: layer.height },
        layerId,
        layout,
        id
      );

      if (!validationResult.valid) {
        const reason = validationResult.reason ?? 'out_of_bounds';
        if (reason === 'collision') {
          return err(validationCollision());
        }
        return err(validationOutOfBounds(reason, { x, y, width: bin.width, depth: bin.depth }));
      }

      executeMutation(
        () => store.moveBinFromStaging(id, layerId, x, y),
        () => updateLiveblocksLayout((currentLayout) => ({
          ...currentLayout,
          bins: currentLayout.bins.map((b) =>
            b.id === id
              ? { ...b, layerId, x, y, height: layer.height }
              : b
          ),
        }))
      );

      return OK;
    },
    [getLayout, executeMutation, store, updateLiveblocksLayout]
  );

  // ====== LAYER OPERATIONS ======

  const addLayer = useCallback((): Result<string, LayoutError> => {
    const layout = getLayout();

    if (layout.layers.length >= CONSTRAINTS.LAYERS_MAX) {
      return err(layoutLayerLimit(layout.layers.length, CONSTRAINTS.LAYERS_MAX));
    }

    const totalHeight = layout.layers.reduce((sum, l) => sum + l.height, 0);
    const remaining = layout.drawer.height - totalHeight;
    if (remaining < 1) {
      return err(layoutInvalidOperation('addLayer', 'No remaining height in drawer'));
    }

    const defaultLayerHeight = useSettingsStore.getState().settings.defaultLayerHeight;
    const id = generateId();
    const newLayer: Layer = {
      id,
      name: `Layer ${layout.layers.length + 1}`,
      height: Math.min(remaining, defaultLayerHeight),
    };

    executeMutation(
      () => store.addLayer(),
      () => updateLiveblocksLayout((currentLayout) => ({
        ...currentLayout,
        layers: [...currentLayout.layers, newLayer],
      }))
    );

    return ok(id);
  }, [getLayout, executeMutation, store, updateLiveblocksLayout]);

  const updateLayer = useCallback(
    (id: string, updates: Partial<Layer>): Result<void, LayoutError> => {
      const layout = getLayout();
      const layer = layout.layers.find((l) => l.id === id);
      if (!layer) {
        return err(layoutInvalidOperation('updateLayer', `Layer ${id} not found`));
      }

      executeMutation(
        () => store.updateLayer(id, updates),
        () => updateLiveblocksLayout((currentLayout) => {
          const processedUpdates = { ...updates };

          // Clamp height if provided
          if (processedUpdates.height !== undefined) {
            const othersHeight = currentLayout.layers
              .filter((l) => l.id !== id)
              .reduce((sum, l) => sum + l.height, 0);
            const maxHeight = currentLayout.drawer.height - othersHeight;
            processedUpdates.height = clamp(processedUpdates.height, 1, maxHeight);
          }

          return {
            ...currentLayout,
            layers: currentLayout.layers.map((l) =>
              l.id === id ? { ...l, ...processedUpdates } : l
            ),
          };
        })
      );

      return OK;
    },
    [getLayout, executeMutation, store, updateLiveblocksLayout]
  );

  const deleteLayer = useCallback(
    (id: string): Result<void, LayoutError> => {
      const layout = getLayout();

      if (layout.layers.length <= CONSTRAINTS.LAYERS_MIN) {
        return err(layoutLastEntity('layer'));
      }

      const layer = layout.layers.find((l) => l.id === id);
      if (!layer) {
        return err(layoutInvalidOperation('deleteLayer', `Layer ${id} not found`));
      }

      executeMutation(
        () => store.deleteLayer(id),
        () => updateLiveblocksLayout((currentLayout) => ({
          ...currentLayout,
          layers: currentLayout.layers.filter((l) => l.id !== id),
          bins: currentLayout.bins.filter((b) => b.layerId !== id),
        }))
      );

      return OK;
    },
    [getLayout, executeMutation, store, updateLiveblocksLayout]
  );

  const reorderLayers = useCallback(
    (fromIndex: number, toIndex: number): Result<void, LayoutError> => {
      if (fromIndex === toIndex) return OK;

      const layout = getLayout();
      if (fromIndex < 0 || fromIndex >= layout.layers.length) {
        return err(layoutInvalidOperation('reorderLayers', 'Invalid source index'));
      }
      if (toIndex < 0 || toIndex >= layout.layers.length) {
        return err(layoutInvalidOperation('reorderLayers', 'Invalid target index'));
      }

      executeMutation(
        () => store.reorderLayers(fromIndex, toIndex),
        () => updateLiveblocksLayout((currentLayout) => {
          const newLayers = [...currentLayout.layers];
          const [moved] = newLayers.splice(fromIndex, 1);
          newLayers.splice(toIndex, 0, moved);
          return { ...currentLayout, layers: newLayers };
        })
      );

      return OK;
    },
    [getLayout, executeMutation, store, updateLiveblocksLayout]
  );

  // ====== DRAWER OPERATIONS ======

  const updateDrawer = useCallback(
    (updates: Partial<Drawer>): void => {
      executeMutation(
        () => store.updateDrawer(updates),
        () => updateLiveblocksLayout((currentLayout) => {
          const drawer = { ...currentLayout.drawer };

          if (updates.width !== undefined) {
            drawer.width = clamp(updates.width, CONSTRAINTS.GRID_MIN, CONSTRAINTS.GRID_MAX);
          }
          if (updates.depth !== undefined) {
            drawer.depth = clamp(updates.depth, CONSTRAINTS.GRID_MIN, CONSTRAINTS.GRID_MAX);
          }
          if (updates.height !== undefined) {
            const totalLayerHeight = currentLayout.layers.reduce((sum, l) => sum + l.height, 0);
            drawer.height = Math.max(totalLayerHeight, updates.height);
          }
          if (updates.fractionalEdgeX !== undefined) {
            drawer.fractionalEdgeX = updates.fractionalEdgeX;
          }
          if (updates.fractionalEdgeY !== undefined) {
            drawer.fractionalEdgeY = updates.fractionalEdgeY;
          }

          // Move out-of-bounds bins to staging
          const bins = currentLayout.bins.map((bin) => {
            if (bin.layerId === STAGING_ID) return bin;
            if (bin.x + bin.width > drawer.width || bin.y + bin.depth > drawer.depth) {
              return { ...bin, layerId: STAGING_ID };
            }
            return bin;
          });

          return { ...currentLayout, drawer, bins };
        })
      );
    },
    [executeMutation, store, updateLiveblocksLayout]
  );

  // ====== CATEGORY OPERATIONS ======

  const addCategory = useCallback(
    (categoryData: Omit<Category, 'id'>): Result<string, LayoutError> => {
      const layout = getLayout();

      if (layout.categories.length >= CONSTRAINTS.CATEGORIES_MAX) {
        return err(layoutCategoryLimit(layout.categories.length, CONSTRAINTS.CATEGORIES_MAX));
      }

      const id = generateId();

      executeMutation(
        () => store.addCategory(categoryData),
        () => updateLiveblocksLayout((currentLayout) => ({
          ...currentLayout,
          categories: [...currentLayout.categories, { ...categoryData, id }],
        }))
      );

      return ok(id);
    },
    [getLayout, executeMutation, store, updateLiveblocksLayout]
  );

  const updateCategory = useCallback(
    (id: string, updates: Partial<Category>): Result<void, LayoutError> => {
      const layout = getLayout();
      const category = layout.categories.find((c) => c.id === id);
      if (!category) {
        return err(layoutInvalidOperation('updateCategory', `Category ${id} not found`));
      }

      executeMutation(
        () => store.updateCategory(id, updates),
        () => updateLiveblocksLayout((currentLayout) => ({
          ...currentLayout,
          categories: currentLayout.categories.map((c) =>
            c.id === id ? { ...c, ...updates } : c
          ),
        }))
      );

      return OK;
    },
    [getLayout, executeMutation, store, updateLiveblocksLayout]
  );

  const deleteCategory = useCallback(
    (id: string): Result<void, LayoutError> => {
      const layout = getLayout();

      const binsUsingCategory = layout.bins.filter((b) => b.category === id);
      if (binsUsingCategory.length > 0) {
        return err(
          layoutInvalidOperation(
            'deleteCategory',
            `Category is in use by ${binsUsingCategory.length} bin${binsUsingCategory.length > 1 ? 's' : ''}`
          )
        );
      }

      if (layout.categories.length <= CONSTRAINTS.CATEGORIES_MIN) {
        return err(layoutLastEntity('category'));
      }

      const category = layout.categories.find((c) => c.id === id);
      if (!category) {
        return err(layoutInvalidOperation('deleteCategory', `Category ${id} not found`));
      }

      executeMutation(
        () => store.deleteCategory(id),
        () => updateLiveblocksLayout((currentLayout) => ({
          ...currentLayout,
          categories: currentLayout.categories.filter((c) => c.id !== id),
        }))
      );

      return OK;
    },
    [getLayout, executeMutation, store, updateLiveblocksLayout]
  );

  // ====== BULK OPERATIONS ======

  const fillLayer = useCallback(
    (layerId: string, width: number, depth: number, categoryId: string, halfBinMode = false): number => {
      // fillLayer always uses local store - it's already non-collaborative
      return store.fillLayer(layerId, width, depth, categoryId, halfBinMode);
    },
    [store]
  );

  const clearLayer = useCallback(
    (layerId: string): number => {
      const layout = getLayout();
      const count = layout.bins.filter((b) => b.layerId === layerId).length;

      executeMutation(
        () => store.clearLayer(layerId),
        () => updateLiveblocksLayout((currentLayout) => ({
          ...currentLayout,
          bins: currentLayout.bins.filter((b) => b.layerId !== layerId),
        }))
      );

      return count;
    },
    [getLayout, executeMutation, store, updateLiveblocksLayout]
  );

  // ====== LAYOUT METADATA ======

  const setName = useCallback(
    (name: string): void => {
      executeMutation(
        () => store.setName(name),
        () => updateLiveblocksLayout((currentLayout) => ({
          ...currentLayout,
          name: name.slice(0, CONSTRAINTS.NAME_MAX_LENGTH),
        }))
      );
    },
    [executeMutation, store, updateLiveblocksLayout]
  );

  const setPrintBedSize = useCallback(
    (size: number): void => {
      executeMutation(
        () => store.setPrintBedSize(size),
        () => updateLiveblocksLayout((currentLayout) => ({
          ...currentLayout,
          printBedSize: clamp(size, 42, 500),
        }))
      );
    },
    [executeMutation, store, updateLiveblocksLayout]
  );

  const setGridUnitMm = useCallback(
    (mm: number): void => {
      executeMutation(
        () => store.setGridUnitMm(mm),
        () => updateLiveblocksLayout((currentLayout) => ({
          ...currentLayout,
          gridUnitMm: clamp(mm, 1, 200),
        }))
      );
    },
    [executeMutation, store, updateLiveblocksLayout]
  );

  const setHeightUnitMm = useCallback(
    (mm: number): void => {
      executeMutation(
        () => store.setHeightUnitMm(mm),
        () => updateLiveblocksLayout((currentLayout) => ({
          ...currentLayout,
          heightUnitMm: clamp(mm, 1, 50),
        }))
      );
    },
    [executeMutation, store, updateLiveblocksLayout]
  );

  const mutations = useMemo<Mutations>(
    () => ({
      addBin,
      updateBin,
      deleteBin,
      deleteBins,
      duplicateBin,
      moveBinToStaging,
      moveBinFromStaging,
      addLayer,
      updateLayer,
      deleteLayer,
      reorderLayers,
      updateDrawer,
      addCategory,
      updateCategory,
      deleteCategory,
      fillLayer,
      clearLayer,
      setName,
      setPrintBedSize,
      setGridUnitMm,
      setHeightUnitMm,
    }),
    [
      addBin,
      updateBin,
      deleteBin,
      deleteBins,
      duplicateBin,
      moveBinToStaging,
      moveBinFromStaging,
      addLayer,
      updateLayer,
      deleteLayer,
      reorderLayers,
      updateDrawer,
      addCategory,
      updateCategory,
      deleteCategory,
      fillLayer,
      clearLayer,
      setName,
      setPrintBedSize,
      setGridUnitMm,
      setHeightUnitMm,
    ]
  );

  return (
    <MutationsContext.Provider value={mutations}>
      {children}
    </MutationsContext.Provider>
  );
}
