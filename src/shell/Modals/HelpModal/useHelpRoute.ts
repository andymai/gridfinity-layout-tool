/**
 * Resolves the current HelpRoute from the app's routing hooks. Used by the
 * HelpModal to filter the catalog so users only see entries relevant to the
 * mode they're in.
 */

import { useDesignerRouting } from '@/shared/hooks/useDesignerRouting';
import { useBaseplateRouting } from '@/shared/hooks/useBaseplateRouting';
import type { HelpRoute } from '@/shared/help/helpEntry';

export function useHelpRoute(): HelpRoute {
  const { isDesignerRoute } = useDesignerRouting();
  const { isBaseplateRoute } = useBaseplateRouting();
  if (isDesignerRoute) return 'designer';
  if (isBaseplateRoute) return 'baseplate';
  return 'layout';
}
