<script setup lang="ts">
import { computed, ref } from 'vue';
import { data as captures } from '../askAi/captures.data';
import { answerSegments, plainAnswer } from '@/agent/client/render';
import { answerRequest, isLive, noticeText } from '../askAi/useAskAi';
import type { Exchange, StepKind } from '../askAi/useAskAi';
import type { PlanView } from '@/agent/contract';
import { mediaEntry } from '../media';
import PlanMap from './PlanMap.vue';
import ReaderRequestCard from './ReaderRequestCard.vue';

// Plans from every turn: a follow-up may show an earlier plan again by its handle.
const props = defineProps<{
  exchange: Exchange;
  last: boolean;
  plans: Readonly<Record<string, PlanView>>;
}>();
const emit = defineEmits<{ retry: []; feedback: [value: 1 | -1] }>();

const showSteps = ref(false);
const copied = ref(false);

const live = computed(() => isLive(props.exchange));
const segments = computed(() =>
  answerSegments(props.exchange.text, {
    streaming: live.value,
    isCapture: (id) => Boolean(mediaEntry(id) && Object.hasOwn(captures, id)),
    isPlan: (handle) => Object.hasOwn(props.plans, handle),
    siteLinksOnly: props.exchange.personal,
  })
);

const NOUNS: Readonly<Record<StepKind, [string, string]>> = {
  read: ['page read', 'pages read'],
  search: ['search', 'searches'],
  check: ['check', 'checks'],
  plan: ['plan', 'plans'],
  yours: ['read of your data', 'reads of your data'],
};

const summary = computed(() => {
  const counts = new Map<StepKind, number>();
  let failed = 0;
  for (const step of props.exchange.steps) {
    if (step.state === 'done') counts.set(step.kind, (counts.get(step.kind) ?? 0) + 1);
    else if (step.state === 'error') failed++;
  }
  const parts = [...counts].map(([kind, n]) => `${n} ${NOUNS[kind][n === 1 ? 0 : 1]}`);
  if (failed > 0) parts.push(`${failed} failed`);
  return parts.join(' · ');
});

async function copy(): Promise<void> {
  try {
    await navigator.clipboard.writeText(plainAnswer(props.exchange.text));
    copied.value = true;
    setTimeout(() => (copied.value = false), 2000);
  } catch {
    copied.value = false;
  }
}
</script>

<template>
  <article class="exchange">
    <p class="question">{{ exchange.question }}</p>

    <div class="answer">
      <ol v-if="exchange.steps.length > 0 && (live || showSteps)" class="steps" aria-label="Steps">
        <li v-for="step in exchange.steps" :key="step.id" :class="['step', step.state]">
          <span class="step-icon" aria-hidden="true" />
          {{ step.label }}
        </li>
      </ol>
      <button
        v-if="summary && !live"
        class="steps-summary"
        type="button"
        :aria-expanded="showSteps"
        @click="showSteps = !showSteps"
      >
        <span class="chevron" aria-hidden="true">{{ showSteps ? '▾' : '▸' }}</span>
        {{ summary }}
      </button>

      <ReaderRequestCard
        v-if="exchange.request"
        :request="exchange.request"
        @answer="(allow) => answerRequest(exchange, allow)"
      />

      <p v-if="live && !exchange.text" class="thinking-line">
        {{ exchange.steps.some((s) => s.state === 'running') ? 'Reading the docs…' : 'Thinking…' }}
      </p>

      <details v-if="exchange.thinking && !live" class="reasoning">
        <summary>Show reasoning</summary>
        <p>{{ exchange.thinking }}</p>
      </details>

      <div class="answer-body">
        <template
          v-for="(segment, i) in segments"
          :key="
            segment.kind === 'capture'
              ? `${i}-${segment.id}`
              : segment.kind === 'plan'
                ? `${i}-${segment.handle}`
                : i
          "
        >
          <!-- render.ts escapes all raw HTML in the answer except <kbd>. -->
          <div v-if="segment.kind === 'html'" class="answer-html" v-html="segment.html" />
          <PlanMap v-else-if="segment.kind === 'plan'" :plan="plans[segment.handle]" />
          <Screenshot v-else :id="segment.id" :alt="captures[segment.id]?.alt ?? ''" />
        </template>
      </div>

      <p v-if="exchange.status === 'stopped'" class="notice">Stopped.</p>
      <p v-if="exchange.notice" class="notice">{{ noticeText(exchange.notice) }}</p>

      <div v-if="!live && exchange.status !== 'asking'" class="actions">
        <button v-if="exchange.text" type="button" @click="copy">
          {{ copied ? 'Copied' : 'Copy' }}
        </button>
        <button v-if="last" type="button" @click="emit('retry')">Retry</button>
        <template v-if="exchange.traceId && exchange.status === 'done'">
          <button
            type="button"
            class="thumb"
            aria-label="Good answer"
            :aria-pressed="exchange.feedback === 1"
            @click="emit('feedback', 1)"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M7 10v11H3V10zm2 11h8.6a2 2 0 0 0 2-1.6l1.3-7A2 2 0 0 0 18.9 10H14l.9-4.3A1.6 1.6 0 0 0 13.3 4L9 10z"
              />
            </svg>
          </button>
          <button
            type="button"
            class="thumb"
            aria-label="Bad answer"
            :aria-pressed="exchange.feedback === -1"
            @click="emit('feedback', -1)"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M17 14V3h4v11zm-2-11H6.4a2 2 0 0 0-2 1.6l-1.3 7A2 2 0 0 0 5.1 14H10l-.9 4.3a1.6 1.6 0 0 0 1.6 1.7L15 14z"
              />
            </svg>
          </button>
        </template>
      </div>
    </div>
  </article>
