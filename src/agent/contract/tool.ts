import type { PlanView } from './planLayout';

/** What every tool handler gets from the door that runs it. */
export interface ToolContext {
  /** The app origin that links in a result point to. */
  readonly origin: string;
}

export interface ToolOutput {
  readonly isError: boolean;
  /** Text for the model. */
  readonly content: string;
}

export interface DrawerFitOutput extends ToolOutput {
  /** The `?drawer=` link, or null when nothing fits. Kept out of `content`: each door decides whether the model sees it. */
  readonly drawerLink: string | null;
}

export interface PlanLayoutOutput extends ToolOutput {
  readonly plan: PlanView | null;
}
