import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import {
  binSizeForInput,
  drawerFitInput,
  planLayoutInput,
  printEstimateInput,
  runBinSizeFor,
  runDrawerFit,
  runPlanLayout,
  runPrintEstimate,
  runSplitPlan,
  splitPlanInput,
} from '../agent/index.js';
import type { ToolOutput } from '../agent/index.js';

export const MCP_TOOL_NAMES: ReadonlySet<string> = new Set([
  'drawer_fit',
  'plan_layout',
  'split_plan',
  'bin_size_for',
  'print_estimate',
]);

// Every tool computes from its input with the app's own code and keeps nothing.
const COMPUTE = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

export const SERVER_INSTRUCTIONS =
  "Tools that plan Gridfinity drawer organizers with the Gridfinity Layout Tool's own code (https://gridfinitylayouttool.com). They keep nothing: a plan comes back with a link that opens it in the app. Measure a drawer with drawer_fit, size bins from what they hold (bin_size_for gives common sizes), then plan_layout. The Agent Skill at https://raw.githubusercontent.com/andymai/gridfinity-layout-tool/main/skills/gridfinity-layout-tool/SKILL.md gives the whole workflow. The docs are at https://gridfinitylayouttool.com/docs, and https://gridfinitylayouttool.com/docs/llms.txt lists their pages.";

function asResult(output: ToolOutput): CallToolResult {
  return {
    content: [{ type: 'text', text: output.content }],
    ...(output.isError ? { isError: true } : {}),
  };
}

export function createMcpServer(origin: string, version: string): McpServer {
  const server = new McpServer(
    { name: 'gridfinity-layout-tool', title: 'Gridfinity Layout Tool', version },
    { instructions: SERVER_INSTRUCTIONS }
  );
  const context = { origin };

  server.registerTool(
    'drawer_fit',
    {
      title: 'Fit a drawer',
      description:
        "Run the Layout Tool's drawer calculator. Give the inside width and depth of a drawer, and its height when known. Returns the grid of 42 mm units that fits, a tighter half-unit grid when one fits, the spare room, the tallest bins for stacks of 1, 2 and 3, and a link that opens the layout editor at that size.",
      inputSchema: drawerFitInput,
      annotations: COMPUTE,
    },
    (input) => {
      const run = runDrawerFit(input, context);
      return asResult(
        run.drawerLink === null
          ? run
          : { ...run, content: `${run.content}\nPlan this drawer in the app: ${run.drawerLink}` }
      );
    }
  );

  server.registerTool(
    'plan_layout',
    {
      title: 'Plan a drawer',
      description:
        "Plan a whole drawer with the Layout Tool's placement code. Give the measured drawer, or a grid size when there is no measurement, and a bin for each kind of thing to store, in grid units of 42 mm and height units of 7 mm. The app fits the grid, places the bins largest first, puts a bin on layer 2 only where bins below carry it, and sends bins that do not fit to the stash. Returns what it placed and stashed, and a link that opens the plan in the app. The bin sizes are your choice, so present them as a starting point.",
      inputSchema: planLayoutInput,
      annotations: COMPUTE,
    },
    (input): CallToolResult => {
      const run = runPlanLayout(input, context);
      if (run.isError || run.plan === null) return asResult(run);
      return {
        content: [
          { type: 'text', text: run.content },
          {
            type: 'resource_link',
            uri: run.plan.link,
            name: run.plan.title,
            title: `Open “${run.plan.title}” in the Gridfinity Layout Tool`,
            mimeType: 'text/html',
          },
        ],
      };
    }
  );

  server.registerTool(
    'split_plan',
    {
      title: 'Split a baseplate',
      description:
        "Split a baseplate for a print bed with the baseplate generator's own planner. Give the grid in units and the bed size. Returns whether the default plate prints in one piece, or its pieces, columns, rows and bed loads.",
      inputSchema: splitPlanInput,
      annotations: COMPUTE,
    },
    (input) => asResult(runSplitPlan(input))
  );

  server.registerTool(
    'bin_size_for',
    {
      title: 'Common bin sizes',
      description:
        'Look up the bin size that makers most often gave bins with each label in the Layout Tool, such as "M3 screws". It is a habit, not a fact about the item: use it as a starting point, and size from the item when a label has no common size.',
      inputSchema: binSizeForInput,
      annotations: COMPUTE,
    },
    (input) => asResult(runBinSizeFor(input))
  );

  server.registerTool(
    'print_estimate',
    {
      title: 'Estimate a print',
      description:
        "Estimate filament, print time and filament cost for standard bins with the bin designer's own estimate. Give each bin's size in grid units and height units, and a count. The baseplate is not included.",
      inputSchema: printEstimateInput,
      annotations: COMPUTE,
    },
    (input) => asResult(runPrintEstimate(input))
  );

  return server;
}
