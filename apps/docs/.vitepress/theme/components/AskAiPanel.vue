<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useData, useRouter } from 'vitepress';
import {
  askAi,
  ask,
  busy,
  closeAskAi,
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

const pageLink = computed(() => `/${page.value.relativePath.replace(/\.md$/, '')}`);
const starters = computed<string[]>(() => {
  const questions: unknown = frontmatter.value.questions;
  return Array.isArray(questions)
    ? questions.filter((q): q is string => typeof q === 'string')
    : [];
});
const working = computed(() =>
  askAi.exchanges.some((e) => e.status === 'waiting' || e.status === 'streaming')
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

function onGlobalKey(event: KeyboardEvent): void {
  // Escape in a capture's zoom dialog closes the dialog, not the chat.
  if (event.key !== 'Escape' || !covering.value || document.querySelector('dialog[open]')) return;
  void closeAskAi();
}

// The panel is teleported to <body>, outside VitePress's #app, so the page
// behind a covering panel can be made inert without the panel. The first open
// mounts the panel already covering, so the watcher runs at once.
watch(
  covering,
  (modal) => {
    document.getElementById('app')?.toggleAttribute('inert', modal);
    document.documentElement.classList.toggle('ask-ai-covering', modal);
  },
  { immediate: true }
);

// A docs link opens in the site. A covering panel steps aside to show it.
function onClick(event: MouseEvent): void {
  const link = (event.target as HTMLElement | null)?.closest<HTMLAnchorElement>(
    'a[data-docs-link]'
  );
  if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
  event.preventDefault();
  void router.go(link.getAttribute('href') ?? '/docs');
  if (covering.value) void closeAskAi();
}

function openSearch(): void {
  if (covering.value) void closeAskAi();
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, metaKey: true }));
}

// Follow the answer while it streams, unless the reader scrolled up to read.
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

// Only an explicit open takes focus; a docked panel never steals it from the page.
watch(
  covering,
  async (open) => {
    if (!open) return;
    await nextTick();
    input.value?.focus();
  },
  { immediate: true }
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
  document.getElementById('app')?.removeAttribute('inert');
  document.documentElement.classList.remove('ask-ai-covering');
});
</script>

<template>
  <Teleport to="body">
    <aside
      v-show="askAi.docked || askAi.open"
      id="ask-ai-panel"
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

      <div ref="scroller" class="panel-scroll" aria-live="polite" @click="onClick">
        <div v-if="askAi.exchanges.length === 0" class="empty">
          <p class="intro">
            Ask what the Layout Tool can do, or how to do something. Answers come from these docs,
            with links to the sections they use.
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
          @retry="retry(pageLink)"
          @feedback="(value) => sendFeedback(exchange, value)"
        />
      </div>

      <footer class="panel-footer">
        <div v-if="askAi.resting" class="resting">
          Ask AI is off until tomorrow.
          <button type="button" @click="openSearch">Search the docs</button>
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
  background: var(--vp-c-brand-3);
  color: var(--vp-c-white);
  font-size: 13px;
  font-weight: 600;
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
.fine {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--vp-c-text-3);
}
</style>
