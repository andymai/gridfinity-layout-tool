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
    id: 'two-line-label-captions',
    date: '2026-08-25',
    kind: 'improved',
    title: { en: 'Labels that run to a second line' },
    body: {
      en: 'A caption too long for its label now breaks onto a second line instead of coming out blank, so a full fastener spec fits beside its icon. Press Shift+Enter where you want the break, or leave it and the label picks one.',
    },
    action: { kind: 'openTool', tool: 'designer' },
  },
  {
    id: 'nested-cutout-groups',
    date: '2026-08-25',
    kind: 'new',
    title: { en: 'Groups inside groups' },
    body: {
      en: 'Group a few shapes to lock their spacing, then group that with more shapes. Move, align, distribute or repeat the whole assembly and everything inside keeps its arrangement. Double-click to work inside a group, Escape to step back out.',
    },
    action: { kind: 'openTool', tool: 'designer' },
  },
  {
    id: 'design-variants',
    date: '2026-08-25',
    kind: 'new',
    title: { en: 'One design, several sizes' },
    body: {
      en: 'Make a variant of a design and claim just the values that differ, like a single shank diameter. Improve the shared geometry once and every variant follows, each keeping what it claimed.',
    },
    action: { kind: 'openTool', tool: 'designer' },
  },
  {
    id: 'design-branching',
    date: '2026-08-25',
    kind: 'new',
    title: { en: 'Branch a design from any saved version' },
    body: {
      en: 'Turn a saved version into its own design without losing the original. Branches list under the design they came from, so a row of clearance experiments takes one line in your library instead of six.',
    },
    action: { kind: 'openTool', tool: 'designer' },
  },
  {
    id: 'design-version-history',
    date: '2026-08-25',
    kind: 'new',
    title: { en: 'Save named versions of a design' },
    body: {
      en: 'Keep the 0.2 mm clearance that fits while you try 0.3 mm. Save a design at any point under a name you choose, browse them later, and restore one. Your current state is saved first, and the restore undoes in a single step.',
    },
    action: { kind: 'openTool', tool: 'designer' },
  },
  {
    id: 'repeat-a-boolean-group',
    featured: true,
    date: '2026-08-24',
    kind: 'new',
    title: { en: 'Repeat a group of shapes as one piece' },
    body: {
      en: 'Building a recess out of two shapes with Exclude, then wanting a row of them, meant flattening the repeat and redoing the boolean on every copy by hand. Select the whole group and Repeat now arrays the finished shape, so every copy keeps the same relationship. Flattening one gives you an independent group per copy rather than loose shapes.',
    },
    action: { kind: 'openTool', tool: 'designer' },
  },
  {
    id: 'per-copy-repeat-labels',
    date: '2026-08-24',
    kind: 'new',
    title: { en: 'Give every copy of a repeat its own label' },
    body: {
      en: 'A repeat cut a row of pockets but engraved a single caption beside the first one, so naming a rack of router bits meant flattening it and editing each pocket. The Label section now takes one label per line, filling the copies top row first and left to right, and tells you how many labels you have written against how many copies there are.',
    },
  },
  {
    id: 'hinged-bin-keeps-its-hinge',
    date: '2026-08-24',
    kind: 'fixed',
    title: { en: 'Exported hinged bins keep their hinge' },
    body: {
      en: 'A hinged lid exported correctly, but the bin it hinges onto came out as an ordinary bin with nothing for the pin to pass through. The knuckles were drawn a fraction of a millimetre clear of the rim, so they showed in the preview and were dropped from the file. They are now joined to the lip. Re-export any hinged design you printed before today.',
    },
  },
  {
    id: 'center-anchored-resize',
    date: '2026-08-24',
    kind: 'improved',
    title: { en: 'Typing a new cutout size keeps it where it was' },
    body: {
      en: 'Changing a width, height or diameter used to grow the shape from its corner, so the hole drifted and had to be repositioned. It now expands equally in every direction around its own center, matching the diameter and across-flats controls.',
    },
  },
  {
    id: 'solid-bin-wall-text',
    date: '2026-08-24',
    kind: 'new',
    title: { en: 'Wall text works on solid bins' },
    body: {
      en: 'A shadow board full of tool pockets had no way to label itself from the outside. Engraved and embossed wall text is now available on solid bins, with the same font, side and depth controls as everywhere else.',
    },
  },
  {
    id: 'center-clipped-cutout',
    date: '2026-08-24',
    kind: 'new',
    title: { en: 'Center a cutout that ended up off the board' },
    body: {
      en: 'Draw a shape, type its real size, and it often ends up hanging off an edge while fitting the bin perfectly well. The clipping warning now offers to center it, alongside growing the bin and pulling it back to the edge.',
    },
  },
  {
    id: 'whats-new',
    date: '2026-08-24',
    kind: 'new',
    title: { en: 'See what changed after an update' },
    body: {
      en: 'New versions install quietly while you work, which made improvements easy to miss. The version number in the sidebar now tells you when one is waiting, and shows a short summary of what changed once it lands.',
    },
  },
  {
    id: 'rotated-imprints',
    date: '2026-08-24',
    kind: 'fixed',
    title: { en: 'Rotated STL imprints cut the way the editor draws them' },
    body: {
      en: 'A rotated imprint cutout was cut mirrored from the outline you positioned, so the pocket came out backwards. Rotation now matches between the editor, the validation silhouette and the cut.',
    },
  },
  {
    id: 'cutout-preview-truth',
    date: '2026-08-24',
    kind: 'fixed',
    title: { en: 'Cutout previews match what actually gets cut' },
    body: {
      en: "Ghost outlines follow the cutout's real shape and depth, ellipses are sampled as true ellipses rather than approximated, and repeats are arranged by the full extent of the pattern instead of one tile.",
    },
  },
  {
    id: 'cut-depth-warning',
    date: '2026-08-24',
    kind: 'fixed',
    title: { en: 'A warning when a cutout is deeper than the bin can give it' },
    body: {
      en: 'Asking for more depth than the body allows used to silently produce a shallower pocket. The designer now says so instead.',
    },
  },
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
    id: 'tapered-floor-clip',
    date: '2026-08-23',
    kind: 'fixed',
    title: { en: 'Tapered bins keep their raised floor inside the wall' },
    body: {
      en: 'A raised floor on a tapered bin could push past the wall it sits in.',
    },
  },
  {
    id: 'panel-clipping',
    date: '2026-08-23',
    kind: 'fixed',
    title: { en: 'Side-panel controls stop clipping their content' },
    body: {
      en: "Controls in the designer's side panels cut off their own labels and values at some widths.",
    },
  },
  {
    id: 'workshop',
    featured: true,
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
    id: 'screw-hole-symmetry',
    date: '2026-08-22',
    kind: 'fixed',
    title: { en: 'Baseplate screw holes sit symmetrically on each piece' },
    body: {
      en: 'Screw holes were placed about the whole plate rather than each split piece, so a piece could come out with holes off-centre.',
    },
  },
  {
    id: 'detachable-feet-fit',
    date: '2026-08-22',
    kind: 'fixed',
    title: { en: 'Detachable feet press on by hand' },
    body: {
      en: "The first pass needed more force than a printed part should. Feet now take their clearance from the spec's dead space and seat by hand.",
    },
  },
  {
    id: 'stacking-lip-colour',
    date: '2026-08-22',
    kind: 'fixed',
    title: { en: "Stacking-lip colour starts above the bin's top surface" },
    body: {
      en: 'Multi-colour bins bled the lip colour down into the wall below it.',
    },
  },
  {
    id: 'designs-into-layout',
    featured: true,
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
    id: 'split-bin-lip',
    date: '2026-08-21',
    kind: 'fixed',
    title: { en: 'Split bins rebuild their lip correctly' },
    body: {
      en: "A split piece cut its lip in the wrong frame, dropped its own lip from its reported dimensions, and seated a cutout's round-over on the wall top instead of the lip. Split parts now match unsplit ones.",
    },
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
    featured: true,
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
    id: 'print-list-pieces',
    date: '2026-08-19',
    kind: 'fixed',
    title: { en: 'The print list shows the pieces the exporter actually cuts' },
    body: {
      en: 'A split design listed a different set of parts than the export produced.',
    },
  },
  {
    id: 'drawer-ceiling',
    date: '2026-08-18',
    kind: 'fixed',
    title: { en: 'The drawer-height check understands lids and lipless stacks' },
    body: {
      en: 'Slide lids, baseplates and lipless stacks were measured with the wrong model, so a layout could report clearance it did not have.',
    },
  },
  {
    id: 'sliding-lid-hardening',
    date: '2026-08-18',
    kind: 'fixed',
    title: { en: 'Sliding lids survive corners, crowns and cutouts' },
    body: {
      en: 'Rounded corners, crowned tops and lid cutouts each produced a lid that would not print or would not slide.',
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
    id: 'bin-volume-calibration',
    date: '2026-08-16',
    kind: 'fixed',
    title: { en: 'Filament and time estimates recalibrated' },
    body: {
      en: 'Bin volume was recalibrated against measured solids, so print estimates track reality more closely.',
    },
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
    id: 'export-button-loss',
    date: '2026-08-15',
    kind: 'fixed',
    title: { en: 'The export button stops disappearing' },
    body: {
      en: 'Losing the geometry engine took the export button with it, with no way back except a reload.',
    },
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
    id: 'click-rails',
    date: '2026-08-14',
    kind: 'fixed',
    title: { en: 'Click-lock rails route around cutouts, handles and label tabs' },
    body: {
      en: 'Rails ran straight through anything in their path, into cutouts, handles, compartment dividers and label tabs. They now notch and segment around them, and skip a scooped wall.',
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
    id: 'lid-magnets',
    date: '2026-08-12',
    kind: 'fixed',
    title: { en: 'Lid magnets seat where the lid actually meets the bin' },
    body: {
      en: 'Magnet pads sat above the mating skirt and magnet posts sat in a socket above the lip rather than on it, so a magnetic lid closed on air. Auto scoop ramps also stay clear of the rail band now.',
    },
  },
  {
    id: 'step-mesh-export',
    date: '2026-08-12',
    kind: 'fixed',
    title: { en: 'STEP export says no instead of producing a broken file' },
    body: {
      en: 'A design with mesh imprint cutouts cannot be represented in STEP. The option is now disabled rather than silently exporting something unusable.',
    },
  },
  {
    id: 'baseplate-preview-regen',
    date: '2026-08-12',
    kind: 'fixed',
    title: { en: 'The baseplate preview updates with screw and fit settings' },
    body: {
      en: 'Changing screw, fit-offset or lightweight settings left the preview showing the old plate.',
    },
  },
  {
    id: 'baseplate-screw-holes',
    featured: true,
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
    id: 'context-menu-size',
    date: '2026-08-09',
    kind: 'fixed',
    title: { en: 'Context menus size to their widest item' },
    body: {
      en: 'Longer entries were truncated instead of widening the menu.',
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
    id: 'path-editor-stale',
    date: '2026-08-08',
    kind: 'fixed',
    title: { en: 'Three stale-index faults in the path editor' },
    body: {
      en: 'Editing vertices on a freeform path could act on the wrong point after a delete.',
    },
  },
  {
    id: 'community-browsing',
    date: '2026-08-08',
    kind: 'fixed',
    title: { en: 'Community browsing polish' },
    body: {
      en: 'Support links are reachable on mobile, the filter rail hides when there is nothing to narrow, single-card shelves are gone, and two contrast failures are fixed.',
    },
  },
  {
    id: 'sliding-tray-fit',
    date: '2026-08-07',
    kind: 'fixed',
    title: { en: 'Sliding trays rest on their rail' },
    body: {
      en: 'The tray floated above its rail, clearance was double the Gridfinity value, and wall patterns carved away the rail itself.',
    },
  },
  {
    id: 'menu-keyboard',
    date: '2026-08-07',
    kind: 'fixed',
    title: { en: 'Menus honour the keyboard contract they advertise' },
    body: {
      en: 'Elements marked as menus did not all support arrow-key navigation and dismissal.',
    },
  },
  {
    id: 'sliding-tray',
    featured: true,
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
    id: 'spacer-socket',
    date: '2026-08-06',
    kind: 'fixed',
    title: { en: 'Spacers sit above the socket they stand on' },
    body: {
      en: "A spacer's body overlapped the socket beneath it.",
    },
  },
  {
    id: 'wall-less-tray',
    date: '2026-08-06',
    kind: 'fixed',
    title: { en: 'The wall-less tray gets a floor and a seatable foot' },
    body: {
      en: 'The tray base generated without a floor, so it could not sit on a baseplate.',
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
    featured: true,
    date: '2026-08-06',
    kind: 'new',
    title: { en: 'Community: publish and remix designs' },
    body: {
      en: 'Browse a gallery of published bin designs, filter by the dimensions you need, remix anything into your own library, and publish your own. Designs carry print reports, likes, remix ancestry and an estimate of what they cost to print.',
    },
    action: { kind: 'openModal', modal: 'designGallery' },
  },
  {
    id: 'stacked-plate-axis',
    date: '2026-08-05',
    kind: 'fixed',
    title: { en: 'Stacked plates turn about the axis that keeps sockets aligned' },
    body: {
      en: 'Rotating a stacked plate for printing misaligned its sockets with the plate below.',
    },
  },
  {
    id: 'label-tabs-dividers',
    date: '2026-08-04',
    kind: 'fixed',
    title: { en: 'Label tabs sit against shifted dividers' },
    body: {
      en: 'Moving a divider left its label tab behind at the old position.',
    },
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
    featured: true,
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
    featured: true,
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
    featured: true,
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
    featured: true,
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
    featured: true,
    date: '2026-07-16',
    kind: 'new',
    title: { en: 'Enter your drawer size in millimetres' },
    body: {
      en: 'Type the size you measured and the planner reports how the grid fits and how much slack is left over, instead of asking you to work in whole cells.',
    },
    action: { kind: 'openTool', tool: 'layout' },
  },
  {
    id: 'cutout-labels-narrow',
    date: '2026-07-14',
    kind: 'fixed',
    title: { en: 'Cutout labels stay visible on narrow cutouts' },
    body: {
      en: 'A label on a slim pocket was clipped away entirely.',
    },
  },
  {
    id: 'magnet-pad-strength',
    date: '2026-07-13',
    kind: 'fixed',
    title: { en: 'Magnet pads print strong on wide nozzles' },
    body: {
      en: 'Pad walls were thin enough that a 0.6mm nozzle gave them too few perimeters to hold a magnet.',
    },
  },
  {
    id: 'connector-fit-offset',
    date: '2026-07-12',
    kind: 'fixed',
    title: { en: 'Connector fit offset reaches split-piece geometry' },
    body: {
      en: 'The offset you set applied to the test print but not to the pieces themselves.',
    },
  },
  {
    id: 'shaped-drawer-baseplates',
    featured: true,
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
    id: 'focus-after-delete',
    date: '2026-07-09',
    kind: 'fixed',
    title: { en: 'Keyboard focus survives deleting a bin' },
    body: {
      en: 'Deleting the focused bin dropped focus out of the grid entirely.',
    },
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
    id: 'panel-scroll',
    date: '2026-07-08',
    kind: 'fixed',
    title: { en: 'The parameter panel scrolls on its own' },
    body: {
      en: "Scrolling the designer's panel scrolled the whole page with it.",
    },
  },
  {
    id: 'overhang-aware-cutouts',
    featured: true,
    date: '2026-07-07',
    kind: 'fixed',
    title: { en: 'The cutout editor accounts for overhang' },
    body: {
      en: 'Cutouts were positioned against the nominal bin rather than the overhung one.',
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
    featured: true,
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
    id: 'safari-15',
    date: '2026-06-27',
    kind: 'fixed',
    title: { en: 'Safari 15 support' },
    body: {
      en: 'The build targeted syntax Safari 15 could not parse, so the app did not start there at all.',
    },
  },
  {
    id: 'divider-cutout-sync',
    date: '2026-06-24',
    kind: 'fixed',
    title: { en: 'Divider cutouts follow the outer walls' },
    body: {
      en: 'Alignment, offset and millimetre values on divider cutouts drifted from the wall cutouts they were meant to match, and compartment labels were lost on a grid resize.',
    },
  },
  {
    id: 'wedged-worker',
    date: '2026-06-23',
    kind: 'fixed',
    title: { en: 'A stuck generator resets instead of hanging' },
    body: {
      en: 'A generation timeout left the worker wedged, so every later change also hung. It now hard-resets, and the timeout ceiling is high enough for genuinely heavy exports.',
    },
  },
  {
    id: 'split-wall-connectors',
    date: '2026-06-22',
    kind: 'fixed',
    title: { en: 'Split-bin wall connectors actually lock' },
    body: {
      en: 'Connectors on tall and overhung split walls were too slight to hold the pieces together.',
    },
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
    id: 'multicolour-preview',
    date: '2026-06-20',
    kind: 'fixed',
    title: { en: 'Multi-colour preview paints the lid and label shelf' },
    body: {
      en: 'Both were left in the base colour regardless of the zone they belonged to.',
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
    id: 'half-grid-split-crash',
    date: '2026-06-17',
    kind: 'fixed',
    title: { en: 'Half-grid bins no longer crash the split preview' },
    body: {
      en: 'Fractional bin dimensions took the print view down.',
    },
  },
  {
    id: 'scan-card-detection',
    date: '2026-06-17',
    kind: 'fixed',
    title: { en: 'Scanning recovers worn and colour-neutral reference cards' },
    body: {
      en: 'A card with eroded corners, or one printed without colour, was often missed. A card-shaped tool is also no longer mistaken for the card itself.',
    },
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
    id: 'rounded-corner-features',
    date: '2026-06-12',
    kind: 'fixed',
    title: { en: 'Scoops, label supports and tabs stay inside rounded corners' },
    body: {
      en: "Each could push past the bin's rounded outer wall.",
    },
  },
  {
    id: 'watertight-stl',
    date: '2026-06-10',
    kind: 'fixed',
    title: { en: 'Watertight STL across scoops, magnets, chamfers and handles' },
    body: {
      en: 'Combinations of these features produced meshes some slicers rejected.',
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
      en: "A new version installs when you pause rather than reloading mid-task, and the app repairs itself if a stale bundle is left behind. This entry is why the What's New summary exists.",
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
