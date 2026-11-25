<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useData, useRouter } from 'vitepress';
import {
  askAi,
  ask,
  busy,
  closeAskAi,
  isLive,
  newChat,
  retry,
  sendFeedback,
  stop,
} from '../askAi/useAskAi';
import AskAiAnswer from './AskAiAnswer.vue';

const { page, frontmatter } = useData();
const router = useRouter();
const draft = ref('');
const input = ref<HTMLTextAreaElement | null>(null);
const scroller = ref<HTMLElement | null>(null);
const panel = ref<HTMLElement | null>(null);

const pageLink = computed(() => `/${page.value.relativePath.replace(/\.md$/, '')}`);
const starters = computed<string[]>(() => {
  const questions: unknown = frontmatter.value.questions;
  return Array.isArray(questions)
    ? questions.filter((q): q is string => typeof q === 'string')
    : [];
});
const working = computed(() => askAi.exchanges.some(isLive));
const plans = computed(() =>
  Object.assign({}, ...askAi.exchanges.map((exchange) => exchange.plans))
);
// A live region over the chat would read each streamed chunk out again, and a
// status element that mounts with its text is often not read at all. This one
// line, always mounted, says when an answer starts and ends, and why it failed.
const ANNOUNCEMENTS: Readonly<Record<string, string>> = {
  done: 'Ask AI answered.',
  stopped: 'Ask AI stopped.',
  asking: 'Ask AI wants to read your saved data. Allow it or not in the answer.',
};
const announcement = computed(() => {
  const last = askAi.exchanges.at(-1);
  if (!last) return '';
  if (isLive(last)) return 'Ask AI is answering.';
  return last.notice ?? ANNOUNCEMENTS[last.status] ?? '';
});

// The composer gives way to the full-chat prompt and back. Focus that was in
// the panel follows; a restore at page load takes none from the page.
watch(
  () => askAi.full,
  async (full) => {
    const inPanel = panel.value?.contains(document.activeElement) ?? false;
    await nextTick();
    if (!inPanel) return;
    if (full) panel.value?.querySelector<HTMLElement>('.panel-footer button')?.focus();
    else input.value?.focus();
  }
);
// Below the dock width the panel covers the page, so it acts as a modal view.
const covering = computed(() => !askAi.docked && askAi.open);

async function submit(question: string = draft.value): Promise<void> {
  if (!question.trim() || busy()) return;
  draft.value = '';
  await ask(question, pageLink.value);
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    void submit();
  }
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, summary, [tabindex]:not([tabindex="-1"])';

// Inert keeps Tab out of the page, not out of the panel into the browser's
// own controls. Focus on <body>, after a click on plain text, counts as
// outside the panel.
function wrapTab(event: KeyboardEvent): void {
  const items = [...(panel.value?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])].filter(
    (el) => el.getClientRects().length > 0
  );
  const first = items[0];
  const last = items.at(-1);
  if (!first || !last) return;
  const at = document.activeElement;
  const outside = !panel.value?.contains(at);
  if (event.shiftKey && (at === first || outside)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (at === last || outside)) {
    event.preventDefault();
    first.focus();
  }
}

function onGlobalKey(event: KeyboardEvent): void {
  // A capture's zoom dialog handles its own Escape and Tab.
  if (!covering.value || document.querySelector('dialog[open]')) return;
  if (event.key === 'Escape') void closeAskAi();
  else if (event.key === 'Tab') wrapTab(event);
}

// The panel is teleported to <body>, outside VitePress's #app, so the page
// behind a covering panel can be made inert without the panel.
function setCovering(modal: boolean): void {
  document.getElementById('app')?.toggleAttribute('inert', modal);
  document.documentElement.classList.toggle('ask-ai-covering', modal);
}

// The first open mounts the panel already covering, so the watcher runs at
// once. Only an explicit open takes focus; a docked panel never steals it
// from the page.
watch(
  covering,
  async (modal) => {
    setCovering(modal);
    if (!modal) return;
    await nextTick();
    // A resting panel has no question field, and focus must still enter the dialog.
    (input.value ?? panel.value?.querySelector<HTMLElement>(FOCUSABLE))?.focus();
  },
  { immediate: true }
);

