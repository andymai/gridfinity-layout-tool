// The agent tool layer from src/agent, bundled by scripts/build-agent-server.ts
// because api/ cannot resolve the app's `@/` imports. Vitest aliases the
// generated file to the source.
export {
  READER_TOOL_NAMES,
  drawerFitInput,
  formatMyLayouts,
  formatMySettings,
  formatReadMyLayout,
  listMyLayoutsInput,
  myLayoutsData,
  mySettingsData,
  planLayoutInput,
  readMyLayoutData,
  readMyLayoutInput,
  readMySettingsInput,
  runDrawerFit,
  runPlanLayout,
} from './_generated/server.js';
export type {
  DrawerFitInput,
  MyLayoutsData,
  MySettingsData,
  PlanLayoutInput,
  PlanLayoutOutput,
  PlanView,
  ReadMyLayoutData,
  ReaderToolName,
  ToolContext,
  ToolOutput,
} from './_generated/server.js';
