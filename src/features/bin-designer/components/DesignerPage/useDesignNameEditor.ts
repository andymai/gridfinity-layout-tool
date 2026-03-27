/**
 * Hook managing inline design-name editing state and persistence.
 *
 * Handles click-to-edit, keyboard shortcuts (Enter/Escape), long-press for mobile,
 * initial save (when naming an unsaved design), and rename persistence for existing designs.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { useToastStore } from '@/core/store/toast';
import { useLayoutStore } from '@/core/store/layout';
import { isOk } from '@/core/result';
import {
  saveDesign,
  setActiveDesignId,
  updateDesignName,
} from '@/features/bin-designer/storage/DesignerStorage';
import { captureThumbnail } from '@/features/bin-designer/utils/thumbnail';
import { upsertRegistryEntry } from '@/features/bin-designer/store/customBinRegistry';
import { binId, designId } from '@/core/types';
import { useTranslation } from '@/i18n';
import type { RefObject } from 'react';

export interface DesignNameEditor {
  isEditingName: boolean;
  editNameValue: string;
  nameInputRef: RefObject<HTMLInputElement | null>;
  setEditNameValue: (value: string) => void;
  handleNameClick: () => void;
  handleNameSubmit: () => void;
  handleNameKeyDown: (e: React.KeyboardEvent) => void;
  handleNameTouchStart: () => void;
  handleNameTouchEnd: () => void;
  startEditing: () => void;
}

export function useDesignNameEditor(): DesignNameEditor {
  const designName = useDesignerStore((s) => s.designName);
  const setDesignName = useDesignerStore((s) => s.setDesignName);
  const currentDesignId = useDesignerStore((s) => s.currentDesignId);
  const setCurrentDesignId = useDesignerStore((s) => s.setCurrentDesignId);
  const setSaveStatus = useDesignerStore((s) => s.setSaveStatus);
  const params = useDesignerStore((s) => s.params);
  const exportFileNameConfig = useDesignerStore((s) => s.exportFileNameConfig);
  const pendingBinLink = useDesignerStore((s) => s.pendingBinLink);
  const clearPendingBinLink = useDesignerStore((s) => s.clearPendingBinLink);
  const updateBin = useLayoutStore((s) => s.updateBin);
  const addToast = useToastStore((s) => s.addToast);
  const t = useTranslation();

  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState(designName);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  const handleNameClick = useCallback(() => {
    setEditNameValue(designName);
    setIsEditingName(true);
  }, [designName]);

  const startEditing = useCallback(() => {
    setEditNameValue(designName);
    setIsEditingName(true);
  }, [designName]);

  const handleNameSubmit = useCallback(() => {
    const name = editNameValue.trim() || 'Untitled Bin';
    setDesignName(name);
    setIsEditingName(false);

    // Persist rename for existing designs
    if (currentDesignId) {
      void updateDesignName(designId(currentDesignId), name).then((result) => {
        if (isOk(result)) {
          upsertRegistryEntry({
            id: result.value.id,
            name: result.value.name,
            width: params.width,
            depth: params.depth,
            height: params.height,
            updatedAt: result.value.updatedAt,
          });
        }
      });
      return;
    }

    // First save: when user names an unsaved design, persist it
    if (!currentDesignId) {
      setSaveStatus('saving');
      const thumbnail = captureThumbnail();
      void saveDesign({ name, params, thumbnail, exportFileNameConfig }).then((result) => {
        if (isOk(result)) {
          setCurrentDesignId(result.value.id);
          setActiveDesignId(result.value.id);
          setSaveStatus('saved');
          upsertRegistryEntry({
            id: result.value.id,
            name: result.value.name,
            width: params.width,
            depth: params.depth,
            height: params.height,
            updatedAt: result.value.updatedAt,
          });

          // Auto-link design to source bin if this was created from a bin
          if (pendingBinLink) {
            const linkResult = updateBin(binId(pendingBinLink), {
              linkedDesignId: result.value.id,
            });
            clearPendingBinLink();
            if (isOk(linkResult)) {
              addToast({
                message: t('binDesigner.designCreatedAndLinked'),
                type: 'success',
                duration: 4000,
              });
            }
          }
        } else {
          setSaveStatus('error');
        }
      });
    }
  }, [
    editNameValue,
    setDesignName,
    currentDesignId,
    params,
    exportFileNameConfig,
    setCurrentDesignId,
    setSaveStatus,
    pendingBinLink,
    updateBin,
    clearPendingBinLink,
    addToast,
    t,
  ]);

  const handleNameKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleNameSubmit();
      } else if (e.key === 'Escape') {
        setEditNameValue(designName);
        setIsEditingName(false);
      }
    },
    [handleNameSubmit, designName]
  );

  // Long-press handler for mobile name editing
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleNameTouchStart = useCallback(() => {
    longPressTimerRef.current = setTimeout(() => {
      setEditNameValue(designName);
      setIsEditingName(true);
    }, 500);
  }, [designName]);
  const handleNameTouchEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  return {
    isEditingName,
    editNameValue,
    nameInputRef,
    setEditNameValue,
    handleNameClick,
    handleNameSubmit,
    handleNameKeyDown,
    handleNameTouchStart,
    handleNameTouchEnd,
    startEditing,
  };
}
