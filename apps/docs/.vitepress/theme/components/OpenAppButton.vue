<script setup lang="ts">
import { APP_URL } from '../../navigation';
</script>

<template>
  <!-- The app shares the docs' origin, so without a target the VitePress router
       takes the click as a docs page. -->
  <a class="docs-open-app" :href="`${APP_URL}/`" target="_self" aria-label="Open the app">
    <span class="docs-open-app-long">Open the app</span>
    <span class="docs-open-app-short">App</span>
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" />
    </svg>
  </a>
</template>
