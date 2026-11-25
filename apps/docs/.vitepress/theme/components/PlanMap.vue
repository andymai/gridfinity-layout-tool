<script setup lang="ts">
import { computed } from 'vue';
import type { PlanView } from '@/agent/contract';
import { FONT, planCaption, planMapView } from '../askAi/planMap';

const props = defineProps<{ plan: PlanView }>();

const map = computed(() => planMapView(props.plan));
const caption = computed(() => planCaption(props.plan));
</script>

<template>
  <figure class="plan-map">
    <svg
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
    <a class="open" :href="plan.link" target="_blank" rel="noopener">Open in the layout editor</a>
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
svg {
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
.open {
  display: inline-block;
  margin-top: 10px;
  padding: 6px 12px;
  border-radius: 8px;
  background: var(--vp-c-brand-3);
  color: var(--vp-c-white);
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
}
.open:hover {
  background: var(--vp-c-brand-2);
}
</style>
