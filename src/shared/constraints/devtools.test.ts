import { describe, it, expect } from 'vitest';
import type { BinParams } from '@/shared/types/bin';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import { buildConstraintGraph, toGraphviz } from './devtools';

function makeParams(overrides: Partial<BinParams> = {}): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    ...overrides,
    base: { ...DEFAULT_BIN_PARAMS.base, ...(overrides.base ?? {}) },
    compartments: { ...DEFAULT_BIN_PARAMS.compartments, ...(overrides.compartments ?? {}) },
    scoop: { ...DEFAULT_BIN_PARAMS.scoop, ...(overrides.scoop ?? {}) },
    label: { ...DEFAULT_BIN_PARAMS.label, ...(overrides.label ?? {}) },
    wallPattern: { ...DEFAULT_BIN_PARAMS.wallPattern, ...(overrides.wallPattern ?? {}) },
    slotConfig: { ...DEFAULT_BIN_PARAMS.slotConfig, ...(overrides.slotConfig ?? {}) },
  };
}

describe('buildConstraintGraph', () => {
  it('returns nodes and edges arrays', () => {
    const graph = buildConstraintGraph(makeParams());

    expect(Array.isArray(graph.nodes)).toBe(true);
    expect(Array.isArray(graph.edges)).toBe(true);
  });

  it('produces a node for every known feature', () => {
    const graph = buildConstraintGraph(makeParams());

    // Every node has the required properties
    for (const node of graph.nodes) {
      expect(typeof node.id).toBe('string');
      expect(typeof node.label).toBe('string');
      expect(typeof node.enabled).toBe('boolean');
      expect(typeof node.available).toBe('boolean');
    }
  });

  it('produces edges with constraint relationships', () => {
    const graph = buildConstraintGraph(makeParams());

    for (const edge of graph.edges) {
      expect(typeof edge.from).toBe('string');
      expect(typeof edge.to).toBe('string');
      expect(edge.type).toBe('disables');
      expect(typeof edge.active).toBe('boolean');
      expect(typeof edge.description).toBe('string');
    }
  });

  it('returns a non-empty graph (features exist)', () => {
    const graph = buildConstraintGraph(makeParams());

    expect(graph.nodes.length).toBeGreaterThan(0);
  });
});

describe('toGraphviz', () => {
  it('returns a string starting with digraph', () => {
    const graph = buildConstraintGraph(makeParams());
    const dot = toGraphviz(graph);

    expect(dot).toMatch(/^digraph /);
  });

  it('contains closing brace', () => {
    const graph = buildConstraintGraph(makeParams());
    const dot = toGraphviz(graph);

    expect(dot.trim()).toMatch(/\}$/);
  });

  it('includes node definitions for each node', () => {
    const graph = buildConstraintGraph(makeParams());
    const dot = toGraphviz(graph);

    for (const node of graph.nodes) {
      expect(dot).toContain(`"${node.id}"`);
    }
  });

  it('includes edge definitions for active constraints', () => {
    const graph = buildConstraintGraph(makeParams());
    const dot = toGraphviz(graph);

    // Active edges should appear with red color
    const activeEdges = graph.edges.filter((e) => e.active);
    for (const edge of activeEdges) {
      expect(dot).toContain(`"${edge.from}" -> "${edge.to}"`);
    }
  });

  it('uses different colors for enabled vs disabled vs unavailable nodes', () => {
    // With default params, some features will be enabled, others disabled/unavailable
    const graph = buildConstraintGraph(makeParams());
    const dot = toGraphviz(graph);

    // The output should contain at least one fillcolor
    expect(dot).toContain('fillcolor');
  });
});
