<script setup lang="ts">
import { appTools } from '../../navigation';
</script>

<template>
  <nav class="docs-app-tools" aria-labelledby="docs-app-tools-title">
    <p id="docs-app-tools-title" class="docs-app-tools-title">Back to the app</p>
    <ul>
      <li v-for="tool in appTools" :key="tool.link">
        <a :href="tool.link">
          <span class="docs-app-tools-hint">{{ tool.hint }}</span>
          <span class="docs-app-tools-name">
            {{ tool.text }}
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" />
            </svg>
          </span>
        </a>
      </li>
    </ul>
  </nav>
</template>
