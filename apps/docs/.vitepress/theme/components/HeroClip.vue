<script setup lang="ts">
import { useData } from 'vitepress';
import { mediaEntry } from '../media';
import Screenshot from './Screenshot.vue';

const { frontmatter } = useData();
</script>

<template>
  <div
    v-if="frontmatter.heroClip && mediaEntry(frontmatter.heroClip.id)"
    class="docs-hero-clip"
  >
    <Screenshot :id="frontmatter.heroClip.id" :alt="frontmatter.heroClip.alt" />
  </div>
</template>
