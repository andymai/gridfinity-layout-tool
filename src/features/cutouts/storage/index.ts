/**
 * Cutout storage module public API.
 *
 * Provides IndexedDB persistence for the cutout template library.
 */

export {
  saveCutoutTemplate,
  loadCutoutTemplates,
  loadCutoutTemplate,
  deleteCutoutTemplate,
  updateCutoutTemplate,
  generateUniqueName,
  clearCutoutLibrary,
  closeCutoutDatabase,
  type CutoutTemplateInput,
  type CutoutTemplateUpdate,
} from './CutoutLibrary';
