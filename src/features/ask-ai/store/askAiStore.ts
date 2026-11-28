import { create } from 'zustand';
import { ASK_AI_ENDPOINT } from '../constants';

interface AskAiState {
  /** The server's app door is on. Until the check answers, nothing shows. */
  readonly available: boolean;
  /** The day's spend cap is reached: the panel says so and takes no question. */
  readonly resting: boolean;
  readonly open: boolean;
  readonly setOpen: (open: boolean) => void;
  readonly toggle: () => void;
}

export const useAskAiStore = create<AskAiState>()((set, get) => ({
  available: false,
  resting: false,
  open: false,
  setOpen: (open) => set({ open: open && get().available }),
  toggle: () => set({ open: !get().open && get().available }),
}));

let checked: Promise<void> | null = null;

/** Asks the server once for each page load whether Ask AI in the app is on. */
export function checkAskAiAvailability(): Promise<void> {
  checked ??= (async () => {
    // A self-hosted copy has no server functions.
    if ((import.meta.env.VITE_SELF_HOSTED as string | undefined) === '1') return;
    try {
      const response = await fetch(`${ASK_AI_ENDPOINT}?door=app`, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) return;
      const status = (await response.json()) as { enabled?: unknown; resting?: unknown };
      useAskAiStore.setState({
        available: status.enabled === true,
        resting: status.resting === true,
      });
    } catch {
      // Offline, or a server without the endpoint: the button stays hidden.
    }
  })();
  return checked;
}

/** Test seam: forget the check, so that a test can run it again. */
export function resetAskAiAvailability(): void {
  checked = null;
  useAskAiStore.setState({ available: false, resting: false, open: false });
}
