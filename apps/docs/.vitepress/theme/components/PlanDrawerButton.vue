<script setup lang="ts">
import { computed } from 'vue';
import { drawerLink, formatMm, planDrawer } from '@/shared/plan/drawerPlan';
import { APP_URL } from '../../navigation';

const props = defineProps<{
  width: string;
  depth: string;
  height?: string;
  name?: string;
}>();

const size = computed(() => ({
  widthMm: Number(props.width),
  depthMm: Number(props.depth),
  ...(props.height === undefined ? {} : { heightMm: Number(props.height) }),
}));

// A wrong size on a page fails the build, not a reader's click.
const plan = computed(() => {
  const result = planDrawer(size.value);
  if (result === null)
    throw new Error(`<PlanDrawerButton>: the app refuses ${props.width} × ${props.depth} mm`);
  return result;
});

const drawerMm = computed(() =>
  [size.value.widthMm, size.value.depthMm, size.value.heightMm]
    .filter((v): v is number => v !== undefined)
    .map(formatMm)
    .join(' × ')
);
</script>

<template>
  <div class="docs-plan-drawer">
    <a
      class="docs-plan-drawer-button"
      :href="drawerLink(APP_URL, size, { name })"
      target="_blank"
      rel="noopener"
    >
      Plan this drawer
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M6 3.5H3.5v9h9V10M9 3.5h3.5V7M12.5 3.5 7 9" />
      </svg>
      <span class="visually-hidden">(opens the layout editor in a new tab)</span>
    </a>
    <span class="docs-plan-drawer-hint">
      Opens the layout editor with a new layout for a {{ drawerMm }} mm drawer: a grid of
      {{ plan.grid.width }} × {{ plan.grid.depth }} grid units of 42 mm.
    </span>
  </div>
</template>
