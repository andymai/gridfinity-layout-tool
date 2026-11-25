<script setup lang="ts">
import { computed } from 'vue';
import type { PlanView } from '@/agent/contract';

const props = defineProps<{ plan: PlanView }>();

// Viewbox units per grid unit. A label character is about 0.55 of the font size.
const CELL = 24;
const FONT = 8;

const width = computed(() => props.plan.grid.width * CELL);
const height = computed(() => props.plan.grid.depth * CELL);

// A label that does not fit keeps its first word ("M3" of "M3 screws") before
// it is cut short.
function fitLabel(label: string, chars: number): string {
  if (label.length <= chars) return label;
  const first = label.split(/\s+/)[0];
  if (first.length <= chars) return first;
  return chars >= 2 ? `${label.slice(0, chars - 1).trimEnd()}…` : '';
}

// The grid's origin is the front-left corner, so the front of the drawer is at
// the bottom of the map, as in the layout editor.
const bins = computed(() =>
  [...props.plan.bins]
    .sort((a, b) => a.layer - b.layer)
    .map((bin) => {
      const w = bin.width * CELL;
      const h = bin.depth * CELL;
      const fit = Math.max(0, Math.floor((w - 4) / (FONT * 0.55)));
      return {
        ...bin,
        px: bin.x * CELL,
        py: (props.plan.grid.depth - bin.y - bin.depth) * CELL,
        w,
        h,
        text: fitLabel(bin.label, fit),
      };
    })
);

const gridLines = computed(() => ({
  x: Array.from({ length: Math.floor(props.plan.grid.width) - 1 }, (_, i) => (i + 1) * CELL),
  y: Array.from({ length: Math.floor(props.plan.grid.depth) - 1 }, (_, i) => (i + 1) * CELL),
}));

const caption = computed(() => {
  const parts = [
    `${props.plan.grid.width} × ${props.plan.grid.depth} units`,
    `${props.plan.bins.length} ${props.plan.bins.length === 1 ? 'bin' : 'bins'}`,
  ];
  if (props.plan.stashed.length > 0) parts.push(`${props.plan.stashed.length} in the stash`);
  return parts.join(' · ');
});
</script>

<template>
  <figure class="plan-map">
    <svg
      :viewBox="`-1 -1 ${width + 2} ${height + 2}`"
      role="img"
      :aria-label="`${plan.title}: ${caption}`"
    >
      <rect class="floor" :width="width" :height="height" />
      <line
        v-for="x in gridLines.x"
        :key="`x${x}`"
        class="grid"
        :x1="x"
        :x2="x"
        y1="0"
        :y2="height"
      />
      <line
        v-for="y in gridLines.y"
        :key="`y${y}`"
        class="grid"
        x1="0"
        :x2="width"
        :y1="y"
        :y2="y"
      />
      <g v-for="(bin, i) in bins" :key="i" :class="['bin', { upper: bin.layer > 1 }]">
        <rect
          :x="bin.px + 1"
          :y="bin.py + 1"
          :width="bin.w - 2"
          :height="bin.h - 2"
          rx="3"
          :fill="bin.color"
        />
        <text
          v-if="bin.text"
          :x="bin.px + bin.w / 2"
          :y="bin.py + bin.h / 2"
          :font-size="FONT"
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
  fill: #1b1b1f;
  font-family: var(--vp-font-family-base);
  pointer-events: none;
}
.bin.upper rect {
  fill-opacity: 0.55;
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
