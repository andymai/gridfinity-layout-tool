<script setup lang="ts">
import { computed } from 'vue';
import { useData } from 'vitepress';
import { sidebar } from '../../navigation';

const { page } = useData();

const chapter = computed(() => {
  const path = page.value.relativePath.replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, '');
  const link = `/${path}`;
  return sidebar.find((group) => group.items?.some((item) => item.link === link))?.text;
});
</script>

<template>
  <p v-if="chapter" class="docs-chapter">{{ chapter }}</p>
</template>
