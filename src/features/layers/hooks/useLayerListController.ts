/**
 * Layer-list state and actions shared by the desktop LayerPanel and the
 * mobile LayersTab: add, delete with active-layer reassignment, rename,
 * new-bin height stepping, display-order reordering, and the tallest stack
 * measured against the drawer.
 *
 * A layer's height is only the default for bins drawn on it. Bins rest on
 * whatever is below them, so the drawer limit applies to stacks, not to a
 * sum of layer heights.
 *
 * Display order is REVERSED from array order (layers[0] is the bottom layer,
 * display index 0 is the top) — `reorderByDisplayIndex` owns that mapping so
 * neither surface re-implements it. Reorder errors surface through
 * `onReorderError` when provided (mobile shows an inline banner); otherwise
 * through the shared error toast.
 */

import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store';
import { useSelectionStore } from '@/core/store/selection';
import { useMutations } from '@/shared/contexts';
import { CONSTRAINTS } from '@/core/constants';
import { getLayerBins } from '@/shared/utils';
import { getDisplayLayers } from '@/shared/utils/collision';
import { isOk, isErr, getUserMessage } from '@/core/result';
import { useResultToast } from '@/shared/hooks';
import { useRestingStack } from '@/shared/hooks/useRestingStack';
import type { HeightUnits, Layer, LayerId } from '@/core/types';
import { batch } from '@/core/cqrs';

export interface LayerListController {
  layers: Layer[];
  displayLayers: Layer[];
  activeLayerId: LayerId;
  activeLayer: Layer | undefined;
  setActiveLayer: (id: LayerId) => void;
  /** Highest point any stack reaches, clearance included, in height units. */
  tallestStack: number;
  drawerHeight: number;
  canAddLayer: boolean;
  addNewLayer: () => void;
  deleteLayerId: LayerId | null;
  layerToDelete: Layer | null;
  deletedLayerBinCount: number;
  /** Opens the delete confirm; no-op at the minimum layer count. */
  requestDelete: (id: LayerId) => void;
  confirmDelete: () => void;
  cancelDelete: () => void;
  renameLayer: (id: LayerId, name: string) => void;
  changeLayerHeight: (id: LayerId, delta: number) => void;
  reorderByDisplayIndex: (fromDisplayIndex: number, toDisplayIndex: number) => void;
}

export function useLayerListController(options?: {
  onReorderError?: (message: string) => void;
}): LayerListController {
  const onReorderError = options?.onReorderError;
  const [deleteLayerId, setDeleteLayerId] = useState<LayerId | null>(null);

  const layout = useLayoutStore((state) => state.layout);
  const { addLayer, updateLayer, deleteLayer, reorderLayers } = useMutations();

  const { activeLayerId, setActiveLayer } = useSelectionStore(
    useShallow((state) => ({
      activeLayerId: state.activeLayerId,
      setActiveLayer: state.setActiveLayer,
    }))
  );

  const { showErrorToast } = useResultToast();

  const layers = layout.layers;
  const activeLayer = layers.find((l) => l.id === activeLayerId);
  const drawerHeight = layout.drawer.height;
  const tallestStack = useRestingStack(layout.bins, layers).tallest;
  const canAddLayer = layers.length < CONSTRAINTS.LAYERS_MAX;

  const displayToArrayIndex = (displayIndex: number) => layers.length - 1 - displayIndex;
  const displayLayers = getDisplayLayers(layers);

  const addNewLayer = () => {
    batch(() => {
      const result = addLayer();
      if (isOk(result)) {
        setActiveLayer(result.value);
      } else {
        showErrorToast(result.error);
      }
    });
  };

  const requestDelete = (id: LayerId) => {
    if (layers.length <= CONSTRAINTS.LAYERS_MIN) return;
    setDeleteLayerId(id);
  };

  const confirmDelete = () => {
    if (!deleteLayerId) return;
    batch(() => {
      const result = deleteLayer(deleteLayerId);
      if (isOk(result) && activeLayerId === deleteLayerId && layers.length > 0) {
        const remaining = layers.filter((l) => l.id !== deleteLayerId);
        if (remaining.length > 0) {
          setActiveLayer(remaining[0].id);
        }
      }
    });
    setDeleteLayerId(null);
  };

  const cancelDelete = () => {
    setDeleteLayerId(null);
  };

  const renameLayer = (id: LayerId, name: string) => {
    batch(() => {
      const result = updateLayer(id, {
        name: name.slice(0, CONSTRAINTS.LABEL_MAX_LENGTH),
      });
      if (isErr(result)) {
        showErrorToast(result.error);
      }
    });
  };

  const changeLayerHeight = (id: LayerId, delta: number) => {
    const layer = layers.find((l) => l.id === id);
    if (!layer) return;
    const newHeight = Math.max(CONSTRAINTS.MIN_LAYER_HEIGHT, layer.height + delta);
    batch(() => {
      const result = updateLayer(id, { height: newHeight as HeightUnits });
      if (isErr(result)) {
        showErrorToast(result.error);
      }
    });
  };

  const reorderByDisplayIndex = (fromDisplayIndex: number, toDisplayIndex: number) => {
    if (toDisplayIndex < 0 || toDisplayIndex >= layers.length) return;
    const fromArrayIndex = displayToArrayIndex(fromDisplayIndex);
    const toArrayIndex = displayToArrayIndex(toDisplayIndex);
    batch(() => {
      const result = reorderLayers(fromArrayIndex, toArrayIndex);
      if (isErr(result)) {
        if (onReorderError) {
          onReorderError(getUserMessage(result.error));
        } else {
          showErrorToast(result.error);
        }
      }
    });
  };

  const layerToDelete = deleteLayerId ? (layers.find((l) => l.id === deleteLayerId) ?? null) : null;
  const deletedLayerBinCount = deleteLayerId ? getLayerBins(layout.bins, deleteLayerId).length : 0;

  return {
    layers,
    displayLayers,
    activeLayerId,
    activeLayer,
    setActiveLayer,
    tallestStack,
    drawerHeight,
    canAddLayer,
    addNewLayer,
    deleteLayerId,
    layerToDelete,
    deletedLayerBinCount,
    requestDelete,
    confirmDelete,
    cancelDelete,
    renameLayer,
    changeLayerHeight,
    reorderByDisplayIndex,
  };
}
