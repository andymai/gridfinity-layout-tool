/**
 * Mounts the baseplate library resolver at the planner root so drawer margins
 * reflect the active design on planner load. Rendered inside the planner-only
 * mutations tree (never on the /baseplate route, which mounts the hook itself),
 * so the two mounts are mutually exclusive by route.
 */

import { useBaseplateLibraryInit } from '@/features/baseplate/hooks/useBaseplateLibraryInit';

export function BaseplateLibraryInitMount() {
  useBaseplateLibraryInit();
  return null;
}
