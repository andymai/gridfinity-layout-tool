---
title: Use the Layout Tool from an AI assistant
description: 'Connect Claude or another AI assistant to the Layout Tool, so it can fit your drawer, plan the bins, split a baseplate and estimate filament.'
questions:
  - 'How do I connect the Layout Tool to Claude?'
  - 'Can an AI assistant see or change my saved layouts?'
  - 'What does the Agent Skill add to the connector?'
sources:
  - api/mcp.ts
  - api/lib/mcp/server.ts
  - api/lib/mcp/telemetry.ts
  - skills/gridfinity-layout-tool/SKILL.md
  - src/agent/tools/
  - src/features/cloud-share/components/SharedLayoutBanner/SharedLayoutBanner.tsx
---

# Use the Layout Tool from an AI assistant

Want to plan a drawer in a chat with Claude or another AI assistant? The Layout Tool has a public MCP server. MCP (Model Context Protocol) is the standard way for an AI assistant to use outside tools. Connect the server once, and the assistant can use the Layout Tool's own calculators.

## What the assistant can do

| Tool             | What it does                                                                          |
| ---------------- | ------------------------------------------------------------------------------------- |
| `drawer_fit`     | Fits the grid to a drawer that you measured, with the spare room and the tallest bins |
| `plan_layout`    | Places bins in a drawer and gives a link that opens the plan in the layout editor     |
| `split_plan`     | Splits a baseplate into pieces that fit your print bed                                |
| `bin_size_for`   | Gives the bin size that makers most often use for a label, such as "M3 screws"        |
| `print_estimate` | Estimates filament, print time and cost for standard bins                             |

The assistant chooses the bin sizes in a plan, so treat them as a starting point. The other numbers come from the same code that the app runs.

The tools can't see or change your saved layouts. A plan opens in the layout editor with a banner at the top. Click <Ui k="share.banner.saveToMyLayouts" /> to keep it, as with a [shared layout](../sharing/share-links).

## Connect the server

The server address is:

```text
https://gridfinitylayouttool.com/api/mcp
```

It needs no account and no sign-in.

### Claude apps

On a Free, Pro or Max plan:

1. In Claude, open **Customize**, then **Connectors**.
2. Click **+ Add**, then **Add custom connector**.
3. Type a name, such as "Gridfinity Layout Tool", and paste the server address.
4. Click **Continue**. For sign-in, choose **No sign in**.

A Free plan can have one custom connector. On a Team or Enterprise plan, an owner adds the connector in **Organization settings**, then **Connectors**. Members then click **Connect** next to it.

### Claude Code

Run this command:

```bash
claude mcp add --transport http gridfinity https://gridfinitylayouttool.com/api/mcp
```

The connector then works in the current project. To use it in every project, run this command instead:

```bash
claude mcp add --transport http --scope user gridfinity https://gridfinitylayouttool.com/api/mcp
```

### Other assistants

Any assistant that can add a remote MCP server over HTTP can use the same address. Look in its help for "custom connector" or "MCP server".

## Add the Agent Skill

The connector gives the assistant the tools. The Agent Skill teaches it the steps: measure the drawer, size the bins, plan, then split the baseplate. It also tells the assistant where these docs are.

[Download the Agent Skill](/gridfinity-layout-tool-skill.zip) as a ZIP file.

- **Claude apps:** open **Customize**, then **Skills**. Click **+**, then **Create skill**, then **Upload a skill**, and choose the ZIP file. Code execution must be on.
- **Claude Code:** unzip the file into your skills folder:

  ```bash
  unzip gridfinity-layout-tool-skill.zip -d ~/.claude/skills/
  ```

The Skill is also [on GitHub](https://github.com/andymai/gridfinity-layout-tool/tree/main/skills/gridfinity-layout-tool), for assistants that read a skill folder.

## What a tool call sends

The assistant sends the tool's input to the Layout Tool's server: drawer sizes, bin sizes, labels and print bed sizes. The server answers and keeps nothing. For each tool call, it counts the tool name, the result, the time and the name of the assistant's software. It doesn't count your input. [Your data and privacy](../introduction/your-data#ai-assistants) has the details.

Your chat itself goes to the company that runs your assistant, under its own terms.

## Limits

- Each network address can make a set number of calls each hour, and the server has a limit for each day. When the assistant reaches one, it gets a message to try again later.
- A [self-hosted copy](./self-hosting) has no MCP server. Connect to the address above.
