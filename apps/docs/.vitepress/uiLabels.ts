import en from '../../../src/i18n/locales/en';

export const UI_TAG = /<Ui\s+k="([^"]+)"\s*\/>/g;
export const MALFORMED_UI_TAG = /<Ui\b/;

export type UiLabelResult = { ok: true; text: string } | { ok: false; reason: string };

export function resolveUiLabel(key: string): UiLabelResult {
  if (!Object.hasOwn(en, key)) return { ok: false, reason: `unknown i18n key "${key}"` };
  const text = en[key];
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
  const rendered = html.replace(UI_TAG, (_m, key: string) => {
    const r = resolveUiLabel(key);
    if (!r.ok) throw new Error(`${where}: ${r.reason}`);
    return `<span class="ui-label">${escapeHtml(r.text)}</span>`;
  });
  // Vue renders an unmatched tag, such as <Ui key="x">, as an empty comment.
  if (MALFORMED_UI_TAG.test(rendered)) throw new Error(`${where}: malformed <Ui> tag`);
  return rendered;
}
