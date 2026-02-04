/**
 * Hook for managing the cutout template library.
 *
 * Provides:
 * - Templates list with loading state
 * - CRUD operations for templates
 * - Error handling
 * - Automatic refresh after mutations
 */

import { useState, useEffect, useCallback } from 'react';
import {
  saveCutoutTemplate,
  loadCutoutTemplates,
  deleteCutoutTemplate,
  updateCutoutTemplate,
  generateUniqueName,
  type CutoutTemplateUpdate,
} from '../storage';
import type { CutoutTemplate, TracedContour } from '../types';

export interface UseCutoutLibraryReturn {
  /** List of all cutout templates */
  templates: CutoutTemplate[];
  /** Whether templates are being loaded */
  isLoading: boolean;
  /** Error message if an operation failed */
  error: string | null;
  /** Save a new template to the library */
  saveTemplate: (
    name: string,
    contour: TracedContour,
    originalImage: string | null,
    widthMm: number,
    heightMm: number,
    category?: string
  ) => Promise<void>;
  /** Delete a template by ID */
  deleteTemplate: (id: string) => Promise<void>;
  /** Update an existing template */
  updateTemplate: (id: string, updates: CutoutTemplateUpdate) => Promise<void>;
  /** Clear the current error */
  clearError: () => void;
  /** Manually refresh the templates list */
  refresh: () => Promise<void>;
}

/**
 * Hook for managing the cutout template library.
 *
 * Automatically loads templates on mount and refreshes after mutations.
 *
 * @example
 * ```tsx
 * const { templates, saveTemplate, deleteTemplate, isLoading } = useCutoutLibrary();
 *
 * // Save a new template
 * await saveTemplate('My Wrench', contour, imageUrl, 150, 40);
 *
 * // Delete a template
 * await deleteTemplate(templateId);
 * ```
 */
export function useCutoutLibrary(): UseCutoutLibraryReturn {
  const [templates, setTemplates] = useState<CutoutTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const loaded = await loadCutoutTemplates();
      setTemplates(loaded);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load templates';
      setError(message);
    }
  }, []);

  // Load templates on mount
  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      await refresh();
      setIsLoading(false);
    };
    void load();
  }, [refresh]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const saveTemplate = useCallback(
    async (
      name: string,
      contour: TracedContour,
      originalImage: string | null,
      widthMm: number,
      heightMm: number,
      category?: string
    ) => {
      try {
        // Generate unique name to avoid duplicates
        const uniqueName = await generateUniqueName(name);

        const result = await saveCutoutTemplate({
          name: uniqueName,
          contour,
          thumbnail: null, // Thumbnail should be generated separately
          originalImage,
          widthMm,
          heightMm,
          category,
        });

        if (!result.ok) {
          setError(result.error.message);
          return;
        }

        // Refresh the list
        await refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to save template';
        setError(message);
      }
    },
    [refresh]
  );

  const deleteTemplateById = useCallback(
    async (id: string) => {
      try {
        await deleteCutoutTemplate(id);
        await refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete template';
        setError(message);
      }
    },
    [refresh]
  );

  const updateTemplateById = useCallback(
    async (id: string, updates: CutoutTemplateUpdate) => {
      try {
        const result = await updateCutoutTemplate(id, updates);

        if (!result.ok) {
          setError(result.error.message);
          return;
        }

        await refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update template';
        setError(message);
      }
    },
    [refresh]
  );

  return {
    templates,
    isLoading,
    error,
    saveTemplate,
    deleteTemplate: deleteTemplateById,
    updateTemplate: updateTemplateById,
    clearError,
    refresh,
  };
}
