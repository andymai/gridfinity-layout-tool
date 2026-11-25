export { planInput as planLayoutInput } from '@/shared/plan/planInput';
export type { PlanInput as PlanLayoutInput } from '@/shared/plan/planInput';

/** What a panel draws for a plan: the grid, the bins on it, and the stash. */
export interface PlanView {
  /** The name that an answer writes as `[[plan:handle]]`. */
  readonly handle: string;
  readonly title: string;
  readonly grid: { readonly width: number; readonly depth: number };
  readonly bins: readonly {
    readonly label: string;
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly depth: number;
    readonly layer: number;
    readonly color: string;
  }[];
  readonly stashed: readonly { readonly label: string; readonly reason: string }[];
  readonly link: string;
}
