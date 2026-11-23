/**
 * Mounts the baseplate library resolver at the planner root so drawer margins
 * reflect the active design on planner load, and the write-back that saves the
 * planner's plate edits to that design. Rendered inside the planner-only
 * mutations tree (never on the /baseplate route, which mounts the resolver and
 * its own autosave), so the two mounts are mutually exclusive by route.
 */

import { useBaseplateLibraryInit } from '@/features/baseplate/hooks/useBaseplateLibraryInit';
import { usePlannerBaseplateWriteBack } from '@/features/baseplate/hooks/usePlannerBaseplateWriteBack';

export function BaseplateLibraryInitMount() {
  useBaseplateLibraryInit();
  usePlannerBaseplateWriteBack();
  return null;
}
