import type { WhatsNewEntry } from './types';

/**
 * Curated highlights, newest first. Not a changelog: an entry earns its place
 * only if you would mention the change to someone using the tool, which is a
 * small fraction of what ships. `CHANGELOG.md` remains the complete record.
 *
 * The minimum entry is `id`, `date` and an English `title`. Everything else is
 * optional, deliberately: the feature only survives if writing one stays cheap.
 *
 * Entries before mid-July 2026 were written retrospectively and cover an arc of
 * work rather than a single release, which is why their dates land on the last
 * change in the arc.
 */
export const WHATS_NEW_ENTRIES: WhatsNewEntry[] = [
  {
    id: 'workshop-multi-select',
    date: '2026-08-24',
    kind: 'improved',
    title: { en: 'Select and resize several Workshop parts at once' },
    body: {
      en: 'Drag a box across the canvas to grab a group of parts, then move, rotate or resize them together. New camera buttons frame the whole build or just what you have selected.',
    },
    labs: 'workshop',
  },
  {
    id: 'cutout-lean-angle',
    date: '2026-08-24',
    kind: 'new',
    title: { en: 'Lean a cutout off vertical' },
    body: {
      en: 'Custom cutouts take a lean angle, so a pocket can tilt its contents toward you instead of holding them upright.',
    },
    action: { kind: 'openTool', tool: 'designer' },
  },
  {
    id: 'workshop',
    date: '2026-08-23',
    kind: 'new',
    title: { en: 'Workshop: build tool holders out of parts' },
    body: {
      en: 'Place posts, fins, tubes, cradles and racks on a Gridfinity base in 3D, stack and carve them, then export to STL, 3MF or STEP. Builds save to your library, sync when signed in, and drop into a drawer layout like any bin. Turn it on under Labs.',
    },
    labs: 'workshop',
  },
  {
    id: 'bento-non-rectangular',
    date: '2026-08-23',
    kind: 'new',
    title: { en: 'Bento compartments that are not rectangles' },
    body: {
      en: 'Merge selected cells into L-shaped and stepped compartments, and fold whatever space is left over into a neighbour instead of losing it.',
    },
    action: { kind: 'openTool', tool: 'designer' },
  },
  {
    id: 'json-schemas',
    date: '2026-08-23',
    kind: 'new',
    title: { en: 'Published JSON Schemas for layout and design files' },
    body: {
      en: 'Layout files and bin designs now have schemas your editor can validate against while you type, with the field-by-field reference in the docs.',
    },
  },
  {
    id: 'half-foot-hardware',
    date: '2026-08-23',
    kind: 'new',
    title: { en: 'Magnets and screw holes on half-size feet' },
    body: {
      en: 'Half-grid bins take the same magnet and screw hardware as full-size ones, so a 1x0.5 bin holds down as firmly as its neighbours.',
    },
  },
  {
    id: 'designs-into-layout',
    date: '2026-08-22',
    kind: 'new',
    title: { en: 'Drop a saved design straight into your drawer' },
    body: {
      en: 'My Designs places a saved bin into the layout directly, already linked, instead of drawing a placeholder and linking it afterwards.',
    },
    action: { kind: 'openTool', tool: 'layout' },
  },
  {
    id: 'designer-measuring-tool',
    date: '2026-08-22',
    kind: 'new',
    title: { en: 'Measure anything on the design canvas' },
    body: {
      en: 'A measuring tool reports the distance between any two points, and the ruler now snaps to more of what you are actually aiming at.',
    },
    action: { kind: 'openTool', tool: 'designer' },
  },
  {
    id: 'spec-dead-space',
    date: '2026-08-22',
    kind: 'fixed',
    title: { en: 'Every bin now leaves the spec 7mm of dead space' },
    body: {
      en: 'Some bins were built without the clearance the Gridfinity spec reserves under the stacking lip. They now match the spec, so bins from here stack cleanly with parts printed elsewhere.',
    },
  },
  {
    id: 'stack-collision-real-height',
    date: '2026-08-22',
    kind: 'improved',
    title: { en: 'Stacking checks use a linked design true height' },
    body: {
      en: 'When you stack bins in a layout, the collision check now measures the real rise of each linked design instead of assuming a nominal height.',
    },
    action: { kind: 'openTool', tool: 'layout' },
  },
  {
    id: 'leaning-dividers',
    date: '2026-08-21',
    kind: 'new',
    title: { en: 'Compartment dividers that lean off vertical' },
    body: {
      en: 'Tilt a divider so a compartment holds its contents at an angle, and reach the diagonal divider tools straight from the compartment grid.',
    },
    action: { kind: 'openTool', tool: 'designer' },
  },
  {
    id: 'hinged-lids',
    date: '2026-08-20',
    kind: 'new',
    title: { en: 'Lids that hinge open on a filament pin' },
    body: {
      en: 'Generate a hinged lid that prints in place and pivots on a short length of filament, no hardware needed.',
    },
    action: { kind: 'openTool', tool: 'designer' },
  },
  {
    id: 'cutout-repeats',
    date: '2026-08-20',
    kind: 'improved',
    title: { en: 'Fill a bin with a repeating cutout in one click' },
    body: {
      en: 'Repeats fill the available space in a single action, nest inside each other, and overlap without fighting. The canvas holds still while you work, and you can centre a selection on one axis at a time.',
    },
    action: { kind: 'openTool', tool: 'designer' },
  },
  {
    id: 'design-json-export',
    date: '2026-08-20',
    kind: 'new',
    title: { en: 'Export a design as JSON' },
    body: {
      en: 'The export dialog hands you the design file itself, so you can keep it in version control, edit it by hand, or pass it to someone else.',
    },
  },
  {
    id: 'sliding-lids',
    date: '2026-08-18',
    kind: 'new',
    title: { en: 'Sliding lids' },
    body: {
      en: 'Add a lid that slides into rails along the top of the bin, as an alternative to a lid that lifts off or clicks down.',
    },
    action: { kind: 'openTool', tool: 'designer' },
  },
  {
    id: 'cutout-label-sockets',
    date: '2026-08-18',
    kind: 'new',
    title: { en: 'Swappable label sockets on cutout bins' },
    body: {
      en: 'Shadow-board style bins take the same printed label plates as compartment bins, so you can relabel a tool pocket without reprinting it.',
    },
    action: { kind: 'openTool', tool: 'designer' },
  },
  {
    id: 'drawer-height-check',
    date: '2026-08-18',
    kind: 'new',
    title: { en: 'Check a layout against your measured drawer height' },
    body: {
      en: 'Enter the height you measured and the layout tells you whether the tallest stack, its lid and its baseplate actually clear the drawer above.',
    },
    action: { kind: 'openTool', tool: 'layout' },
  },
  {
    id: 'knife-blocks',
    date: '2026-08-18',
    kind: 'new',
    title: { en: 'Knife blocks with blade slots and handle rests' },
    body: {
      en: 'Generate an in-drawer knife block that holds each blade in its own slot with the handle supported clear of the base.',
    },
    action: { kind: 'openTool', tool: 'designer' },
  },
  {
    id: 'detachable-feet',
    date: '2026-08-17',
    kind: 'new',
    title: { en: 'Detachable feet' },
    body: {
      en: 'Print the Gridfinity feet as separate pieces that press on by hand. Bins print flat and faster, and a foot that wears out can be replaced on its own.',
    },
    action: { kind: 'openTool', tool: 'designer' },
  },
  {
    id: 'cutout-fit-test',
    date: '2026-08-17',
    kind: 'new',
    title: { en: 'Print a fit test before committing to a cutout' },
    body: {
      en: 'Export a small coupon of just the cutout so you can check the fit of the real tool before printing the whole bin.',
    },
  },
  {
    id: 'lid-holes',
    date: '2026-08-17',
    kind: 'new',
    title: { en: 'Cut holes in a generated lid' },
    body: {
      en: 'Put openings through a lid for cables, dispensing or a view of what is inside, with keep-out areas shown rather than the shape silently clipping.',
    },
    action: { kind: 'openTool', tool: 'designer' },
  },
  {
    id: 'bin-height-cap-50u',
    date: '2026-08-16',
    kind: 'improved',
    title: { en: 'Bins up to 50 units tall' },
    body: { en: 'The height cap moved from 20 units to 50 for genuinely deep drawers.' },
  },
  {
    id: 'underside-lightweight-floor',
    date: '2026-08-16',
    kind: 'new',
    title: { en: 'Hollow out the floor from underneath' },
    body: {
      en: 'A lightweight floor mode that cuts material from the underside, saving filament and print time while leaving the inside of the bin flat.',
    },
    action: { kind: 'openTool', tool: 'designer' },
  },
  {
    id: 'bento-merge-selection',
    date: '2026-08-15',
    kind: 'improved',
    title: { en: 'Merge only the bins you select' },
    body: {
      en: 'Bento merges the bins you picked rather than everything touching them, so you can build one divided insert without absorbing the whole drawer.',
    },
  },
  {
    id: 'supporters-in-app',
    date: '2026-08-15',
    kind: 'new',
    title: { en: 'Ko-fi supporters recognised in the app' },
    body: {
      en: 'Supporters appear on the supporters page automatically, with their message and a bin of their own to find.',
    },
  },
  {
    id: 'step-split-export',
    date: '2026-08-14',
    kind: 'new',
    title: { en: 'Split oversized bins for STEP export' },
    body: {
      en: 'A bin too large for your print bed now splits into pieces in STEP as it already did in STL and 3MF.',
    },
  },
  {
    id: 'bento-graduated',
    date: '2026-08-14',
    kind: 'improved',
    title: { en: 'Bento leaves Labs' },
    body: {
      en: 'The Bento workspace is on for everyone. Draw compartments across merged bins, stash pieces while you rearrange, and give each compartment its own shadow-box colour.',
    },
    action: { kind: 'openTool', tool: 'designer' },
  },
  {
    id: 'half-offset-foot-lattice',
    date: '2026-08-13',
    kind: 'new',
    title: { en: 'Per-axis foot lattice for half-offset bins' },
    body: {
      en: 'A bin sitting on a half-unit offset gets a foot pattern that matches the plate underneath it on each axis independently.',
    },
  },
  {
    id: 'baseplate-screw-holes',
    date: '2026-08-12',
    kind: 'new',
    title: { en: 'Screw a baseplate down to the drawer' },
    body: {
      en: 'Parametric mount-down screw holes, sized for your hardware and placed symmetrically about each piece.',
    },
    action: { kind: 'openTool', tool: 'baseplate' },
  },
  {
    id: 'scan-calibration-lattice',
    date: '2026-08-10',
    kind: 'improved',
    title: { en: 'Phone scans size from a printed lattice' },
    body: {
      en: 'Scanning a tool now takes its scale from a calibration lattice instead of a single reference card, which removes most of the sizing error from a traced outline.',
    },
  },
  {
    id: 'layout-zip-header',
    date: '2026-08-09',
    kind: 'improved',
    title: { en: 'Export the whole layout from the header' },
    body: {
      en: 'The ZIP of every linked bin plus the baseplate is a button in the header instead of something to go looking for.',
    },
    action: { kind: 'openTool', tool: 'layout' },
  },
  {
    id: 'sliding-tray',
    date: '2026-08-07',
    kind: 'new',
    title: { en: 'Sliding trays' },
    body: {
      en: 'A tray that runs on rails inside a bin, with end stops so it cannot fall out, and a fit coupon to test the rail clearance before printing the real thing.',
    },
    action: { kind: 'openTool', tool: 'designer' },
  },
  {
    id: 'lid-grip-relief',
    date: '2026-08-07',
    kind: 'new',
    title: { en: 'A grip relief so a tight lid can be opened' },
    body: {
      en: 'Add a thumb recess to a close-fitting lid, with a height control for how deep it cuts.',
    },
  },
  {
    id: 'bin-size-lock',
    date: '2026-08-06',
    kind: 'new',
    title: { en: 'Lock a bin size' },
    body: {
      en: 'A locked bin still moves around the drawer but cannot be resized by accident while you rearrange everything else.',
    },
    action: { kind: 'openTool', tool: 'layout' },
  },
  {
    id: 'community',
    date: '2026-08-06',
    kind: 'new',
    title: { en: 'Community: publish and remix designs' },
    body: {
      en: 'Browse a gallery of published bin designs, filter by the dimensions you need, remix anything into your own library, and publish your own. Designs carry print reports, likes, remix ancestry and an estimate of what they cost to print.',
    },
    action: { kind: 'openModal', modal: 'designGallery' },
  },
  {
    id: 'baseplate-custom-split-lines',
    date: '2026-08-04',
    kind: 'new',
    title: { en: 'Draw your own baseplate split lines' },
    body: {
      en: 'Decide where a large plate breaks into printable pieces instead of accepting the automatic split.',
    },
    action: { kind: 'openTool', tool: 'baseplate' },
  },
  {
    id: 'custom-drawer-perimeter',
    date: '2026-08-01',
    kind: 'new',
    title: { en: 'Draw a drawer that is not a rectangle' },
    body: {
      en: 'Trace a freeform perimeter with the pen tool, round each corner to its own radius, or import the outline from an SVG or DXF. Baseplates fit whole cells to whatever shape you drew.',
    },
    action: { kind: 'openTool', tool: 'baseplate' },
  },
  {
    id: 'assembled-height',
    date: '2026-08-01',
    kind: 'new',
    title: { en: 'See assembled height while you design' },
    body: {
      en: 'The designer reports the finished height of the bin with its lid and feet, so you can check drawer clearance before you print.',
    },
  },
  {
    id: 'outer-wall-taper',
    date: '2026-07-31',
    kind: 'new',
    title: { en: 'Taper the outer walls to fit a tight drawer' },
    body: {
      en: 'Draw the walls in slightly toward the top, on multi-compartment bins, curved bins and solid cutout bins alike, with the taper band shown in the cutout editor.',
    },
    action: { kind: 'openTool', tool: 'designer' },
  },
  {
    id: 'wall-patterns-selected-walls',
    date: '2026-07-30',
    kind: 'improved',
    title: { en: 'Apply a wall pattern to just the walls you choose' },
    body: {
      en: 'Pattern the front face and leave the sides solid, rather than applying the pattern to everything at once.',
    },
  },
  {
    id: 'spacer-mode',
    date: '2026-07-27',
    kind: 'new',
    title: { en: 'Spacer mode for bins of different heights' },
    body: {
      en: 'Generate a spacer that lifts a short bin so its top finishes flush with its taller neighbours, down to a single height unit.',
    },
  },
  {
    id: 'cutout-align-distribute',
    date: '2026-07-27',
    kind: 'new',
    title: { en: 'Align, distribute and batch-edit cutouts' },
    body: {
      en: 'Line up a row of pockets, space them evenly, and change a property across all of them at once.',
    },
    action: { kind: 'openTool', tool: 'designer' },
  },
  {
    id: 'label-plate-icons',
    date: '2026-07-27',
    kind: 'new',
    title: { en: '26 icons for printed label plates' },
    body: {
      en: 'Fastener and tooling icons picked from a visual grid instead of a dropdown, rendered from real vector paths so they stay crisp at plate size.',
    },
  },
  {
    id: 'expand-bins-to-fit',
    date: '2026-07-27',
    kind: 'new',
    title: { en: 'Expand a bin to fill the space around it' },
    body: {
      en: 'Grow a bin into the empty cells next to it in one action rather than dragging each edge.',
    },
    action: { kind: 'openTool', tool: 'layout' },
  },
  {
    id: 'label-suggestions',
    date: '2026-07-26',
    kind: 'new',
    title: { en: 'Label suggestions that understand what you mean' },
    body: {
      en: 'Start typing a label and the inspector suggests completions from a trained catalogue, matching related terms and not just literal prefixes, in your own language.',
    },
  },
  {
    id: 'four-new-locales',
    date: '2026-07-26',
    kind: 'new',
    title: { en: 'Polish, Czech, Korean and Simplified Chinese' },
    body: { en: 'Four more locales for the app and the guide pages, bringing the total to 15.' },
  },
  {
    id: 'floor-drainage-holes',
    date: '2026-07-25',
    kind: 'new',
    title: { en: 'Drainage and ventilation holes through the floor' },
    body: {
      en: 'Perforate the bin floor so water runs out and air moves through, for anything wet or anything that needs to dry.',
    },
  },
  {
    id: 'mobile-desktop-handoff',
    date: '2026-07-24',
    kind: 'new',
    title: { en: 'Continue on desktop from your phone' },
    body: {
      en: 'Start something on a phone and pick it up on a desktop through your synced account, which matters because exporting is a desktop job.',
    },
  },
  {
    id: 'lid-top-text',
    date: '2026-07-22',
    kind: 'new',
    title: { en: 'Text on the lid and the outer walls' },
    body: {
      en: 'Engrave, emboss or cut text through a lid top, and auto-fit surface text along a bin outer walls.',
    },
    action: { kind: 'openTool', tool: 'designer' },
  },
  {
    id: 'non-square-grid',
    date: '2026-07-22',
    kind: 'new',
    title: { en: 'Grids that are not 42mm square' },
    body: {
      en: 'Set an independent X and Y grid unit for the layout, the baseplates and the bins, with the 3D preview and the baseplate outline following the same proportions.',
    },
  },
  {
    id: 'swappable-label-plates',
    date: '2026-07-21',
    kind: 'new',
    title: { en: 'Swappable printed label plates' },
    body: {
      en: 'Label tabs take a socket that accepts a printed plate you can slide out and replace. Plates batch-export in the layout ZIP, show up in the print list, carry hardware icons and colour zones, and have a calibration coupon for the socket fit.',
    },
  },
  {
    id: 'magnetic-lids',
    date: '2026-07-21',
    kind: 'new',
    title: { en: 'Magnetic lids and tray tops' },
    body: {
      en: 'Hold a lid down with magnets instead of a friction fit, with edge retention magnets to stop a large lid sagging in the middle.',
    },
  },
  {
    id: 'interlocking-dividers',
    date: '2026-07-19',
    kind: 'new',
    title: { en: 'Cross dividers that interlock' },
    body: {
      en: 'Removable dividers in both directions at once, held by face receptacles, including partial-length and custom pieces.',
    },
  },
  {
    id: 'stl-imprint-cutouts',
    date: '2026-07-18',
    kind: 'new',
    title: { en: 'Import an STL and cut its shape into a bin' },
    body: {
      en: 'Drop in a model of the tool itself and the designer carves a pocket that matches it, with free rotation, a clearance cap and precise outlines from scanned meshes.',
    },
    action: { kind: 'openTool', tool: 'designer' },
  },
  {
    id: 'measured-drawer-fit',
    date: '2026-07-16',
    kind: 'new',
    title: { en: 'Enter your drawer size in millimetres' },
    body: {
      en: 'Type the size you measured and the planner reports how the grid fits and how much slack is left over, instead of asking you to work in whole cells.',
    },
    action: { kind: 'openTool', tool: 'layout' },
  },
  {
    id: 'shaped-drawer-baseplates',
    date: '2026-07-12',
    kind: 'new',
    title: { en: 'Baseplates for non-rectangular drawers' },
    body: {
      en: 'Generate a plate that follows a drawer outline, split it into outline-aware pieces, and cut each corner with its own chamfer, radius or notch.',
    },
    action: { kind: 'openTool', tool: 'baseplate' },
  },
  {
    id: 'multiple-baseplate-designs',
    date: '2026-07-11',
    kind: 'new',
    title: { en: 'Save more than one baseplate design' },
    body: {
      en: 'Keep a library of baseplate designs and choose which one is active for each layout.',
    },
    action: { kind: 'openModal', modal: 'baseplateLibrary' },
  },
  {
    id: 'accessibility-tab',
    date: '2026-07-09',
    kind: 'new',
    title: { en: 'Accessibility settings' },
    body: {
      en: 'High contrast, category patterns instead of colour alone, Windows High Contrast Mode support, a text alternative for the 3D preview, and localised screen-reader announcements on the grid.',
    },
  },
  {
    id: 'drawer-margin-bins',
    date: '2026-07-07',
    kind: 'new',
    title: { en: 'Extend edge bins into the drawer margin' },
    body: {
      en: 'Let the bins at the edge of the grid grow into the leftover space around the baseplate rather than wasting it.',
    },
    action: { kind: 'openTool', tool: 'layout' },
  },
  {
    id: 'finger-scoop-styles',
    date: '2026-07-07',
    kind: 'improved',
    title: { en: 'Finger scoops you can shape' },
    body: {
      en: 'Two-variable scoops in curved or straight styles, and a choice of which wall the scoop rises to.',
    },
  },
  {
    id: 'layout-zip-export',
    date: '2026-06-30',
    kind: 'new',
    title: { en: 'Export a whole layout as one ZIP' },
    body: {
      en: 'Every linked bin and the baseplate, exported together in a single download instead of one file at a time.',
    },
  },
  {
    id: 'detachable-margins',
    date: '2026-06-30',
    kind: 'new',
    title: { en: 'Detach baseplate margins into their own pieces' },
    body: {
      en: 'Print the filler around the grid separately, with optional connectors and a solid-fill option for half-grid leftovers.',
    },
  },
  {
    id: 'heights-in-mm',
    date: '2026-06-29',
    kind: 'improved',
    title: { en: 'Enter bin and drawer heights in millimetres' },
    body: { en: 'Work in the units you measured in rather than converting to height units first.' },
  },
  {
    id: 'stack-printing',
    date: '2026-06-21',
    kind: 'new',
    title: { en: 'Stack-print baseplates and layouts' },
    body: {
      en: 'Stack copies of each piece on the build plate, print a layout several times over, and split for the fewest plate loads rather than the fewest pieces.',
    },
  },
  {
    id: 'baseplate-connectors',
    date: '2026-06-18',
    kind: 'new',
    title: { en: 'Connectors that lock split baseplate pieces together' },
    body: {
      en: 'Dovetail, snap-clip and puzzle styles with an adjustable fit offset and a small test print for checking the tolerance on your printer.',
    },
    action: { kind: 'openTool', tool: 'baseplate' },
  },
  {
    id: 'phone-tool-scan',
    date: '2026-06-17',
    kind: 'new',
    title: { en: 'Scan a tool with your phone to make a cutout' },
    body: {
      en: 'Photograph a tool next to a printed reference and the app traces its outline into a shadow-board pocket, with on-device segmentation, smoothed curves and optional symmetry correction. Nothing leaves your phone.',
    },
  },
  {
    id: 'faster-live-preview',
    date: '2026-06-05',
    kind: 'improved',
    title: { en: 'A much faster live 3D preview' },
    body: {
      en: 'The preview switched to a draft geometry kernel, so it redraws while you drag a control instead of after you let go. Exports still use the exact kernel.',
    },
  },
  {
    id: 'pwa-quiet-updates',
    date: '2026-06-03',
    kind: 'improved',
    title: { en: 'Updates apply without interrupting you' },
    body: {
      en: 'A new version installs when you pause rather than reloading mid-task, and the app repairs itself if a stale bundle is left behind. This entry is why the What is New summary exists.',
    },
  },
  {
    id: 'custom-cutout-shapes',
    date: '2026-06-03',
    kind: 'new',
    title: { en: 'Custom cutout shapes, chamfers and arrays' },
    body: {
      en: 'Build a shadow board from arbitrary shapes with entry chamfers, repeat them in parametric arrays, and label each pocket in the 2D editor.',
    },
    action: { kind: 'openTool', tool: 'designer' },
  },
  {
    id: 'design-showcase-gallery',
    date: '2026-06-01',
    kind: 'new',
    title: { en: 'A gallery of example designs' },
    body: { en: 'Browse ready-made bin designs and open any of them as a starting point.' },
    action: { kind: 'openModal', modal: 'designGallery' },
  },
  {
    id: 'non-integral-bins',
    date: '2026-05-30',
    kind: 'new',
    title: { en: 'Bins that are not a whole number of cells' },
    body: {
      en: 'Overhang past the grid, tile a baseplate under an oversized bin, and print fractional feet to suit.',
    },
  },
  {
    id: 'design-tags',
    date: '2026-05-30',
    kind: 'new',
    title: { en: 'Organise saved designs with tags' },
    body: {
      en: 'Tag your designs, filter by tag, and act on several at once. Tags sync with your account.',
    },
  },
  {
    id: 'angled-dividers',
    date: '2026-05-29',
    kind: 'new',
    title: { en: 'Diagonal dividers' },
    body: {
      en: 'Set a divider angle directly or drag it on the canvas, for compartments that run across a bin rather than square to it.',
    },
  },
  {
    id: 'engraved-text',
    date: '2026-05-21',
    kind: 'new',
    title: { en: 'Engraved text on label tabs and cutouts' },
    body: {
      en: 'Type a label into the model itself, engraved, embossed or cut through, with a font picker.',
    },
    action: { kind: 'openTool', tool: 'designer' },
  },
  {
    id: 'help-search',
    date: '2026-05-18',
    kind: 'new',
    title: { en: 'Search the help in plain language' },
    body: {
      en: 'One search across shortcuts, features and settings, aware of which editor you are in, reachable from the command palette and on mobile.',
    },
  },
  {
    id: 'localized-content',
    date: '2026-05-18',
    kind: 'new',
    title: { en: 'Guide pages in eight more languages' },
    body: {
      en: 'The guides and reference pages are translated, with a language switcher on every page.',
    },
  },
  {
    id: 'cloud-sync',
    date: '2026-05-16',
    kind: 'new',
    title: { en: 'Sign in to sync across devices' },
    body: {
      en: 'Sign in with Google or GitHub and your layouts and designs follow you between machines. Staying signed out keeps everything local, as before.',
    },
  },
  {
    id: 'multi-color-export',
    date: '2026-05-16',
    kind: 'new',
    title: { en: 'Multi-colour bins for AMS printers' },
    body: {
      en: 'Paint the lip by quadrant and band, the base, the scoop, the dividers and custom cutouts, then export a 3MF that carries the colour assignments into your slicer. Eyedropper and swap tools make recolouring quick.',
    },
  },
  {
    id: 'click-lock-lid',
    date: '2026-04-29',
    kind: 'new',
    title: { en: 'Click-lock lids' },
    body: { en: 'A companion lid that clicks onto the bin rather than resting on top of it.' },
  },
  {
    id: 'custom-bin-shapes',
    date: '2026-04-21',
    kind: 'new',
    title: { en: 'Bins that are not rectangles' },
    body: {
      en: 'Draw an L-shaped or stepped footprint in the shape editor, and wall patterns, wall cutouts, handles and shadow-board cutouts all follow the shape you drew.',
    },
    action: { kind: 'openTool', tool: 'designer' },
  },
  {
    id: 'asymmetric-print-bed',
    date: '2026-04-05',
    kind: 'improved',
    title: { en: 'Print beds that are not square' },
    body: {
      en: 'Set width and depth separately so splitting a large part accounts for the shape of your bed.',
    },
    action: { kind: 'openModal', modal: 'print' },
  },
  {
    id: 'undo-toasts',
    date: '2026-03-28',
    kind: 'improved',
    title: { en: 'Undo tells you what it undid' },
    body: { en: 'Undo and redo name the action rather than showing a generic message.' },
  },
  {
    id: 'handle-cutouts',
    date: '2026-03-25',
    kind: 'new',
    title: { en: 'Grip cutouts for lifting a bin out' },
    body: {
      en: 'Through-hole grips in several shapes, more than one per bin, with per-side control and a solid border where they meet a patterned wall.',
    },
  },
  {
    id: 'privacy-signals',
    date: '2026-03-23',
    kind: 'improved',
    title: { en: 'Do Not Track and Global Privacy Control are respected' },
    body: {
      en: 'If your browser sends either signal, analytics stay off without you having to change anything here.',
    },
  },
  {
    id: 'svg-cutout-import',
    date: '2026-03-22',
    kind: 'new',
    title: { en: 'Import an SVG as a cutout' },
    body: { en: 'Bring a vector outline in from anywhere and cut it into a bin.' },
  },
  {
    id: 'exploded-layer-view',
    date: '2026-03-20',
    kind: 'new',
    title: { en: 'Exploded layer view in the 3D preview' },
    body: { en: 'Separate the stacked layers so you can see what is underneath.' },
  },
  {
    id: 'selection-toolbar',
    date: '2026-03-20',
    kind: 'new',
    title: { en: 'Align and act on several bins at once' },
    body: {
      en: 'A selection toolbar with alignment and bulk actions for tidying a drawer in a few moves.',
    },
    action: { kind: 'openTool', tool: 'layout' },
  },
  {
    id: 'snapshot-history',
    date: '2026-03-04',
    kind: 'new',
    title: { en: 'Snapshot history and recovery' },
    body: {
      en: 'Layouts auto-save into a snapshot history you can restore from, backed by IndexedDB so a browser crash does not cost you the drawer.',
    },
  },
  {
    id: 'baseplate-generator',
    date: '2026-03-04',
    kind: 'new',
    title: { en: 'The baseplate generator' },
    body: {
      en: 'Generate a baseplate for your drawer, with magnet holes, a lightweight floor, edge padding, and an optimal split into printable pieces.',
    },
    action: { kind: 'openTool', tool: 'baseplate' },
  },
  {
    id: 'bin-designer',
    date: '2026-03-04',
    kind: 'new',
    title: { en: 'The bin designer' },
    body: {
      en: 'Design the bins themselves: compartments, finger scoops, label tabs, wall patterns and wall cutouts, freeform path cutouts with the pen tool, and export to STL, STEP or 3MF.',
    },
    action: { kind: 'openTool', tool: 'designer' },
  },
  {
    id: 'design-system',
    date: '2026-03-04',
    kind: 'improved',
    title: { en: 'A rebuilt interface' },
    body: {
      en: 'Themes, accent colours, density and grid settings, a redesigned settings modal with search, and a consistent component set across all three editors.',
    },
  },
  {
    id: 'layout-planner',
    date: '2026-01-29',
    kind: 'new',
    title: { en: 'The drawer layout planner' },
    body: {
      en: 'Where this started: draw Gridfinity bins onto a drawer grid, stack them in layers, label and categorise them, and get a print list of what to make.',
    },
    action: { kind: 'openTool', tool: 'layout' },
  },
];
