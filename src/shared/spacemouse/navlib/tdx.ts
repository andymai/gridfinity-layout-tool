import type { NavlibConstructor } from './tdxTypes';

/**
 * `@3dconnexion/3dconnexionjs` ships no type declarations, and its
 * `"type": "module"` package layout defeats an ambient `declare module` shim
 * (TypeScript resolves the real file and ignores the ambient decl), so this is
 * the single boundary that imports it untyped. The dynamic import keeps the
 * library (and its legacy global side effects) out of the bundle until a driver
 * is actually present.
 */
export async function loadNavlib(): Promise<NavlibConstructor> {
  // @ts-expect-error TECH-DEBT: @3dconnexion/3dconnexionjs ships no type declarations
  const mod = (await import('@3dconnexion/3dconnexionjs')) as { _3Dconnexion: NavlibConstructor };
  return mod._3Dconnexion;
}
