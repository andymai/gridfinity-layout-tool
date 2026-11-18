<script setup lang="ts">
import { computed, ref, useId } from 'vue';
import { withBase } from 'vitepress';
import {
  MAX_DRAWER_MM,
  MIN_DRAWER_MM,
  MM_PER_INCH,
  drawerLink,
  formatMm,
  planDrawer,
  toMm,
} from '../drawerPlan';
import type { StackFit } from '../drawerPlan';

type Unit = 'mm' | 'in';
const UNITS: readonly Unit[] = ['mm', 'in'];

const props = withDefaults(defineProps<{ width?: string; depth?: string; height?: string }>(), {
  width: '400',
  depth: '300',
  height: '80',
});

const id = useId();
const unit = ref<Unit>('mm');
const width = ref(props.width);
const depth = ref(props.depth);
const height = ref(props.height);

function parse(value: string): number | undefined {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) && n > 0 ? toMm(n, unit.value) : undefined;
}

// A unit switch keeps the same drawer: the fields convert in place. Three
// places of an inch hold a size to the 0.1 mm that a drawer link carries.
function setUnit(next: Unit): void {
  if (next === unit.value) return;
  const places = next === 'in' ? 1000 : 10;
  const convert = (value: string): string => {
    const n = Number.parseFloat(value);
    if (!Number.isFinite(n)) return value;
    const out = next === 'in' ? n / MM_PER_INCH : n * MM_PER_INCH;
    return String(Math.round(out * places) / places);
  };
  width.value = convert(width.value);
  depth.value = convert(depth.value);
  height.value = convert(height.value);
  unit.value = next;
}

const size = computed(() => {
  const widthMm = parse(width.value);
  const depthMm = parse(depth.value);
  const heightMm = parse(height.value);
  if (widthMm === undefined || depthMm === undefined) return null;
  return { widthMm, depthMm, ...(heightMm === undefined ? {} : { heightMm }) };
});

const plan = computed(() => (size.value === null ? null : planDrawer(size.value)));

const range = computed(() =>
  unit.value === 'mm'
    ? `${MIN_DRAWER_MM} to ${MAX_DRAWER_MM} mm`
    : `${(MIN_DRAWER_MM / MM_PER_INCH).toFixed(2)} to ${(MAX_DRAWER_MM / MM_PER_INCH).toFixed(1)} in`
);

const drawerMm = computed(() =>
  size.value === null
    ? ''
    : [size.value.widthMm, size.value.depthMm, size.value.heightMm]
        .filter((v): v is number => v !== undefined)
        .map(formatMm)
        .join(' × ')
);

const STACK_NAMES = ['One bin', 'Two stacked', 'Three stacked'];
function stackLine(s: StackFit): string {
  const units = s.count > 1 ? `${s.units}u each` : `${s.units}u`;
  return `${STACK_NAMES[s.count - 1]}: ${units}, ${formatMm(s.totalMm)} mm tall`;
}

const measuredFitPage = withBase('/layouts/drawer-setup#fit-the-grid-to-a-measured-drawer');
</script>

<template>
  <section class="docs-calc" :aria-labelledby="`${id}-title`">
    <div class="docs-calc-head">
      <p :id="`${id}-title`" class="docs-calc-title">Try your drawer</p>
      <fieldset class="docs-calc-units">
        <legend class="visually-hidden">Unit</legend>
        <label v-for="u in UNITS" :key="u">
          <input
            type="radio"
            :name="`${id}-unit`"
            :value="u"
            :checked="unit === u"
            @change="setUnit(u)"
          />
          <span>{{ u }}</span>
        </label>
      </fieldset>
    </div>

    <div class="docs-calc-fields">
      <label>
        <span>Width</span>
        <input v-model="width" type="number" inputmode="decimal" min="0" step="any" />
      </label>
      <label>
        <span>Depth</span>
        <input v-model="depth" type="number" inputmode="decimal" min="0" step="any" />
      </label>
      <label>
        <span>Height <small>(optional)</small></span>
        <input v-model="height" type="number" inputmode="decimal" min="0" step="any" />
      </label>
    </div>

    <div class="docs-calc-result" aria-live="polite">
      <p v-if="size === null" class="docs-calc-note">Type the width and depth of the drawer.</p>
      <p v-else-if="plan === null" class="docs-calc-note">
        The width and the depth must each be from {{ range }}.
      </p>
      <dl v-else>
        <div v-if="unit === 'in'">
          <dt>In millimeters</dt>
          <dd>{{ drawerMm }} mm</dd>
        </div>
        <div>
          <dt>Grid</dt>
          <dd>
            <strong>{{ plan.grid.width }} × {{ plan.grid.depth }}</strong> grid units,
            {{ formatMm(plan.grid.gridWidthMm) }} × {{ formatMm(plan.grid.gridDepthMm) }} mm
          </dd>
        </div>
        <div>
          <dt>Free space</dt>
          <dd>
            {{ formatMm(plan.grid.freeWidthMm) }} mm across,
            {{ formatMm(plan.grid.freeDepthMm) }} mm front to back
          </dd>
        </div>
        <div v-if="plan.half">
          <dt>Half units</dt>
          <dd>
            {{ plan.half.width }} × {{ plan.half.depth }} grid units fit tighter, with
            {{ formatMm(plan.half.freeWidthMm) }} mm across and
            {{ formatMm(plan.half.freeDepthMm) }} mm front to back. The link opens whole units, so
            for this fit, <a :href="measuredFitPage">enter the size in the layout editor</a>.
          </dd>
        </div>
        <div v-if="plan.stacks.length > 0">
          <dt>Tallest bins</dt>
          <dd>
            <ul>
              <li v-for="s in plan.stacks" :key="s.count">{{ stackLine(s) }}</li>
            </ul>
          </dd>
        </div>
      </dl>
    </div>

    <div v-if="size !== null && plan !== null" class="docs-calc-actions">
      <a class="docs-plan-drawer-button" :href="drawerLink(size)" target="_blank" rel="noopener">
        Plan this drawer
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M6 3.5H3.5v9h9V10M9 3.5h3.5V7M12.5 3.5 7 9" />
        </svg>
        <span class="visually-hidden">(opens the layout editor in a new tab)</span>
      </a>
      <a
        class="docs-calc-secondary"
        :href="drawerLink(size, { tool: 'baseplate' })"
        target="_blank"
        rel="noopener"
      >
        Make its baseplate
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M6 3.5H3.5v9h9V10M9 3.5h3.5V7M12.5 3.5 7 9" />
        </svg>
        <span class="visually-hidden">(opens the baseplate generator in a new tab)</span>
      </a>
    </div>
  </section>
</template>
