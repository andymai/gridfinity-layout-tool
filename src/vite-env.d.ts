/// <reference types="vite/client" />

// Type declarations for vite-plugin-pwa virtual modules
declare module 'virtual:pwa-register/react' {
  import type { Dispatch, SetStateAction } from 'react';

  export interface RegisterSWOptions {
    immediate?: boolean;
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
    onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void;
    onRegisteredSW?: (
      swScriptUrl: string,
      registration: ServiceWorkerRegistration | undefined
    ) => void;
    onRegisterError?: (error: Error) => void;
  }

  export function useRegisterSW(options?: RegisterSWOptions): {
    needRefresh: [boolean, Dispatch<SetStateAction<boolean>>];
    offlineReady: [boolean, Dispatch<SetStateAction<boolean>>];
    updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
  };
}

// occt-wasm raw Emscripten module (no bundled types for this deep path)
declare module 'occt-wasm/dist/occt-wasm.js' {
  const createModule: unknown;
  export default createModule;
}

// Global Privacy Control — experimental, not yet in lib.dom.d.ts
// https://developer.mozilla.org/en-US/docs/Web/API/Navigator/globalPrivacyControl
interface Navigator {
  readonly globalPrivacyControl?: boolean;
}
