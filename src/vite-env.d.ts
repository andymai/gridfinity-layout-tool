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

// Global Privacy Control — experimental, not yet in lib.dom.d.ts
// https://developer.mozilla.org/en-US/docs/Web/API/Navigator/globalPrivacyControl
interface Navigator {
  readonly globalPrivacyControl?: boolean;
}

// Build-time defines injected by scripts/vite-plugin-version.ts.
declare const __APP_VERSION__: string;
declare const __GIT_SHA__: string;
declare const __BUILD_TIME__: string;

// occt-wasm Emscripten entry — the package only ships a typed `OcctKernel`
// wrapper, but brepjs's `OcctWasmAdapter` needs the raw module. We import
// the dist JS factory directly; declare a minimal shape so TS stays happy.
declare module 'occt-wasm/dist/occt-wasm.js' {
  interface OcctWasmModuleConfig {
    locateFile?: (path: string) => string;
    wasmBinary?: ArrayBuffer | Uint8Array;
  }
  interface OcctWasmModule {
    readonly OcctKernel: new () => unknown;
  }
  const init: (config?: OcctWasmModuleConfig) => Promise<OcctWasmModule>;
  export default init;
}
