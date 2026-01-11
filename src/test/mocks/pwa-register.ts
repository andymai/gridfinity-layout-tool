import { vi } from 'vitest';

// Mock for virtual:pwa-register/react module
export function useRegisterSW() {
  return {
    needRefresh: [false, vi.fn()] as [boolean, (v: boolean) => void],
    offlineReady: [false, vi.fn()] as [boolean, (v: boolean) => void],
    updateServiceWorker: vi.fn(),
  };
}
