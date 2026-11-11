import en from '../../../src/i18n/locales/en';

// `<Ui k="some.key" />` in a page renders the current English label at build
// time, so a renamed control renames its docs, and a deleted key fails the
// build and the docs check instead of leaving a stale label behind.
export const UI_TAG = /<Ui\s+k="([^"]+)"\s*\/>/g;

export type UiLabelResult = { ok: true; text: string } | { ok: false; reason: string };

export function resolveUiLabel(key: string): UiLabelResult {
  const text = Object.hasOwn(en, key) ? en[key] : undefined;
  if (text === undefined) return { ok: false, reason: `unknown i18n key "${key}"` };
  // A placeholder would print raw braces in the docs.
  if (/\{\w+\}/.test(text)) return { ok: false, reason: `"${key}" has a {placeholder}` };
  return { ok: true, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderUiTags(html: string, where: string): string {
  return html.replace(UI_TAG, (_m, key: string) => {
    const r = resolveUiLabel(key);
    if (!r.ok) throw new Error(`${where}: ${r.reason}`);
    return `<span class="ui-label">${escapeHtml(r.text)}</span>`;
  });
}
