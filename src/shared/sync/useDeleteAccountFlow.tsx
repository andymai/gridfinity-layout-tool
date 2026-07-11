import { useCallback, useState } from 'react';
import { layoutAdapter } from '@/core/sync/adapters/layoutAdapter';
import { designAdapter } from '@/features/bin-designer';
import { baseplateAdapter } from '@/features/baseplate';
import { useSessionStore } from '@/core/sync/session/useSession';
import {
  runDeleteAccount,
  type DeleteAccountConfirmResult,
  type DeleteAccountResult,
} from '@/core/sync/deleteAccount';
import { DeleteAccountDialog } from '@/core/sync/dialogs/DeleteAccountDialog';

const ADAPTERS = { layouts: layoutAdapter, designs: designAdapter, baseplates: baseplateAdapter };

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
