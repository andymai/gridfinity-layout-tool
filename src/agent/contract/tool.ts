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
