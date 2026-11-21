<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useData, useRouter } from 'vitepress';
import { askAi, ask, busy, newChat, retry, sendFeedback, setOpen, stop } from '../askAi/useAskAi';
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

function close(): void {
  setOpen(false);
  document.getElementById('ask-ai-button')?.focus();
}

function onGlobalKey(event: KeyboardEvent): void {
  if (event.key.toLowerCase() === 'i' && (event.metaKey || event.ctrlKey) && !event.altKey) {
    event.preventDefault();
    if (askAi.open) close();
    else setOpen(true);
  } else if (event.key === 'Escape' && askAi.open) {
    close();
  }
}

// A docs link opens in the site, so the chat stays where it is.
function onClick(event: MouseEvent): void {
  const link = (event.target as HTMLElement | null)?.closest<HTMLAnchorElement>(
    'a[data-docs-link]'
  );
  if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
  event.preventDefault();
  void router.go(link.getAttribute('href') ?? '/docs');
}

function openSearch(): void {
  close();
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

watch(
  () => askAi.open,
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

onMounted(() => window.addEventListener('keydown', onGlobalKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onGlobalKey));
</script>

<template>
  <Teleport to="body">
    <aside
      v-show="askAi.open"
      id="ask-ai-panel"
      class="ask-ai-panel"
      role="dialog"
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
        <button class="header-button close" type="button" aria-label="Close Ask AI" @click="close">
          ✕
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
.ask-ai-panel {
  position: fixed;
  top: var(--vp-nav-height);
  right: 0;
  bottom: 0;
  z-index: calc(var(--vp-z-index-nav) - 1);
  display: flex;
  flex-direction: column;
  width: min(420px, 100vw);
  border-left: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  box-shadow: var(--vp-shadow-3);
}
.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
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
.panel-header svg {
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
.panel-scroll {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 16px;
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
  padding: 12px 16px 10px;
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
.send {
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
@media (max-width: 767px) {
  .ask-ai-panel {
    top: 0;
    z-index: calc(var(--vp-z-index-nav) + 10);
    width: 100vw;
    border-left: 0;
  }
}
</style>
