---
title: What is Gridfinity? How the 3D-Printed Storage System Works
description: How Gridfinity works, what you need to start, and how to plan a drawer that fits. A practical guide to the 3D-printed modular storage system.
keywords: gridfinity, what is gridfinity, gridfinity system, gridfinity storage, gridfinity bins, gridfinity explained, drawer organizer, 3D printing, modular storage, Zack Freedman
schema: Article
breadcrumbs:
  - name: Home
    url: https://gridfinitylayouttool.com/
  - name: What is Gridfinity?
    url: https://gridfinitylayouttool.com/what-is-gridfinity
faqs:
  - q: What is a Gridfinity bin?
    a: A Gridfinity bin is a 3D-printed storage container that sits on a Gridfinity baseplate. Bins come in grid sizes (1×1, 2×2, 3×1, etc., where 1 unit equals 42mm) and heights measured in 7mm increments. The profiled base mates with the baseplate pattern so bins stay put when you open the drawer but lift out easily.
  - q: How big is a Gridfinity unit?
    a: One Gridfinity grid unit is 42mm × 42mm. Heights use a separate 7mm increment, often called "U". A 2×2 bin at 3U measures about 84mm × 84mm and stands 21mm tall, with roughly 14mm of usable depth inside, because the first height unit is taken up by the base profile.
  - q: What is the difference between a Gridfinity bin and a baseplate?
    a: Baseplates are flat tiles that go in your drawer and form the 42mm grid. Bins are the containers that hold your stuff and rest on the baseplate's pattern. You print baseplates once to cover the drawer, then print whatever bins you need on top.
  - q: What filament should I use for Gridfinity bins?
    a: PLA is the standard choice and what most community designs are optimized for. PETG works well if you want more durability or impact resistance. ASA or ABS make sense if the bins live somewhere warm (garage, attic). Avoid PLA in hot cars.
  - q: How much filament does a Gridfinity bin use?
    a: A typical 2×2 bin uses about 20-40 grams of PLA depending on height and infill. A 1×1 bin is around 8-15g. Baseplates are heavier per unit, roughly 25-30g per grid unit.
  - q: How long does a Gridfinity bin take to print?
    a: A 2×2 bin runs about 1-2 hours at standard speeds (50-80 mm/s). Bambu Lab and other fast printers cut this to 20-40 minutes. Baseplates take longer per unit because of the surface area.
  - q: What print settings should I use for Gridfinity?
    a: 0.2mm layer height, 15-20% infill, and 2-3 perimeters covers almost every bin. Print bins upright with no supports, which is what the geometry is designed for. Baseplates print flat on the bed, also without supports.
  - q: Do Gridfinity bins need supports?
    a: No. Standard bins, baseplates, and scoop ramps are all designed to print without supports in their default orientation. If your slicer wants to add supports, the model is usually oriented wrong or a custom feature has been added with too steep an overhang.
  - q: Do Gridfinity bins fall out when you open the drawer?
    a: No. The baseplate's raised pattern creates enough friction to hold bins in place during normal drawer use. They're not locked, so you can lift them straight up to remove them, but they don't slide around when you open or close the drawer.
  - q: Do I need magnets for Gridfinity?
    a: No, magnets are optional. The base profile alone holds bins well enough for normal drawer use. Magnets (6mm × 2mm discs) are worth adding if the drawer gets yanked hard, if it lives in a vehicle, or if you want baseplates to stick to a steel surface.
  - q: Can Gridfinity bins stack?
    a: Yes. The stacking lip on top of each bin matches the base profile underneath, so a bin sits on another bin the same way it sits on a baseplate. The lip adds 4.4mm above the bin body, which is worth remembering when you check drawer clearance.
  - q: Can I buy Gridfinity bins instead of printing them?
    a: Yes, many sellers offer pre-printed bins on Etsy, Amazon, and direct-from-maker shops. It's an option if you don't have a 3D printer, though printing yourself is usually cheaper per bin once you account for shipping.
  - q: Is Gridfinity free?
    a: Yes. Gridfinity is open-source. The community designs are free to download from Printables, Thangs, and MakerWorld. Your only cost is filament.
  - q: Who invented Gridfinity?
    a: Zack Freedman, a maker and YouTuber, published Gridfinity in 2022. He drew on an earlier modular workshop system by Alexandre Chappel and released the specification openly, which is why so many independent tools and design libraries exist for it today.