function copyCode(button: HTMLButtonElement): void {
  const code = button.parentElement?.querySelector('code')?.textContent ?? '';
  void navigator.clipboard.writeText(code).then(
    () => {
      button.textContent = 'Copied';
      setTimeout(() => (button.textContent = 'Copy'), 1500);
    },
    () => undefined
  );
}

function onClick(event: MouseEvent): void {
  const target = event.target as HTMLElement | null;
  const copy = target?.closest<HTMLButtonElement>('button[data-copy-code]');
  if (copy) {
    copyCode(copy);
    return;
  }
  const link = target?.closest<HTMLAnchorElement>('a[data-docs-link]');
  if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
  event.preventDefault();
  void router.go(link.getAttribute('href') ?? '/docs');
  if (covering.value) void closeAskAi();
}

function openSearch(): void {
  if (covering.value) void closeAskAi();
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, metaKey: true }));
}

watch(
  () => askAi.exchanges.map((e) => e.text.length + e.steps.length + e.thinking.length).join(),
  async () => {
    const el = scroller.value;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    await nextTick();
    if (near) el.scrollTop = el.scrollHeight;
  }
);

watch(draft, async () => {
  await nextTick();
  const el = input.value;
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
});

onMounted(() => {
  // A panel that first showed docked stays mounted when the window narrows.
  askAi.opened = true;
  window.addEventListener('keydown', onGlobalKey);
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onGlobalKey);
  setCovering(false);
});
</script>

<template>
  <Teleport to="body">
    <aside
      v-show="askAi.docked || askAi.open"
      id="ask-ai-panel"
      ref="panel"
      class="ask-ai-panel"
      :class="{ docked: askAi.docked }"
      :role="covering ? 'dialog' : undefined"
      :aria-modal="covering ? 'true' : undefined"
      aria-labelledby="ask-ai-title"
    >
      <header class="panel-header">
        <h2 id="ask-ai-title">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M8 1.5l1.6 4.2 4.4 1.3-4.4 1.3L8 12.5 6.4 8.3 2 7l4.4-1.3z" />
          </svg>
          Ask AI <span class="beta">Beta</span>
        </h2>
        <button
          v-if="askAi.exchanges.length > 0"
          class="header-button"
          type="button"
          :disabled="working"
          @click="newChat"
        >
          New chat
        </button>
        <button
          v-if="!askAi.docked"
          class="header-button close"
          type="button"
          aria-label="Close Ask AI"
          @click="closeAskAi"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </header>

      <p class="sr-only" role="status">{{ announcement }}</p>
      <div ref="scroller" class="panel-scroll" @click="onClick">
        <div v-if="askAi.exchanges.length === 0" class="empty">
          <p class="intro">
            Tell it about your drawer, your tools or your printer. It sizes the grid for a drawer
            and plans bins across features. Answers come from these docs, with links to each step.
          </p>
          <ul v-if="starters.length > 0" class="starters">
            <li v-for="question in starters" :key="question">
              <button type="button" :disabled="askAi.resting" @click="submit(question)">
                {{ question }}
              </button>
            </li>
          </ul>
        </div>
        <AskAiAnswer
          v-for="(exchange, i) in askAi.exchanges"
          :key="exchange.id"
          :exchange="exchange"
          :last="i === askAi.exchanges.length - 1"
          :plans="plans"
          @retry="retry(pageLink)"
          @feedback="(value) => sendFeedback(exchange, value)"
        />
      </div>

      <footer class="panel-footer">
        <div v-if="askAi.resting" class="resting">
          Ask AI is off until tomorrow.
          <button type="button" @click="openSearch">Search the docs</button>
        </div>
        <div v-else-if="askAi.full && !working" class="resting">
          This chat is full.
          <button type="button" @click="newChat">Start a new chat</button>
        </div>
        <form v-else class="composer" @submit.prevent="submit()">
          <textarea
            ref="input"
            v-model="draft"
            rows="1"
            maxlength="1000"
            placeholder="Ask about the Layout Tool"
            aria-label="Your question"
            @keydown="onKeydown"
          />
          <button v-if="working" class="send" type="button" @click="stop">Stop</button>
          <button v-else class="send" type="submit" :disabled="!draft.trim()">Send</button>
        </form>
        <p class="fine">Answers can be wrong. Check the linked sections.</p>
      </footer>
    </aside>
  </Teleport>
