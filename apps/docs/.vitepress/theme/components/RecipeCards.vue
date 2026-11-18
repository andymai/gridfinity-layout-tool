<script setup lang="ts">
import { computed } from 'vue';
import { useData, withBase } from 'vitepress';
import { mediaEntry, mediaUrl } from '../media';
import type { Theme } from '../media';
import { data as recipes } from '../recipes.data';

const THEMES: Theme[] = ['light', 'dark'];
const { page } = useData();

// On a recipe page, the cards list the other recipes.
const shown = computed(() =>
  recipes.filter((r) => `${r.link.slice(1)}.md` !== page.value.relativePath)
);
</script>

<template>
  <ul class="docs-recipes">
    <li v-for="r in shown" :key="r.link">
      <a :href="withBase(r.link)">
        <span
          v-if="mediaEntry(r.heroId)"
          class="docs-recipes-image"
          :style="r.card ? { '--card-zoom': r.card.zoom, '--card-focus': r.card.focus } : undefined"
        >
          <img
            v-for="t in THEMES"
            :key="t"
            :class="`docs-only-${t}`"
            :src="mediaUrl(r.heroId, t, 'webp')"
            alt=""
            loading="lazy"
            decoding="async"
          />
        </span>
        <span class="docs-recipes-title">{{ r.title }}</span>
        <span class="docs-recipes-text">{{ r.description }}</span>
      </a>
    </li>
  </ul>
</template>
