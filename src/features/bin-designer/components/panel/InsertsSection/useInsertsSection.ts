/**
 * Hook for the inserts (floor cutouts) section.
 *
 * Manages state and handlers for placing custom cutouts from the library
 * onto the bin floor.
 */

import { useCallback, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useTranslation } from '@/i18n';
import type { Insert, InsertShape, InsertContourPoint } from '../../../types';
import type { SectionMeta } from '../types';
import { GRIDFINITY } from '../../../constants';

/** Default cut depth for new inserts in mm */
const DEFAULT_CUT_DEPTH = 3;

/** Default clearance added around traced contours in mm */
const DEFAULT_CLEARANCE = 0.5;

export interface InsertLibraryItem {
  readonly id: string;
  readonly name: string;
  readonly thumbnail: string | null;
  readonly contour: readonly InsertContourPoint[];
  readonly boundingBox: {
    readonly width: number;
    readonly height: number;
  };
}

export function useInsertsSection() {
  const {
    inserts,
    width,
    depth,
    wallThickness,
    addInsert,
    removeInsert,
    updateInsert,
    clearInserts,
  } = useDesignerStore(
    useShallow((s) => ({
      inserts: s.params.inserts,
      width: s.params.width,
      depth: s.params.depth,
      wallThickness: s.params.wallThickness,
      addInsert: s.addInsert,
      removeInsert: s.removeInsert,
      updateInsert: s.updateInsert,
      clearInserts: s.clearInserts,
    }))
  );
  const t = useTranslation();

  // Track which insert is selected for editing
  const [selectedInsertId, setSelectedInsertId] = useState<string | null>(null);

  // Calculate available interior dimensions
  const interiorDimensions = useMemo(() => {
    const outerW = width * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE;
    const outerD = depth * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE;
    return {
      width: outerW - 2 * wallThickness,
      depth: outerD - 2 * wallThickness,
    };
  }, [width, depth, wallThickness]);

  // Generate a unique ID for new inserts
  const generateId = useCallback(() => {
    return `insert-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }, []);

  // Add a new insert from a cutout template
  const addFromTemplate = useCallback(
    (template: InsertLibraryItem, clearanceMm: number = DEFAULT_CLEARANCE) => {
      // Calculate size in mm from template aspect ratio
      // Add clearance around the contour
      const aspectRatio = template.boundingBox.width / template.boundingBox.height;

      // Default to 20mm width, calculate depth from aspect ratio
      let insertWidth = 20 + 2 * clearanceMm;
      let insertDepth = insertWidth / aspectRatio;

      // Ensure it fits within interior
      if (insertWidth > interiorDimensions.width) {
        insertWidth = interiorDimensions.width;
        insertDepth = insertWidth / aspectRatio;
      }
      if (insertDepth > interiorDimensions.depth) {
        insertDepth = interiorDimensions.depth;
        insertWidth = insertDepth * aspectRatio;
      }

      // Center in bin
      const centerX = (interiorDimensions.width - insertWidth) / 2;
      const centerY = (interiorDimensions.depth - insertDepth) / 2;

      const newInsert: Insert = {
        id: generateId(),
        templateId: template.id,
        shape: 'custom',
        x: centerX,
        y: centerY,
        width: Math.round(insertWidth * 10) / 10,
        depth: Math.round(insertDepth * 10) / 10,
        cutDepth: DEFAULT_CUT_DEPTH,
        rotation: 0,
        cornerRadius: 0,
        label: template.name,
        // Spread to create mutable copy (Insert.contour is mutable for Immer)
        contour: [...template.contour],
      };

      addInsert(newInsert);
      setSelectedInsertId(newInsert.id);
    },
    [addInsert, generateId, interiorDimensions]
  );

  // Add a primitive shape insert
  const addPrimitiveShape = useCallback(
    (shape: Exclude<InsertShape, 'custom'>) => {
      // Default size 15mm
      const defaultSize = 15;
      const centerX = (interiorDimensions.width - defaultSize) / 2;
      const centerY = (interiorDimensions.depth - defaultSize) / 2;

      const newInsert: Insert = {
        id: generateId(),
        templateId: null,
        shape,
        x: centerX,
        y: centerY,
        width: defaultSize,
        depth: shape === 'circle' || shape === 'hexagon' ? defaultSize : defaultSize,
        cutDepth: DEFAULT_CUT_DEPTH,
        rotation: 0,
        cornerRadius: shape === 'rounded-rect' ? 2 : 0,
        label: '',
      };

      addInsert(newInsert);
      setSelectedInsertId(newInsert.id);
    },
    [addInsert, generateId, interiorDimensions]
  );

  // Update position for selected insert
  const setPosition = useCallback(
    (id: string, x: number, y: number) => {
      // Clamp to interior bounds
      const insert = inserts.find((i) => i.id === id);
      if (!insert) return;

      const maxX = Math.max(0, interiorDimensions.width - insert.width);
      const maxY = Math.max(0, interiorDimensions.depth - insert.depth);

      updateInsert(id, {
        x: Math.max(0, Math.min(maxX, x)),
        y: Math.max(0, Math.min(maxY, y)),
      });
    },
    [inserts, interiorDimensions, updateInsert]
  );

  // Update size for selected insert
  const setSize = useCallback(
    (id: string, insertWidth: number, insertDepth: number) => {
      const insert = inserts.find((i) => i.id === id);
      if (!insert) return;

      // Clamp to reasonable bounds
      const minSize = 2;
      const maxW = interiorDimensions.width;
      const maxD = interiorDimensions.depth;

      const clampedWidth = Math.max(minSize, Math.min(maxW, insertWidth));
      const clampedDepth = Math.max(minSize, Math.min(maxD, insertDepth));

      // Adjust position if insert no longer fits
      const maxX = Math.max(0, interiorDimensions.width - clampedWidth);
      const maxY = Math.max(0, interiorDimensions.depth - clampedDepth);

      updateInsert(id, {
        width: clampedWidth,
        depth: clampedDepth,
        x: Math.min(insert.x, maxX),
        y: Math.min(insert.y, maxY),
      });
    },
    [inserts, interiorDimensions, updateInsert]
  );

  // Update rotation
  const setRotation = useCallback(
    (id: string, rotation: 0 | 90 | 180 | 270) => {
      updateInsert(id, { rotation });
    },
    [updateInsert]
  );

  // Update cut depth
  const setCutDepth = useCallback(
    (id: string, cutDepth: number) => {
      updateInsert(id, { cutDepth: Math.max(0.5, Math.min(20, cutDepth)) });
    },
    [updateInsert]
  );

  // Delete an insert
  const deleteInsert = useCallback(
    (id: string) => {
      removeInsert(id);
      if (selectedInsertId === id) {
        setSelectedInsertId(null);
      }
    },
    [removeInsert, selectedInsertId]
  );

  // Get currently selected insert
  const selectedInsert = useMemo(
    () => inserts.find((i) => i.id === selectedInsertId) ?? null,
    [inserts, selectedInsertId]
  );

  // Section summary for header
  const sectionSummary = useMemo(() => {
    if (inserts.length === 0) return undefined;
    return t('binDesigner.insertsCount', { count: inserts.length });
  }, [inserts.length, t]);

  const meta: SectionMeta = useMemo(
    () => ({
      summary: sectionSummary,
    }),
    [sectionSummary]
  );

  return {
    state: {
      inserts,
      selectedInsert,
      selectedInsertId,
      interiorDimensions,
    },
    handlers: {
      addFromTemplate,
      addPrimitiveShape,
      setPosition,
      setSize,
      setRotation,
      setCutDepth,
      deleteInsert,
      clearInserts,
      setSelectedInsertId,
    },
    meta,
    t,
  };
}
