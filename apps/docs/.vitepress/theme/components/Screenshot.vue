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

// A still the page shows smaller than it was captured, on any screen, opens
// at full size on click.
const frame = ref<HTMLElement | null>(null);
const zoomable = ref(false);
const dialog = ref<HTMLDialogElement | null>(null);
let resizeObserver: ResizeObserver | null = null;

// Server-rendered pages cannot know the reader's theme, so a clip renders
// its two posters until the page mounts, then one video for the theme.
const mounted = ref(false);
const video = ref<HTMLVideoElement | null>(null);
const playing = ref(false);
const wantsPlay = ref(true);
let inView = false;
let intersectionObserver: IntersectionObserver | null = null;

function sync(): void {
  const v = video.value;
  if (!v) return;
  if (inView && wantsPlay.value) v.play().catch(() => (playing.value = false));
  else v.pause();
}

function toggle(): void {
  wantsPlay.value = !playing.value;
  sync();
}

watch(video, (now, before) => {
  if (before) intersectionObserver?.unobserve(before);
  if (now) intersectionObserver?.observe(now);
});

onMounted(() => {
  if (entry?.kind === 'still') {
    const measure = (): void => {
      zoomable.value = (frame.value?.clientWidth ?? entry.width) < entry.width - 2;
    };
    resizeObserver = new ResizeObserver(measure);
    if (frame.value) resizeObserver.observe(frame.value);
    measure();
    return;
  }
  if (entry?.kind !== 'clip') return;
  // No autoplay for a reader who asked their device for less motion; the
  // play button still starts the clip.
  wantsPlay.value = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  intersectionObserver = new IntersectionObserver(
    ([e]) => {
      inView = Boolean(e?.isIntersecting) && (e?.intersectionRatio ?? 0) >= 0.5;
      sync();
    },
    { threshold: [0, 0.5, 1] }
  );
  mounted.value = true;
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  intersectionObserver?.disconnect();
});
</script>

<template>
  <figure v-if="entry" class="docs-figure" :style="{ maxWidth: `${entry.width}px` }">
    <template v-if="entry.kind === 'still'">
      <div ref="frame" class="docs-figure-frame">
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
        <button
          v-if="zoomable"
          type="button"
          class="docs-figure-zoom"
          aria-label="Open the picture at full size"
          @click="dialog?.showModal()"
        />
      </div>
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
