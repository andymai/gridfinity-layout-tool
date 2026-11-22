<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useData, useRoute } from 'vitepress';
import { pageLinks } from '../pageMenu';

const { page, site } = useData();
const route = useRoute();
const links = computed(() => pageLinks(page.value.relativePath, site.value.base));
const open = ref(false);
const copied = ref<'idle' | 'done' | 'failed'>('idle');
const root = ref<HTMLElement | null>(null);
const toggle = ref<HTMLButtonElement | null>(null);
const menu = ref<HTMLElement | null>(null);
let reset: ReturnType<typeof setTimeout> | undefined;

const copyLabel = computed(() =>
  copied.value === 'done' ? 'Copied' : copied.value === 'failed' ? 'Copy failed' : 'Copy page'
);

async function copyPage(): Promise<void> {
  close();
  const text = fetch(links.value.localMarkdown).then(async (response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return new Blob([await response.text()], { type: 'text/plain' });
  });
  try {
    // Safari allows the write only inside the click, so the item takes the
    // fetch as a promise instead of waiting for it first.
    if (typeof ClipboardItem !== 'undefined' && 'write' in navigator.clipboard) {
      await navigator.clipboard.write([new ClipboardItem({ 'text/plain': text })]);
    } else {
      await navigator.clipboard.writeText(await (await text).text());
    }
    copied.value = 'done';
  } catch {
    copied.value = 'failed';
  }
  clearTimeout(reset);
  reset = setTimeout(() => (copied.value = 'idle'), 2000);
}

function items(): HTMLElement[] {
  return [...(menu.value?.querySelectorAll<HTMLElement>('a, button') ?? [])];
}

async function show(): Promise<void> {
  open.value = true;
  await nextTick();
  items()[0]?.focus();
}

function close(refocus = false): void {
  if (!open.value) return;
  open.value = false;
  if (refocus) toggle.value?.focus();
}

function onMenuKey(event: KeyboardEvent): void {
  const list = items();
  const at = list.indexOf(document.activeElement as HTMLElement);
  if (event.key === 'Escape') {
    event.preventDefault();
    close(true);
  } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    const step = event.key === 'ArrowDown' ? 1 : -1;
    list[(at + step + list.length) % list.length]?.focus();
  } else if (event.key === 'Tab' && (event.shiftKey ? at === 0 : at === list.length - 1)) {
    close();
  }
}

function onOutside(event: PointerEvent): void {
  if (!root.value?.contains(event.target as Node)) close();
}

watch(open, (value) => {
  if (value) document.addEventListener('pointerdown', onOutside);
  else document.removeEventListener('pointerdown', onOutside);
});
watch(
  () => route.path,
  () => close()
);
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onOutside);
  clearTimeout(reset);
});
</script>

<template>
  <div ref="root" class="page-menu">
    <div class="split">
      <button
        class="copy"
        type="button"
        title="Copy this page as Markdown, to paste into an AI chat"
        @click="copyPage"
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
          <path
            d="M10.5 3.5v-.5a1.5 1.5 0 0 0-1.5-1.5H4A1.5 1.5 0 0 0 2.5 3v5A1.5 1.5 0 0 0 4 9.5h.5"
          />
        </svg>
        <span aria-live="polite">{{ copyLabel }}</span>
      </button>
      <button
        ref="toggle"
        class="more"
        type="button"
        aria-label="More ways to use this page"
        aria-controls="page-menu-list"
        :aria-expanded="open"
        @click="open ? close() : show()"
      >
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4" /></svg>
      </button>
    </div>
    <div v-show="open" id="page-menu-list" ref="menu" class="list" @keydown="onMenuKey">
      <button type="button" @click="copyPage">
        <strong>Copy page</strong>
        <span>As Markdown, to paste into an AI chat</span>
      </button>
      <a :href="links.localMarkdown" target="_blank" rel="noopener" @click="close()">
        <strong>View as Markdown</strong>
        <span>The plain-text version of this page</span>
      </a>
      <a :href="links.claude" target="_blank" rel="noopener noreferrer" @click="close()">
        <strong>Open in Claude</strong>
        <span>Ask Claude about this page</span>
      </a>
      <a :href="links.chatgpt" target="_blank" rel="noopener noreferrer" @click="close()">
        <strong>Open in ChatGPT</strong>
        <span>Ask ChatGPT about this page</span>
      </a>
    </div>
  </div>
</template>

<style scoped>
.page-menu {
  position: relative;
  flex-shrink: 0;
  margin-inline-start: auto;
}
.split {
  display: flex;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
}
.split button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  padding: 0 10px;
  color: var(--vp-c-text-2);
  font-size: 13px;
  font-weight: 500;
  transition: color 0.2s;
}
.split button:hover,
.split button[aria-expanded='true'] {
  color: var(--vp-c-text-1);
}
.more {
  border-inline-start: 1px solid var(--vp-c-divider);
}
.split svg {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.list {
  position: absolute;
  inset-inline-end: 0;
  top: calc(100% + 6px);
  z-index: 20;
  display: grid;
  width: max-content;
  min-width: 240px;
  padding: 6px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-elv);
  box-shadow: var(--vp-shadow-3);
}
.list a,
.list button {
  display: grid;
  gap: 1px;
  padding: 8px 10px;
  border-radius: 8px;
  text-align: start;
  text-decoration: none;
  color: var(--vp-c-text-1);
  font-size: 14px;
  line-height: 1.3;
}
.list a:hover,
.list button:hover,
.list a:focus-visible,
.list button:focus-visible {
  background: var(--vp-c-default-soft);
}
.list strong {
  font-weight: 600;
}
.list span {
  color: var(--vp-c-text-2);
  font-size: 12px;
}
</style>
