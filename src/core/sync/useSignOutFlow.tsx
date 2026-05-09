import { useCallback, useState } from 'react';
import { layoutAdapter } from './adapters/layoutAdapter';
import { designAdapter } from '@/features/bin-designer/sync/designAdapter';
import { useSessionStore } from './session/useSession';
import { runSignOut, type KeepLocalPromptResult } from './signOut';
import { SignOutDialog } from './dialogs/SignOutDialog';

const ADAPTERS = { layouts: layoutAdapter, designs: designAdapter };

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
