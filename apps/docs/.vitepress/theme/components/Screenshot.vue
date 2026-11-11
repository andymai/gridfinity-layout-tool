<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useData } from 'vitepress';
import { mediaEntry, mediaUrl } from '../media';
import type { Theme } from '../media';

const props = defineProps<{ id: string; alt: string; spec?: string }>();

const THEMES: Theme[] = ['light', 'dark'];
const { isDark } = useData();
const entry = mediaEntry(props.id);
const theme = computed<Theme>(() => (isDark.value ? 'dark' : 'light'));
const src = (t: Theme, ext: 'webp' | 'mp4'): string => mediaUrl(props.id, t, ext);

// Wider than the docs column, so the page shows it smaller than it was framed.
const zoomable = (entry?.width ?? 0) > 688;
const dialog = ref<HTMLDialogElement | null>(null);

function zoom(event: MouseEvent): void {
  const frame = event.currentTarget as HTMLElement;
  // Already at full size: nothing larger to show.
  if (!entry || frame.clientWidth >= entry.width - 2) return;
  dialog.value?.showModal();
}

// Server-rendered pages cannot know the reader's theme, so a clip renders
// its two posters until the page mounts, then one video for the theme.
const mounted = ref(false);
const video = ref<HTMLVideoElement | null>(null);
const playing = ref(false);
const pausedByReader = ref(false);
let inView = false;
let observer: IntersectionObserver | null = null;

function sync(): void {
  const v = video.value;
  if (!v) return;
  if (inView && !pausedByReader.value) v.play().catch(() => (playing.value = false));
  else v.pause();
}

function toggle(): void {
  pausedByReader.value = playing.value;
  if (playing.value) video.value?.pause();
  else video.value?.play().catch(() => (playing.value = false));
}

watch(video, (now, before) => {
  if (before) observer?.unobserve(before);
  if (now) observer?.observe(now);
});

onMounted(() => {
  if (entry?.kind !== 'clip') return;
  observer = new IntersectionObserver(
    ([e]) => {
      inView = Boolean(e?.isIntersecting);
      sync();
    },
    { threshold: 0.5 }
  );
  mounted.value = true;
});

onBeforeUnmount(() => observer?.disconnect());
</script>

<template>
  <figure v-if="entry" class="docs-figure" :style="{ maxWidth: `${entry.width}px` }">
    <template v-if="entry.kind === 'still'">
      <component
        :is="zoomable ? 'button' : 'div'"
        :type="zoomable ? 'button' : undefined"
        class="docs-figure-frame"
        :class="{ 'docs-figure-zoom': zoomable }"
        :aria-label="zoomable ? `${alt} Open at full size.` : undefined"
        @click="zoomable && zoom($event)"
      >
        <img
          v-for="t in THEMES"
          :key="t"
          :class="`docs-only-${t}`"
          :src="src(t, 'webp')"
          :alt="zoomable ? '' : alt"
          :width="entry.width"
          :height="entry.height"
          loading="lazy"
          decoding="async"
        />
      </component>
      <dialog
        v-if="zoomable"
        ref="dialog"
        class="docs-figure-dialog"
        :aria-label="alt"
        @click="dialog?.close()"
      >
        <img :src="src(theme, 'webp')" :alt="alt" :width="entry.width" :height="entry.height" />
      </dialog>
    </template>
    <div v-else class="docs-figure-frame docs-clip">
      <video
        v-if="mounted"
        :key="theme"
        ref="video"
        :poster="src(theme, 'webp')"
        :width="entry.width"
        :height="entry.height"
        :aria-label="alt"
        muted
        loop
        playsinline
        preload="none"
        @play="playing = true"
        @pause="playing = false"
      >
        <source :src="src(theme, 'mp4')" type="video/mp4" />
      </video>
      <template v-else>
        <img
          v-for="t in THEMES"
          :key="t"
          :class="`docs-only-${t}`"
          :src="src(t, 'webp')"
          :alt="alt"
          :width="entry.width"
          :height="entry.height"
          loading="lazy"
          decoding="async"
        />
      </template>
      <button
        v-if="mounted"
        type="button"
        class="docs-clip-toggle"
        :aria-label="playing ? 'Pause the clip' : 'Play the clip'"
        @click="toggle"
      >
        <svg v-if="playing" viewBox="0 0 16 16" aria-hidden="true">
          <rect x="3.5" y="2.5" width="3" height="11" rx="1" />
          <rect x="9.5" y="2.5" width="3" height="11" rx="1" />
        </svg>
        <svg v-else viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4.5 2.8v10.4a.8.8 0 0 0 1.2.7l8.3-5.2a.8.8 0 0 0 0-1.4L5.7 2.1a.8.8 0 0 0-1.2.7Z" />
        </svg>
      </button>
    </div>
  </figure>
  <figure v-else class="docs-figure docs-figure-pending" role="img" :aria-label="alt">
    <strong>Screenshot to come:</strong> {{ alt }}
    <small>{{ spec }}</small>
  </figure>
</template>