</template>

<style scoped>
/* Full screen below the dock width. The padding keeps one reading column in
   the middle of a wide tablet, and is plain 16px on a phone. */
.ask-ai-panel {
  --column-pad: max(16px, calc((100% - 46rem) / 2));
  position: fixed;
  inset: 0;
  z-index: calc(var(--vp-z-index-sidebar) + 10);
  display: flex;
  flex-direction: column;
  background: var(--vp-c-bg);
}
.ask-ai-panel.docked {
  inset: 0 0 0 auto;
  z-index: var(--vp-z-index-nav);
  width: var(--ask-ai-dock);
  border-inline-start: 1px solid var(--vp-c-divider);
}
.panel-header {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
  height: var(--vp-nav-height, 64px);
  padding-inline: var(--column-pad);
  border-bottom: 1px solid var(--vp-c-divider);
}
.panel-header h2 {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 auto 0 0;
  padding: 0;
  border: 0;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.4;
}
.panel-header h2 svg {
  width: 15px;
  height: 15px;
  fill: var(--vp-c-brand-1);
}
.beta {
  padding: 1px 6px;
  border-radius: 8px;
  background: var(--vp-c-default-soft);
  color: var(--vp-c-text-2);
  font-size: 11px;
  font-weight: 500;
}
.header-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 32px;
  padding: 4px 8px;
  border-radius: 6px;
  color: var(--vp-c-text-2);
  font-size: 13px;
}
.header-button:hover:not(:disabled) {
  background: var(--vp-c-default-soft);
  color: var(--vp-c-text-1);
}
.header-button:disabled {
  opacity: 0.5;
}
.close {
  min-width: 32px;
}
.close svg {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.75;
  stroke-linecap: round;
}
.panel-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--vp-c-text-3) transparent;
  padding: 16px var(--column-pad);
  font-size: 14px;
}
.intro {
  margin: 0 0 12px;
  color: var(--vp-c-text-2);
  line-height: 1.6;
}
.starters {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.starters button {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  text-align: left;
  color: var(--vp-c-text-1);
  line-height: 1.4;
}
.starters button:hover:not(:disabled) {
  border-color: var(--vp-c-brand-1);
}
.panel-footer {
  flex-shrink: 0;
  padding: 12px var(--column-pad) max(10px, env(safe-area-inset-bottom));
  border-top: 1px solid var(--vp-c-divider);
}
.composer {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 6px 6px 6px 12px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
}
.composer:focus-within {
  border-color: var(--vp-c-brand-1);
}
.composer textarea {
  flex: 1;
  min-width: 0;
  resize: none;
  padding: 6px 0;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--vp-c-text-1);
  font: inherit;
  font-size: 14px;
  line-height: 1.5;
}
/* Under 16px, iOS Safari zooms the page when the field takes focus. */
@media (pointer: coarse) {
  .composer textarea {
    font-size: 16px;
  }
}
.send {
  min-height: 32px;
  padding: 6px 12px;
  border-radius: 8px;
  background: var(--vp-button-brand-bg);
  color: var(--vp-button-brand-text);
  font-size: 13px;
  font-weight: 600;
}
.send:hover:not(:disabled) {
  background: var(--vp-button-brand-hover-bg);
  color: var(--vp-button-brand-hover-text);
}
.send:disabled {
  opacity: 0.4;
}
.resting {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 14px;
  color: var(--vp-c-text-2);
}
.resting button {
  color: var(--vp-c-brand-1);
  font-weight: 600;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.fine {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--vp-c-text-3);
}
</style>
