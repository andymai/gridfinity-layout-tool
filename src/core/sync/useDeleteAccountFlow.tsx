import { useCallback, useState } from 'react';
import { layoutAdapter } from './adapters/layoutAdapter';
import { designAdapter } from '@/features/bin-designer/sync/designAdapter';
import { useSessionStore } from './session/useSession';
import {
  runDeleteAccount,
  type DeleteAccountConfirmResult,
  type DeleteAccountResult,
} from './deleteAccount';
import { DeleteAccountDialog } from './dialogs/DeleteAccountDialog';

const ADAPTERS = { layouts: layoutAdapter, designs: designAdapter };

interface DeleteAccountFlow {
  deleteAccount: () => Promise<DeleteAccountResult>;
  dialog: React.ReactNode;
}

export function useDeleteAccountFlow(): DeleteAccountFlow {
  const setAnonymous = useSessionStore((s) => s.setAnonymous);
  const [prompt, setPrompt] = useState<{
    localCount: number;
    resolve: (choice: DeleteAccountConfirmResult) => void;
  } | null>(null);

  const deleteAccount = useCallback(
    () =>
      runDeleteAccount({
        adapters: ADAPTERS,
        promptConfirm: ({ localCount }) =>
          new Promise<DeleteAccountConfirmResult>((resolve) => {
            setPrompt({ localCount, resolve });
          }),
        onAnonymous: setAnonymous,
      }),
    [setAnonymous]
  );

  const dialog = prompt ? (
    <DeleteAccountDialog
      isOpen={true}
      localCount={prompt.localCount}
      onConfirm={() => {
        prompt.resolve('confirm');
        setPrompt(null);
      }}
      onCancel={() => {
        prompt.resolve('cancel');
        setPrompt(null);
      }}
    />
  ) : null;

  return { deleteAccount, dialog };
}
