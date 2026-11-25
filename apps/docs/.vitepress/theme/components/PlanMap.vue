<script setup lang="ts">
import { computed } from 'vue';
import type { PlanView } from '@/agent/contract';
import { FONT, planCaption, planDescription, planMapView } from '../askAi/planMap';

const props = defineProps<{ plan: PlanView }>();

const map = computed(() => planMapView(props.plan));
const caption = computed(() => planCaption(props.plan));
const description = computed(() => planDescription(props.plan));
</script>

<template>
  <figure class="plan-map">
    <svg
      class="map"
      :viewBox="`-1 -1 ${map.width + 2} ${map.height + 2}`"
      role="img"
      :aria-label="`${plan.title}: ${caption}`"
    >
      <rect class="floor" :width="map.width" :height="map.height" />
      <line
        v-for="x in map.columns"
        :key="`x${x}`"
        class="grid"
        :x1="x"
        :x2="x"
        y1="0"
        :y2="map.height"
      />
      <line
        v-for="y in map.rows"
        :key="`y${y}`"
        class="grid"
        x1="0"
        :x2="map.width"
        :y1="y"
        :y2="y"
      />
      <g v-for="bin in map.bins" :key="bin.key" :class="['bin', { upper: bin.upper }]">
        <rect
          :x="bin.x + 1"
          :y="bin.y + 1"
          :width="bin.w - 2"
          :height="bin.h - 2"
          rx="3"
          :fill="bin.color"
        />
        <!-- The halo in the bin's own color keeps a label readable on a see-through upper bin. -->
        <text
          v-if="bin.text"
          :x="bin.x + bin.w / 2"
          :y="bin.y + bin.h / 2"
          :font-size="FONT"
          :fill="bin.textColor"
          :stroke="bin.color"
          text-anchor="middle"
          dominant-baseline="central"
        >
          {{ bin.text }}
        </text>
      </g>
    </svg>
    <figcaption>
      <span class="title">{{ plan.title }}</span>
      <span class="meta">{{ caption }}</span>
    </figcaption>
    <ul class="visually-hidden">
      <li v-for="(line, i) in description" :key="i">{{ line }}</li>
    </ul>
    <a class="docs-plan-drawer-button open" :href="plan.link" target="_blank" rel="noopener">
      Open in the layout editor
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M6 3.5H3.5v9h9V10M9 3.5h3.5V7M12.5 3.5 7 9" />
      </svg>
      <span class="visually-hidden">(opens the layout editor in a new tab)</span>
    </a>
  </figure>
</template>

<style scoped>
.plan-map {
  margin: 12px 0;
  padding: 12px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  background: var(--vp-c-bg-soft);
}
.map {
  display: block;
  width: 100%;
  height: auto;
  max-height: 320px;
}
.floor {
  fill: var(--vp-c-bg);
  stroke: var(--vp-c-divider);
}
.grid {
  stroke: var(--vp-c-divider);
  stroke-width: 0.5;
}
.bin text {
  font-family: var(--vp-font-family-base);
  paint-order: stroke;
  stroke-width: 2px;
  stroke-linejoin: round;
  pointer-events: none;
}
.bin.upper rect {
  fill-opacity: 0.85;
  stroke: #1b1b1f;
  stroke-dasharray: 3 2;
  stroke-width: 0.75;
}
figcaption {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  margin-top: 8px;
  font-size: 13px;
}
.title {
  font-weight: 600;
  color: var(--vp-c-text-1);
}
.meta {
  color: var(--vp-c-text-2);
}
/* Beats the answer's own link rule, which colors every link in it. */
.plan-map a.open,
.plan-map a.open:hover {
  margin-top: 10px;
  color: var(--vp-button-brand-text);
  text-decoration: none;
}
</style>