---

# What is Gridfinity?

Gridfinity is a free, open-source storage system you 3D print: bins rest on a 42mm baseplate grid, so every maker's design fits. Here's how to start. Standard bin sizes mean anything you print is interchangeable with anything anyone else prints. Zack Freedman, a maker and YouTuber, created it in 2022, and there are now over 10,000 free designs on Printables alone.

The idea is simple: everything uses a 42mm grid. Bins rest on baseplates. Baseplates tile to fill any drawer. When you need to reorganize, pick up the bins and move them.

![A 3D-printed style Gridfinity bin with six compartments and label tabs, rendered in 3D](/images/landing/multicolor-organizer-bin.png '1200x675')

## How Gridfinity Works

A Gridfinity setup has two parts.

**Baseplates** go in your drawer. They're flat tiles with a raised grid pattern that holds bins in place. You tile them to cover whatever space you have.

**Bins** hold your stuff. They come in grid sizes (1×1, 2×2, 3×1, and so on) and heights measured in 7mm units.

The bins have a profiled base that mates with the baseplate pattern. They stay put when you open the drawer but lift out easily when you need them.

### The two numbers that define everything

Almost all of Gridfinity reduces to two measurements:

- **42mm** is one grid unit in width and depth. A 2×3 bin is 84mm × 126mm.
- **7mm** is one height unit, usually written "U". A 6U bin body stands 42mm tall.

One detail trips up nearly everyone at the start: **height units include the base**, so the usable depth inside a bin is about `(height − 1) × 7mm`. A 3U bin stands 21mm tall but only gives you around 14mm of interior. If you need 21mm of clearance for whatever you're storing, print a 4U bin. The [sizes and dimensions reference](/gridfinity-sizes) has the full tables in millimeters and inches.

### The parts that make it fit together

Three pieces of geometry do the actual work:

**The base socket.** The underside of every bin has a tapered profile that drops into the baseplate's grid. It's cut with about 0.5mm of clearance so bins seat without binding, which is also why bins from two different designers interchange rather than jamming.

**The stacking lip.** The top rim of a bin mirrors the base profile, so bins stack on each other exactly the way they sit on a baseplate. The lip adds roughly 4.4mm above the bin body. Worth remembering when you're checking whether a drawer closes.

**Magnet and screw holes (optional).** Baseplates can carry 6mm × 2mm magnets at each grid intersection, or M3 screw holes to fix them down. Neither is required. The profile alone holds bins fine for a drawer that opens and closes normally.

## Why People Use It

**You print exactly what you need.** No buying a 12-pack of bins when you need two. No hunting for a size that nearly fits. If a bin exists for your specific drill index or socket set, you print that.

**Everything is compatible.** A 2×2 bin from one designer works with a baseplate from another. Every design follows the same spec, so a library built over years stays usable.

**Reorganizing is free.** Layouts change. When the drawer's contents change, you pick the bins up and put them down somewhere else instead of starting over.

**It's genuinely free.** The designs are open source. The only cost is filament, and a typical bin uses 20-40 grams of PLA.

## How to Build Your First Gridfinity Drawer

The whole process is six steps, and the first one matters more than the rest.

### 1. Measure the drawer

Measure the **usable interior**, not the outside and not the front opening. Drawers routinely narrow toward the back, have a lip at the front, or lose height to a slide rail. Measure width, depth, and the height available under whatever sits above the drawer when it's closed.

Take the smallest measurement you find on each axis. A drawer that's 402mm at the opening and 396mm at the back is a 396mm drawer.

### 2. Convert to grid units

Divide by 42 and round down. A 396mm width gives 9 full grid units (378mm) with 18mm left over. That leftover is normal and fine, and you can center the baseplate or push it to one side. The [drawer calculator](/gridfinity-calculator) does this conversion and tells you the maximum bin height that will clear.

### 3. Plan the layout before printing anything

This is the step that saves filament. Decide what goes in the drawer, then which bin sizes hold those things, then where they sit. Doing it on screen takes minutes; doing it by reprinting takes days.

The [layout planner](/) is built for this: set the drawer size, draw bins onto the grid, label them, and export a print list of exactly what to make. If you'd rather follow a worked example, the [planning guide](/guide) walks through a full drawer start to finish, and there are step-by-step builds for a [tool drawer](/gridfinity-tool-drawer) and a [kitchen drawer](/gridfinity-kitchen-drawer).

