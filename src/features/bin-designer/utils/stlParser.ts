/**
 * Re-export shared STL parser for bin-designer backward compatibility.
 *
 * The canonical implementation lives in @/shared/generation/stlParser.
 */

export { parseSTLBinary } from '@/shared/generation/stlParser';
export type { ParsedSTLMesh } from '@/shared/generation/stlParser';
