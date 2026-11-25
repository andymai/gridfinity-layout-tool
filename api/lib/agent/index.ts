// The agent tool layer from src/agent, bundled by scripts/build-agent-server.ts
// because api/ cannot resolve the app's `@/` imports. Vitest aliases the
// generated file to the source.
export { drawerFitInput, runDrawerFit } from './_generated/server.js';
export type { DrawerFitInput, ToolContext, ToolOutput } from './_generated/server.js';