### 4. Print the baseplates

Baseplates print flat on the bed with no supports. If your drawer is wider than your printer, split the baseplate into pieces that fit and lay them side by side in the drawer. They don't need to be a single part, and the seams disappear once bins are on top. The [baseplate generator](/gridfinity-baseplate-generator) sizes a plate to your drawer, adds edge padding for the leftover millimeters, and splits it to your print bed automatically.

### 5. Print the bins

Bins print upright, no supports. Start with two or three, not the whole drawer. Check that they seat properly on your baseplate and that the fit feels right before you commit twenty hours of printing.

If nothing in the community libraries matches what you're storing, the [bin generator](/gridfinity-bin-generator) makes one to your dimensions with compartments, label tabs, scoop ramps, and floor cutouts, exporting STL, STEP, or 3MF.

### 6. Load it and change your mind

Put everything in. Live with it for a week. You will move things, and that's the point of the system rather than a failure of your plan. Print replacements for the bins that turned out wrong.

## Print Settings That Work

Gridfinity is undemanding. These settings cover nearly everything:

| Setting      | Value  | Why                                                        |
| ------------ | ------ | ---------------------------------------------------------- |
| Layer height | 0.2mm  | Good balance of speed and a clean base profile             |
| Infill       | 15-20% | Bins are mostly walls; more infill adds time, not strength |
| Perimeters   | 2-3    | Three if the bin holds anything heavy                      |
| Supports     | None   | The geometry is designed to print unsupported              |
| Material     | PLA    | PETG for durability, ASA or ABS for hot spaces             |

Two things worth knowing:

**If your slicer wants supports, something is wrong.** Standard bins, baseplates, and scoop ramps are all designed to print unsupported in their default orientation. Supports usually mean the model got rotated, or a custom feature was added with too aggressive an overhang.

**Don't over-tune tolerances.** The 0.5mm clearance in the spec already accounts for normal printer variation. If bins feel tight, the fix is usually to check your first layer or elephant's foot compensation rather than to scale the model.

## Where to Find Designs

The community has already solved most common problems: screwdriver holders, battery organizers, drill bit trays, cable management, socket rails, pen cups.

The main repositories:

- [Printables](https://www.printables.com/search/models?q=gridfinity) is the largest collection with the best filtering
- [Thangs](https://thangs.com/search/gridfinity) lets you search by similar shape
- [MakerWorld](https://makerworld.com/en/search/models?keyword=gridfinity) is popular with Bambu Lab owners

Search by what you're storing plus the size, for example "gridfinity 2x2 battery holder" rather than just "gridfinity". If nothing fits, generating a custom bin is usually faster than modifying someone else's model, and the [software comparison](/gridfinity-software) covers when to reach for a generator, OpenSCAD, or full CAD.

## Common Mistakes

**Measuring the drawer opening instead of the interior.** The single most common cause of a baseplate that doesn't fit. Measure the narrowest point on each axis.

**Forgetting the stacking lip in the height budget.** A bin's stated height is its body. The lip adds about 4.4mm on top. On a tight drawer that's the difference between closing and not.

**Confusing height units with interior depth.** A 3U bin is 21mm tall and about 14mm deep inside. Buying into the wrong number here means reprinting.

**Designing a baseplate bigger than the print bed.** Split it into pieces instead. Nothing about the system requires a one-piece plate.

**Printing the whole drawer before testing one bin.** Print two, check the fit, then commit.

**Adding magnets you don't need.** They cost money and printing time, and the plain profile is sufficient for a drawer that opens and closes normally.

## What You Need to Start

1. **A 3D printer.** Any FDM printer works. PLA is standard.
2. **Measurements.** Your drawer's usable interior in millimeters. The [sizes reference](/gridfinity-sizes) has conversion tables.
3. **A plan.** How many grid units fit, which bins you need, and where they go.

This tool handles step 3. Mock up the layout, see how it fits, then export a list of what to print. You can also [generate custom bins and baseplates](/gridfinity-generator) with STL, STEP, and 3MF export directly in your browser, with no account and nothing to install.

## Next Step

If you're ready to plan a drawer, the guide walks through measuring, planning, and exporting a print list.

[CTA: Read the Planning Guide](/guide)
