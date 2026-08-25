import { useCallback, useState } from 'react';
import { layoutAdapter } from '@/core/sync/adapters/layoutAdapter';
// Deep imports, not the feature barrels. This module is statically reachable from
// the entry (App → Sidebar → UserDock), so pulling either barrel drags its whole
// feature onto first paint — the baseplate barrel re-exports BaseplatePage and the
// thumbnail helper, which is how three, @react-three/fiber and drei (~1.2 MB) ended
// up eagerly preloaded. Same reasoning as the Liveblocks note in shared/hooks/index.ts.
import { designAdapter } from '@/features/bin-designer/sync/designAdapter';
import { designVersionAdapter } from '@/features/bin-designer/sync/designVersionAdapter';
import { baseplateAdapter } from '@/features/baseplate/sync/baseplateAdapter';
import { useSessionStore } from '@/core/sync/session/useSession';
import { runSignOut, type KeepLocalPromptResult } from '@/core/sync/signOut';
import { SignOutDialog } from '@/core/sync/dialogs/SignOutDialog';

const ADAPTERS = {
  layouts: layoutAdapter,
  designs: designAdapter,
  baseplates: baseplateAdapter,
  designVersions: designVersionAdapter,
};

interface SignOutFlow {
  signOut: () => Promise<void>;
  dialog: React.ReactNode;
}

export function useSignOutFlow(): SignOutFlow {
  const setAnonymous = useSessionStore((s) => s.setAnonymous);
  const [prompt, setPrompt] = useState<{
    localCount: number;
    resolve: (choice: KeepLocalPromptResult) => void;
  } | null>(null);

  const signOut = useCallback(async () => {
    await runSignOut({
      adapters: ADAPTERS,
      promptKeepLocal: ({ localCount }) =>
        new Promise<KeepLocalPromptResult>((resolve) => {
          setPrompt({ localCount, resolve });
        }),
      onAnonymous: setAnonymous,
    });
  }, [setAnonymous]);

  const dialog = prompt ? (
    <SignOutDialog
      isOpen={true}
      localCount={prompt.localCount}
      onChoice={(choice) => {
        prompt.resolve(choice);
        setPrompt(null);
      }}
      onCancel={() => {
        prompt.resolve('cancel');
        setPrompt(null);
      }}
    />
  ) : null;

  return { signOut, dialog };
}
