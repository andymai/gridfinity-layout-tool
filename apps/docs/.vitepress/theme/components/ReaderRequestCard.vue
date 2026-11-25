<script setup lang="ts">
import { computed, useId } from 'vue';
import type { ReaderRequest } from '../askAi/useAskAi';

const props = defineProps<{ request: ReaderRequest }>();
const emit = defineEmits<{ answer: [allow: boolean] }>();

const headingId = useId();
const readable = computed(() => props.request.calls.some((call) => !call.unavailable));
const busy = computed(() => props.request.state !== 'asking');
</script>

<template>
  <section class="reader-request" role="group" :aria-labelledby="headingId">
    <h3 :id="headingId">Ask AI wants to read your saved data</h3>
    <p v-if="request.state === 'loading'" class="hint">Reading your data in this browser…</p>
    <template v-else>
      <p class="hint">To answer, it needs this from the Layout Tool in this browser:</p>
      <ul class="calls">
        <li v-for="call in request.calls" :key="call.id">
          <span class="title">{{ call.title }}</span>
          <span v-if="call.unavailable" class="unavailable">
            This browser could not read it, for example in a private window.
          </span>
          <details v-else-if="call.preview">
            <summary>What it shares</summary>
            <pre>{{ call.preview }}</pre>
          </details>
        </li>
      </ul>
      <p v-if="readable" class="note">
        If you allow it, this goes to Anthropic, which runs the AI model, for this answer only.
        <a href="/docs/introduction/your-data#ask-ai">Your data and privacy</a>
      </p>
      <div class="buttons">
        <template v-if="readable">
          <button type="button" class="allow" :disabled="busy" @click="emit('answer', true)">
            Allow
          </button>
          <button type="button" class="deny" :disabled="busy" @click="emit('answer', false)">
            Don't allow
          </button>
        </template>
        <button v-else type="button" class="deny" :disabled="busy" @click="emit('answer', false)">
          Continue without it
        </button>
      </div>
    </template>
  </section>
</template>

<style scoped>
.reader-request {
  margin: 8px 0 12px;
  padding: 12px 14px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  background: var(--vp-c-bg-soft);
  font-size: 14px;
}
h3 {
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 600;
  color: var(--vp-c-text-1);
}
.hint,
.note {
  margin: 4px 0;
  color: var(--vp-c-text-2);
}
.note {
  font-size: 13px;
}
.note a {
  color: var(--vp-c-brand-1);
  text-decoration: underline;
  text-underline-offset: 2px;
}
.calls {
  margin: 8px 0;
  padding: 0;
  list-style: none;
}
.calls li {
  padding: 6px 0;
  border-top: 1px solid var(--vp-c-divider);
}
.calls li:first-child {
  border-top: none;
}
.title {
  display: block;
  font-weight: 500;
  color: var(--vp-c-text-1);
}
.unavailable {
  display: block;
  font-size: 13px;
  color: var(--vp-c-text-2);
}
details summary {
  cursor: pointer;
  font-size: 13px;
  color: var(--vp-c-text-2);
}
pre {
  max-height: 180px;
  margin: 6px 0 0;
  padding: 8px;
  overflow: auto;
  border-radius: 6px;
  background: var(--vp-c-bg);
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}
.buttons button {
  min-height: 34px;
  padding: 0 14px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
}
.allow {
  background: var(--vp-button-brand-bg);
  color: var(--vp-button-brand-text);
}
.allow:hover:not(:disabled) {
  background: var(--vp-button-brand-hover-bg);
  color: var(--vp-button-brand-hover-text);
}
.deny {
  border: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-1);
}
.deny:hover:not(:disabled) {
  border-color: var(--vp-c-text-3);
}
.buttons button:disabled {
  opacity: 0.6;
  cursor: default;
}
.buttons button:focus-visible {
  outline: 2px solid var(--vp-c-text-1);
  outline-offset: 2px;
}
</style>
