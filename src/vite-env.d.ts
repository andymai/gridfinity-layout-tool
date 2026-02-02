/// <reference types="vite/client" />

// Type declaration for OpenCascade Emscripten module factory (brepjs-opencascade)
declare module 'brepjs-opencascade/src/brepjs_single.js' {
  interface OpenCascadeConfig {
    locateFile?: (fileName: string) => string;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TECH-DEBT: OpenCascade WASM factory returns untyped Emscripten module
  type OpenCascadeFactory = (config?: OpenCascadeConfig) => Promise<any>;
  const factory: OpenCascadeFactory;
  export default factory;
}

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
