import { useToastStore } from '@/core/store/toast';

/** Narrow a string `code` field off an unknown error without an unsafe cast. */
export function getErrorCode(err: unknown): string | undefined {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const code: unknown = err.code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

export function getErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

export function reportExportFailure(error: unknown): false {
  const message = getErrorMessage(error, 'Export failed');
  useToastStore.getState().addToast(message, 'error');
  return false;
}
