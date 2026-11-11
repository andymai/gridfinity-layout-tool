<script setup lang="ts">
import { ref } from 'vue';
import { withBase } from 'vitepress';

const props = defineProps<{ id: string; alt: string; spec: string }>();
const missing = ref(false);
const src = withBase(`/screenshots/${props.id}.png`);
</script>

<template>
  <figure class="docs-screenshot">
    <img v-if="!missing" :src="src" :alt="alt" loading="lazy" @error="missing = true" />
    <div v-else class="docs-screenshot-pending" role="img" :aria-label="alt">
      <strong>Screenshot to come:</strong> {{ alt }}
      <small>{{ spec }}</small>
    </div>
  </figure>
</template>
