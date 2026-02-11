/**
 * Constraint graph visualization for debugging.
 *
 * Builds an inspectable graph of all constraint relationships,
 * annotated with current feature states. Useful for debugging
 * unexpected disabled states or testing constraint coverage.
 */

import type { BinParams } from '@/shared/types/bin';
import type { ConstraintGraph, GraphNode, GraphEdge, FeatureKey } from './types';
import { FEATURE_MANIFESTS } from './features';
import { CONSTRAINT_RULES } from './rules';
import { getAllFeatureStatuses } from './engine';

/**
 * Build the constraint graph for the given params.
 * Nodes = features, edges = constraint/implication relationships.
 */
export function buildConstraintGraph(params: BinParams): ConstraintGraph {
  const statuses = getAllFeatureStatuses(params);
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  // Build nodes from feature manifests
  for (const [key, manifest] of Object.entries(FEATURE_MANIFESTS)) {
    const status = statuses.get(key as FeatureKey);
    nodes.push({
      id: key as FeatureKey,
      label: manifest.label,
      enabled: status?.enabled ?? false,
      available: status?.available ?? true,
    });
  }

  // Build edges from constraint rules
  for (const rule of CONSTRAINT_RULES) {
    const active = rule.when(params);
    for (const disabled of rule.disables) {
      edges.push({
        from: rule.source,
        to: disabled,
        type: 'disables',
        active,
        description: rule.description,
      });
    }
  }

  // Note: Implication rules are not visualized as edges because they don't
  // have explicit source/target features — they apply arbitrary param transformations.

  return { nodes, edges };
}

/**
 * Export the constraint graph as Graphviz DOT format.
 * Paste into https://dreampuf.github.io/GraphvizOnline/ to visualize.
 */
export function toGraphviz(graph: ConstraintGraph): string {
  const lines = [
    'digraph BinConstraints {',
    '  rankdir=LR;',
    '  node [shape=box, fontname="Helvetica"];',
    '',
  ];

  for (const node of graph.nodes) {
    const color = node.enabled ? 'lightblue' : node.available ? 'white' : '#ffcccc';
    const style = node.enabled ? 'filled,bold' : 'filled';
    lines.push(`  "${node.id}" [label="${node.label}", fillcolor="${color}", style="${style}"];`);
  }

  lines.push('');

  for (const edge of graph.edges) {
    const color = edge.active ? 'red' : 'gray';
    const style = edge.active ? 'solid' : 'dashed';
    lines.push(
      `  "${edge.from}" -> "${edge.to}" [label="${edge.type}", color="${color}", style="${style}"];`
    );
  }

  lines.push('}');
  return lines.join('\n');
}
