import type { TranslationVars } from './types';

const PLACEHOLDER = /\{([^{}]+)\}/g;

export function interpolate(template: string, vars?: TranslationVars): string {
  if (!vars) return template;
  return template.replace(PLACEHOLDER, (placeholder, name: string) =>
    Object.hasOwn(vars, name) ? String(vars[name]) : placeholder
  );
}