</template>

<style scoped>
.exchange {
  margin-bottom: 24px;
}
.question {
  margin: 0 0 10px auto;
  max-width: 85%;
  width: fit-content;
  padding: 8px 12px;
  border-radius: 12px 12px 4px 12px;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-text-1);
  font-weight: 500;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.steps {
  margin: 0 0 8px;
  padding: 0;
  list-style: none;
  font-size: 13px;
  color: var(--vp-c-text-2);
}
.step {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px 0;
}
.step-icon {
  width: 8px;
  height: 8px;
  flex: none;
  border-radius: 50%;
  background: var(--vp-c-text-3);
}
.step.running .step-icon {
  background: var(--vp-c-brand-1);
  animation: ask-ai-pulse 1s ease-in-out infinite;
}
.step.done .step-icon {
  background: var(--vp-c-green-1);
}
.step.error .step-icon {
  background: var(--vp-c-red-1);
}
.step.waiting .step-icon {
  background: var(--vp-c-yellow-1);
}
.steps-summary {
  display: inline-flex;
  gap: 6px;
  margin-bottom: 8px;
  font-size: 13px;
  color: var(--vp-c-text-2);
}
.steps-summary:hover {
  color: var(--vp-c-text-1);
}
.thinking-line {
  margin: 0;
  font-size: 14px;
  color: var(--vp-c-text-2);
  animation: ask-ai-shimmer 1.6s ease-in-out infinite;
}
.reasoning {
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--vp-c-text-2);
}
.reasoning summary {
  cursor: pointer;
}
.reasoning p {
  margin: 6px 0 0;
  padding-left: 10px;
  border-left: 2px solid var(--vp-c-divider);
  white-space: pre-wrap;
}
.answer-body :deep(p),
.answer-body :deep(ul),
.answer-body :deep(ol) {
  margin: 8px 0;
  line-height: 1.6;
}
.answer-body :deep(ol),
.answer-body :deep(ul) {
  padding-left: 20px;
}
.answer-body :deep(ol) {
  list-style: decimal;
}
.answer-body :deep(ul) {
  list-style: disc;
}
.answer-body :deep(a) {
  color: var(--vp-c-brand-1);
  text-decoration: underline;
  text-underline-offset: 2px;
}
.answer-body :deep(table) {
  display: block;
  overflow-x: auto;
  margin: 8px 0;
  font-size: 13px;
  border-collapse: collapse;
}
.answer-body :deep(th),
.answer-body :deep(td) {
  padding: 4px 8px;
  border: 1px solid var(--vp-c-divider);
}
.answer-body :deep(code) {
  font-size: 0.9em;
  padding: 1px 4px;
  border-radius: 4px;
  background: var(--vp-c-default-soft);
}
.answer-body :deep(.code-block) {
  display: grid;
  margin: 8px 0;
}
.answer-body :deep(pre) {
  margin: 0;
  padding: 10px 12px;
  overflow-x: auto;
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
  font-size: 12.5px;
  line-height: 1.5;
}
.answer-body :deep(pre code) {
  padding: 0;
  background: none;
  font-size: inherit;
}
.answer-body :deep(.copy-code) {
  justify-self: end;
  margin-bottom: 4px;
  padding: 2px 8px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-2);
  font-size: 12px;
}
.answer-body :deep(.copy-code:hover) {
  color: var(--vp-c-text-1);
}
.answer-body :deep(kbd) {
  padding: 0 5px;
  border: 1px solid var(--vp-c-divider);
  border-bottom-width: 2px;
  border-radius: 4px;
  background: var(--vp-c-bg-soft);
  font-family: var(--vp-font-family-mono);
  font-size: 0.85em;
}
.answer-body :deep(figure) {
  margin: 12px 0;
}
.notice {
  margin: 8px 0 0;
  font-size: 13px;
  color: var(--vp-c-text-2);
}
.actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
  font-size: 13px;
  color: var(--vp-c-text-2);
}
.actions button:hover {
  color: var(--vp-c-text-1);
}
.thumb {
  display: inline-flex;
  padding: 2px;
}
.thumb svg {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linejoin: round;
}
.thumb[aria-pressed='true'] {
  color: var(--vp-c-brand-1);
}
.thumb[aria-pressed='true'] svg {
  fill: currentColor;
}
@keyframes ask-ai-pulse {
  50% {
    opacity: 0.3;
  }
}
@keyframes ask-ai-shimmer {
  50% {
    opacity: 0.45;
  }
}
@media (prefers-reduced-motion: reduce) {
  .step.running .step-icon,
  .thinking-line {
    animation: none;
  }
}
</style>
