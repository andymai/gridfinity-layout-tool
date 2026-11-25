// The agent tool layer from src/agent, bundled by scripts/build-agent-server.ts
// because api/ cannot resolve the app's `@/` imports. Vitest aliases the
// generated file to the source.
export {
  drawerFitInput,
  planLayoutInput,
  runDrawerFit,
  runPlanLayout,
} from './_generated/server.js';
export type {
  DrawerFitInput,
  PlanLayoutInput,
  PlanLayoutOutput,
  PlanView,
  ToolContext,
  ToolOutput,
} from './_generated/server.js';
