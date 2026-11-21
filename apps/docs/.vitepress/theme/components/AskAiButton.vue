<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import { askAi, checkAvailability, setOpen } from '../askAi/useAskAi';

// Here and not in the panel: the panel mounts only on the first open.
function onKey(event: KeyboardEvent): void {
  if (!askAi.available || event.altKey || !(event.metaKey || event.ctrlKey)) return;
  if (event.key.toLowerCase() !== 'i') return;
  event.preventDefault();
  setOpen(!askAi.open);
}

onMounted(() => {
  void checkAvailability(window.location.search);
  window.addEventListener('keydown', onKey);
});
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<template>
  <button
    v-if="askAi.available"
    id="ask-ai-button"
    class="ask-ai-button"
    type="button"
    aria-controls="ask-ai-panel"
    :aria-expanded="askAi.open"
    title="Ask AI (Ctrl+I)"
    @click="setOpen(!askAi.open)"
  >
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 1.5l1.6 4.2 4.4 1.3-4.4 1.3L8 12.5 6.4 8.3 2 7l4.4-1.3z" />
    </svg>
    Ask AI
  </button>
</template>

<style scoped>
.ask-ai-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: 12px;
  padding: 0 12px;
  height: 32px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 16px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  transition:
    border-color 0.2s,
    background-color 0.2s;
}
.ask-ai-button:hover,
.ask-ai-button[aria-expanded='true'] {
  border-color: var(--vp-c-brand-1);
}
.ask-ai-button svg {
  width: 14px;
  height: 14px;
  fill: var(--vp-c-brand-1);
}
</style>
