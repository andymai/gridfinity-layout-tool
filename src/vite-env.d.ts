/// <reference types="vite/client" />

// Type declaration for OpenCascade Emscripten module factory
declare module 'replicad-opencascadejs/src/replicad_single.js' {
  import type { OpenCascadeInstance } from 'replicad-opencascadejs/src/replicad_single';
  interface OpenCascadeConfig {
    locateFile?: (fileName: string) => string;
  }
  type OpenCascadeFactory = (config?: OpenCascadeConfig) => Promise<OpenCascadeInstance>;
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
