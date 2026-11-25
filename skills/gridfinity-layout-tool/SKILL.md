---
name: gridfinity-layout-tool
description: Plan Gridfinity drawer organizers with the Gridfinity Layout Tool's MCP tools. Fit a drawer, size and place bins, split a baseplate for a print bed, and estimate filament.
---

# Gridfinity Layout Tool

Use this skill to plan a Gridfinity drawer organizer for a person with the tools of the Gridfinity Layout Tool. The tools run the app's own code on its server. They keep nothing, and a plan comes back as a link that opens in the app.

The tools come from the Layout Tool's MCP server at `https://gridfinitylayouttool.com/api/mcp`. If you do not have the `drawer_fit` and `plan_layout` tools, tell the person how to add the server: https://gridfinitylayouttool.com/docs/reference/ai-assistants. Do not work out a grid, a split or an estimate yourself in their place.

## Units

- A grid unit is 42 mm. A bin is a whole or half number of grid units wide and deep.
- A height unit is 7 mm. A bin is a whole number of height units tall, and the stacking lip adds to its printed height.
- More detail: https://gridfinitylayouttool.com/docs/concepts/units.md

## Plan a drawer

1. Get the inside width, depth and height of the drawer, with the unit. If the person has no measurement, get the grid size that they want.
2. Call `drawer_fit` with the measurement. It gives the grid, the spare room and the tallest bins for stacks of 1, 2 and 3.
3. Make a list of the things to store. For each kind of thing, choose one bin: the footprint of the thing plus room for fingers, in whole or half grid units.
4. For common items such as "M3 screws", call `bin_size_for` with the labels first. Its size is a habit of other makers, not a fact about the item.
5. Keep each bin at or below the tallest height from `drawer_fit`. For bins on a second layer, use the heights for a stack of 2.
6. Call `plan_layout` with the drawer measurement and the bins. Give a `count` for repeated bins, and `categories` to color groups of bins.
7. Read the result. It names the bins that it placed, and the bins that went to the stash because they did not fit.
8. If bins went to the stash, tell the person and offer a change: smaller bins, fewer bins or a second layer. Then call `plan_layout` again.
9. Give the person the link from the result, unchanged. It opens the plan in the layout editor. To keep the plan, they click **Save to My Layouts** in the banner at the top.
10. Say that you chose the bin sizes, and that they are a starting point. The person can change them in the app.

## Baseplate and filament

- To print the baseplate, call `split_plan` with the grid and the print bed size. It says whether the plate prints in one piece, or how it splits.
- To estimate filament, print time and cost, call `print_estimate` with the size and count of each bin. Give the person's printer settings when you know them.
- Say that the print figures are estimates for standard bins, without the baseplate.
- A bin that is larger than the print bed prints in pieces that the person glues together, because the app splits it. When you know the bed, prefer bin sizes that fit it, and name each bin that can need a split. More detail: https://gridfinitylayouttool.com/docs/concepts/print-bed-fit.md

## Rules

- Use the tools for every number that they compute: grids, spare room, heights, pieces, grams and hours. The bin sizes are the only numbers that you choose.
- When a tool returns an error, read it, correct the input and call the tool again.
- For questions about the app itself, read its docs. https://gridfinitylayouttool.com/docs/llms.txt lists every page as Markdown.
- [references/tools.md](references/tools.md) lists every tool with its inputs and limits.
