import { Grid } from '@/features/grid-editor';
import { lazyWithRetry, namedExport } from '@/shared/utils/lazyWithRetry';
import { CollabGridOverlay } from '@/shell/Collab/CollabGridOverlay';

const MobileGridToolbar = lazyWithRetry(() =>
  import('@/shell/Mobile').then(namedExport('MobileGridToolbar'))
);

interface ShellGridProps {
  shouldShowDrawTutorial: boolean;
}

/** `Grid` with the shell-owned slots bound: the mobile toolbar and the collab overlays. */
export function ShellGrid({ shouldShowDrawTutorial }: ShellGridProps) {
  return (
    <Grid
      shouldShowDrawTutorial={shouldShowDrawTutorial}
      renderMobileToolbar={(fitToScreen) => <MobileGridToolbar onFitToScreen={fitToScreen} />}
      collabOverlay={<CollabGridOverlay />}
    />
  );
}
