/**
 * The golden set for Ask AI. Lookups and the "no" group come from real
 * GitHub Discussions threads, paraphrased. `sources` are the pages that a
 * correct answer rests on; the judge reads them. For the gap group they are
 * the nearest pages, which the docs do not answer from.
 */
export type Group = 'lookup' | 'synthesis' | 'no' | 'gap' | 'language' | 'followup' | 'plan';

export interface GoldenCase {
  readonly id: string;
  readonly group: Group;
  /** The docs page the reader is on. */
  readonly page: string;
  readonly locale?: string;
  readonly turns: readonly string[];
  readonly sources: readonly string[];
  readonly expect: string;
}

export const GROUP_RULES: Readonly<Record<Group, string>> = {
  plan: 'Calls plan_layout and shows the plan with [[plan:…]] alone on its own line. Has a bin for each kind of thing that the reader names, with sizes that suit those things, and says that the sizes are a starting point. Names any bins in the stash and why. Writes no link to the plan, and its numbers match the plan_layout result.',
  lookup: 'Correct facts from the source pages, and a link to the right section.',
  synthesis: 'Correct facts from every source page that the question needs.',
  no: 'The first sentence says plainly that the app cannot do it. Then the answer gives the nearest thing the app can do.',
  gap: 'The answer says that the docs do not cover the question, names the nearest pages, and links the Q&A forum. It must not invent an answer.',
  language:
    "The answer is in the language of the question. Each control reads as the reader's app shows it: in a non-English app, its label in the app's language and then the English label in parentheses; in an English app, the English label alone. The facts are correct.",
  followup:
    'The second answer uses the first turn: it reads as a reply in the same conversation, without asking the reader to repeat the context.',
};

export const GOLDEN: readonly GoldenCase[] = [
  // Lookups, from Discussions threads
  {
    id: 'L01',
    group: 'lookup',
    page: '/designer/compartments',
    turns: [
      'I colored a cutout in a design I already saved. Now I want only its floor colored, not the walls too. Where is that switch?',
    ],
    sources: ['/concepts/multi-color'],
    expect:
      "The color choice is part of the cutout's own settings: select the cutout in the saved design and pick floor only instead of floor and walls.",
  },
  {
    id: 'L02',
    group: 'lookup',
    page: '/designer/size-and-shape',
    turns: [
      "My bin is 240 mm long and my printer bed is 225 mm, but the app doesn't split the bin. How do I fix that?",
    ],
    sources: ['/concepts/print-bed-fit'],
    expect:
      'The bin designer checks bins against the print bed of the open layout, which starts at 256 mm. Set Print bed in Physical units to the printer, and keep Split to fit the print bed on. Layout defaults only change new layouts.',
  },
  {
    id: 'L03',
    group: 'lookup',
    page: '/designer/label-plates',
    turns: [
      'I printed a bunch of bins with the swappable label slots. How do I print just the label plates now?',
    ],
    sources: ['/designer/label-plates'],
    expect: 'Export the plates on their own, as the "Export the plates" section says.',
  },
  {
    id: 'L04',
    group: 'lookup',
    page: '/designer/labels-and-text',
    turns: ['My label text is raised. Can I print the raised letters in a different color?'],
    sources: ['/designer/colors'],
    expect:
      'Yes. The text color applies to the label text, raised or cut in; set a color that differs from the body and export a multi-color file.',
  },
  {
    id: 'L05',
    group: 'lookup',
    page: '/layouts/placing-bins',
    turns: [
      "My layout bins are linked to one saved design. How do I get each bin to print the layout's own label?",
    ],
    sources: ['/concepts/saved-designs'],
    expect:
      'Leave the label text of the saved design empty. Then each linked bin prints its own label from the layout.',
  },
  {
    id: 'L06',
    group: 'lookup',
    page: '/cutouts/basics',
    turns: ['Can a cutout go right through a wall, so the slot opens at the side of the bin?'],
    sources: ['/cutouts/basics'],
    expect: 'Yes: open the cutout through a wall and pick which wall.',
  },
  {
    id: 'L07',
    group: 'lookup',
    page: '/cutouts/phone-scan',
    turns: ['Can I export my scanned outline as an SVG to clean it up in another program?'],
    sources: ['/cutouts/import-svg-stl'],
    expect:
      'Yes: export the cutout as SVG from the cut editor, edit it, and bring it back with SVG import.',
  },
  {
    id: 'L08',
    group: 'lookup',
    page: '/designer/getting-things-out',
    turns: ['Can a finger scoop go on both the front and the back wall of one bin?'],
    sources: ['/designer/getting-things-out'],
    expect: 'Yes: the scoop setting picks the walls, so one bin can have scoops on several walls.',
  },
  {
    id: 'L09',
    group: 'lookup',
    page: '/baseplates/basics',
    turns: ['The baseplate generator adds half units to fill my drawer. How do I turn that off?'],
    sources: ['/baseplates/basics'],
    expect: 'Turn off half-grid mode for the baseplate, as the baseplate page says.',
  },
  {
    id: 'L10',
    group: 'lookup',
    page: '/cutouts/basics',
    turns: [
      'Can I print just a thin slice of a bin to check that my tools fit the cutouts, before I print the whole thing?',
    ],
    sources: ['/cutouts/print-checks'],
    expect: 'Yes: a fit test prints a thin slice of the top of the bin with its cutouts.',
  },
  {
    id: 'L11',
    group: 'lookup',
    page: '/layouts/placing-bins',
    turns: ['Can I type a bin height in millimeters instead of height units?'],
    sources: ['/layouts/placing-bins', '/designer/size-and-shape'],
    expect:
      "Yes, in the layout editor: the inspector's Height (mm) field takes millimeters. The bin designer's Height stepper takes height units.",
  },
  {
    id: 'L12',
    group: 'lookup',
    page: '/designer/size-and-shape',
    turns: [
      'My bin is 2.5 by 2 units. The half-unit foot is on the left, but I need it on the right. How do I move it?',
    ],
    sources: ['/designer/size-and-shape'],
    expect: 'Use the side toggle for the half unit, under the size controls, to move it.',
  },
  {
    id: 'L13',
    group: 'lookup',
    page: '/printing/slicers',
    turns: ['Why does my slicer show a different print time than the app does?'],
    sources: ['/printing/estimates'],
    expect:
      "The app's estimates rest on assumptions and are approximate; the slicer's numbers are the ones to trust for the real print.",
  },
  {
    id: 'L14',
    group: 'lookup',
    page: '/printing/file-formats',
    turns: [
      "My bins have labels, but the labels don't show up in the exported file. What's wrong?",
    ],
    sources: ['/printing/troubleshooting'],
    expect: 'Follows the troubleshooting section for labels that are blank or missing.',
  },
  {
    id: 'L15',
    group: 'lookup',
    page: '/designer/walls',
    turns: ['Can I round the inside bottom corners of a bin so small parts slide out easily?'],
    sources: ['/designer/getting-things-out'],
    expect: 'Yes: the interior fillet rounds the edges where the walls meet the floor.',
  },
  {
    id: 'L16',
    group: 'lookup',
    page: '/designer/labels-and-text',
    turns: ['Can I put text on the inside of a bin wall instead of the outside?'],
    sources: ['/designer/labels-and-text'],
    expect: 'Yes: wall text has an outside or inside choice.',
  },
  {
    id: 'L17',
    group: 'lookup',
    page: '/designer/size-and-shape',
    turns: ['Where can I see the inside dimensions of the bin I am designing?'],
    sources: ['/getting-started/first-bin', '/concepts/units'],
    expect: 'The bin designer shows an inside size line under the outside size.',
  },
  {
    id: 'L18',
    group: 'lookup',
    page: '/designer/base',
    turns: ['Can I print bins with smaller feet to save filament, like Footfinity does?'],
    sources: ['/designer/base'],
    expect:
      'The nearest options are detachable feet, and the other filament savers on the base page. The docs do not name Footfinity.',
  },
  {
    id: 'L19',
    group: 'lookup',
    page: '/designer/walls',
    turns: [
      'I want a wall opening that ends at the same height on my 6u and my 12u bins. How do I set that?',
    ],
    sources: ['/designer/walls'],
    expect:
      'Set the opening height in millimeters; in millimeters it is measured down from the rim.',
  },
  {
    id: 'L20',
    group: 'lookup',
    page: '/layouts/placing-bins',
    turns: ['Can I lock the size of a bin in my layout so I do not resize it by accident?'],
    sources: ['/layouts/placing-bins'],
    expect: 'Yes: lock the bin size in the inspector; a locked bin has no resize handles.',
  },
  {
    id: 'L21',
    group: 'lookup',
    page: '/designer/label-plates',
    turns: ['Can a label show an icon, like a screwdriver or a fork, instead of text?'],
    sources: ['/designer/label-plates', '/designer/labels-and-text'],
    expect: 'Yes: labels can carry an icon, as the label pages say.',
  },
  {
    id: 'L22',
    group: 'lookup',
    page: '/cutouts/phone-scan',
    turns: ['My phone scan came out slightly off. Can I edit the edges of the outline?'],
    sources: ['/cutouts/photo-trace', '/cutouts/phone-scan'],
    expect: 'Yes: tidy up the outline and edit its points up close.',
  },

  {
    id: 'L23',
    group: 'lookup',
    page: '/printing/troubleshooting',
    turns: ['How do I report a bug in the Layout Tool?'],
    sources: ['/getting-started/workspace-tour'],
    expect: 'Use the Feedback button in the header, which opens the issue tracker.',
  },

  {
    id: 'L24',
    group: 'lookup',
    page: '/sharing/accounts-and-sync',
    turns: ['How many layouts can I keep in my cloud account? Is there a storage limit?'],
    sources: ['/sharing/accounts-and-sync'],
    expect:
      'Each account syncs up to 100 layouts and 10 MB, and up to 100 saved bin designs and 10 MB.',
  },

  // Synthesis across pages
  {
    id: 'S01',
    group: 'synthesis',
    page: '/designer/lids',
    turns: [
      'I want a bin with a lid that holds on with magnets, and that still stacks. What do I set?',
    ],
    sources: ['/designer/lids', '/designer/stacking', '/recipes/lidded-boxes'],
    expect:
      'Turn on the lid with the magnetic attachment, and the stacking settings that the pages name.',
  },
  {
    id: 'S02',
    group: 'synthesis',
    page: '/recipes/screw-drawer',
    turns: ['How do I set up a screw drawer with swappable labels printed in two colors?'],
    sources: ['/recipes/screw-drawer', '/designer/label-plates', '/designer/colors'],
    expect:
      'Label plates for swappable labels, a text color for two-color printing, and the steps of the recipe.',
  },
  {
    id: 'S03',
    group: 'synthesis',
    page: '/layouts/drawer-setup',
    turns: [
      'My drawer is 420 by 310 mm inside and 60 mm deep. What grid fits, and how tall can my bins be?',
    ],
    sources: ['/concepts/units', '/layouts/drawer-setup'],
    expect:
      'Uses the drawer_fit result for the grid, the spare room and the bin height, and the numbers match that result.',
  },
  {
    id: 'S04',
    group: 'synthesis',
    page: '/cutouts/photo-trace',
    turns: [
      'How do I make pockets for my pliers from a photo, and test the fit before I print the whole bin?',
    ],
    sources: ['/cutouts/photo-trace', '/cutouts/print-checks', '/recipes/hand-tool-pockets'],
    expect:
      'Trace the tool from a photo into a cutout, then print a fit test slice before the full bin.',
  },
  {
    id: 'S05',
    group: 'synthesis',
    page: '/printing/file-formats',
    turns: ['How do I print every bin and the baseplate for my drawer in one go?'],
    sources: ['/printing/print-list-and-zip', '/baseplates/splitting'],
    expect:
      'The print list and the ZIP export hold every part of the layout, with plates split for the bed.',
  },
  {
    id: 'S06',
    group: 'synthesis',
    page: '/designer/save-and-reuse',
    turns: [
      "What's the difference between a linked bin and a copy of a saved design, and how do labels work for each?",
    ],
    sources: ['/concepts/saved-designs'],
    expect:
      'A linked bin follows the saved design; a copy does not. Labels follow the rules on the page.',
  },
  {
    id: 'S07',
    group: 'synthesis',
    page: '/layouts/layers',
    turns: ['My drawer is deep. Can I put a layer of trays on top of the bins?'],
    sources: ['/recipes/deep-tool-drawer', '/layouts/layers'],
    expect: 'Yes: layers stack bins in the drawer, as the deep drawer recipe shows.',
  },
  {
    id: 'S08',
    group: 'synthesis',
    page: '/designer/base',
    turns: ['What are the ways to make bins and baseplates use less filament?'],
    sources: ['/designer/base', '/baseplates/eco-and-stack-printing', '/designer/walls'],
    expect: 'Names the filament savers from the base, wall and baseplate pages.',
  },
  {
    id: 'S09',
    group: 'synthesis',
    page: '/introduction/your-data',
    turns: ['Can I work on my layouts from my laptop and from my desktop?'],
    sources: ['/sharing/accounts-and-sync', '/introduction/your-data'],
    expect: 'Yes, with an account and sync; without it, layouts stay in the browser.',
  },
  {
    id: 'S10',
    group: 'synthesis',
    page: '/concepts/multi-color',
    turns: [
      'I want the floor of a cutout in a second color. What do I set in the app, and what do I need in the slicer?',
    ],
    sources: ['/concepts/multi-color', '/printing/slicers'],
    expect:
      'Color the cutout floor in the app, export a multi-color 3MF, and load it as the slicer page says.',
  },
  {
    id: 'S11',
    group: 'synthesis',
    page: '/layouts/drawer-setup',
    turns: [
      "My drawer isn't a rectangle; one corner is cut off. How do I make bins and a baseplate that fit?",
    ],
    sources: ['/layouts/drawer-setup', '/baseplates/odd-shaped-drawers'],
    expect:
      'Draw or import the drawer outline, and make the baseplate for a drawer that is not a rectangle.',
  },
  {
    id: 'S12',
    group: 'synthesis',
    page: '/printing/slicers',
    turns: ['Which file format should I export for Bambu Studio, and why?'],
    sources: ['/printing/file-formats', '/printing/slicers'],
    expect: 'The format that the pages recommend for that slicer, with the reason they give.',
  },

  // "Can it do X?" with a "no" answer
  {
    id: 'N01',
    group: 'no',
    page: '/cutouts/import-svg-stl',
    turns: ['Can I import a STEP file of my part to cut a pocket for it?'],
    sources: ['/cutouts/import-svg-stl'],
    expect: 'No: cutouts import SVG and STL shapes. Export the part as STL and import that.',
  },
  {
    id: 'N02',
    group: 'no',
    page: '/printing/file-formats',
    turns: ['Can I send a bin straight to my printer from the app?'],
    sources: ['/printing/file-formats', '/printing/slicers'],
    expect:
      'No: the app exports a file to open in the slicer. The nearest is Send to a URL, which sends each export to a receiver at a web address, such as a NAS.',
  },
  {
    id: 'N03',
    group: 'no',
    page: '/settings/offline',
    turns: ['Is there an iPhone or Android app in the app stores?'],
    sources: ['/settings/offline'],
    expect:
      'No store app is named in the docs; the nearest thing is to install the site as an app from the browser.',
  },
  {
    id: 'N04',
    group: 'no',
    page: '/designer/walls',
    turns: ['Can I set a different wall thickness on each wall of one bin?'],
    sources: ['/designer/walls'],
    expect: 'No: one wall thickness applies to the whole bin.',
  },
  {
    id: 'N05',
    group: 'no',
    page: '/designer/base',
    turns: ['Can I change the angle of the sloped feet so the bins print faster?'],
    sources: ['/concepts/bin-anatomy', '/designer/base'],
    expect:
      'No: the feet keep the Gridfinity profile so they seat in a baseplate. Nearest: the base options on the base page.',
  },
  {
    id: 'N06',
    group: 'no',
    page: '/settings/keyboard-and-command-palette',
    turns: ['Can I undo more than 100 steps?'],
    sources: ['/reference/faq'],
    expect: 'No: the layout editor and the bin designer each keep the last 100 changes.',
  },
  {
    id: 'N07',
    group: 'no',
    page: '/printing/file-formats',
    turns: ['Can I export a bin as an OpenSCAD file so I can edit its code?'],
    sources: ['/printing/file-formats', '/reference/design-file'],
    expect: 'No OpenSCAD export; the nearest are STEP for CAD, or the bin design file.',
  },
  {
    id: 'N08',
    group: 'no',
    page: '/introduction/gridfinity-basics',
    turns: ['Can I make bins on a hexagonal grid instead of squares?'],
    sources: ['/introduction/gridfinity-basics'],
    expect: 'No: the grid is square. The nearest is a different grid size.',
  },

  // Doc-gap traps: on topic, but not in the docs
  {
    id: 'G01',
    group: 'gap',
    page: '/index',
    turns: ['Who makes the Layout Tool?'],
    sources: [],
    expect: 'The docs do not name who makes the Layout Tool.',
  },
  {
    id: 'G02',
    group: 'gap',
    page: '/index',
    turns: ['Is there a Discord server for people who use the Layout Tool?'],
    sources: [],
    expect: 'The docs name no Discord server.',
  },
  {
    id: 'G03',
    group: 'gap',
    page: '/sharing/community',
    turns: ['Can I sell prints of bins that I designed with the Layout Tool?'],
    sources: ['/sharing/community'],
    expect: 'The docs say nothing about selling prints.',
  },
  {
    id: 'G04',
    group: 'gap',
    page: '/introduction/gridfinity-basics',
    turns: ['Is Multiboard support planned for the Layout Tool?'],
    sources: [],
    expect: 'The docs say nothing about plans or Multiboard.',
  },
  {
    id: 'G05',
    group: 'gap',
    page: '/sharing/community',
    turns: ['How does a design get featured in the community gallery?'],
    sources: ['/sharing/community'],
    expect: 'The docs do not describe featured designs.',
  },
  {
    id: 'G06',
    group: 'gap',
    page: '/reference/dimensions',
    turns: ['Does the Layout Tool support Gridfinity Rebuilt bins?'],
    sources: ['/reference/dimensions'],
    expect: 'The docs do not mention Gridfinity Rebuilt.',
  },
  {
    id: 'G07',
    group: 'gap',
    page: '/settings/settings',
    turns: ['Can I help translate the Layout Tool into my language?'],
    sources: ['/settings/settings'],
    expect: 'The docs do not describe helping with translations.',
  },
  {
    id: 'G08',
    group: 'gap',
    page: '/sharing/live-collaboration',
    turns: ['How many people can be in one live session at the same time?'],
    sources: ['/sharing/live-collaboration'],
    expect: 'The docs state no limit on people in a session.',
  },

  // Other languages
  {
    id: 'X01',
    group: 'language',
    page: '/designer/lids',
    locale: 'de',
    turns: ['Wie füge ich einem Behälter einen Deckel hinzu?'],
    sources: ['/designer/lids'],
    expect: 'In German: open the lid group, turn on the lid, and pick how it attaches.',
  },
  {
    id: 'X02',
    group: 'language',
    page: '/designer/label-plates',
    locale: 'fr',
    turns: ["Comment imprimer seulement les plaques d'étiquettes amovibles ?"],
    sources: ['/designer/label-plates'],
    expect: 'In French: export the label plates on their own.',
  },
  {
    id: 'X03',
    group: 'language',
    page: '/baseplates/basics',
    locale: 'es',
    turns: ['¿Cómo pongo imanes en la placa base?'],
    sources: ['/baseplates/magnets-and-screws'],
    expect: 'In Spanish: the magnet hole settings of the baseplate.',
  },
  {
    id: 'X04',
    group: 'language',
    page: '/designer/lids',
    locale: 'nl',
    turns: ['Kan ik gaten of sleuven in het deksel van een bak maken?'],
    sources: ['/designer/lids'],
    expect: 'In Dutch: yes, cut holes in the lid.',
  },
  {
    id: 'X05',
    group: 'language',
    page: '/concepts/units',
    locale: 'ja',
    turns: ['ビンの高さをミリメートルで入力できますか？'],
    sources: ['/layouts/placing-bins', '/designer/size-and-shape'],
    expect:
      "In Japanese: yes, in the layout editor the inspector's Height (mm) field takes millimeters; the bin designer's Height stepper takes height units.",
  },
  {
    id: 'X06',
    group: 'language',
    page: '/baseplates/basics',
    locale: 'pt-BR',
    turns: ['Como divido uma placa base grande para caber na minha impressora?'],
    sources: ['/baseplates/splitting'],
    expect: 'In Brazilian Portuguese: split the baseplate for the print bed.',
  },

  {
    id: 'X07',
    group: 'language',
    page: '/designer/lids',
    locale: 'en',
    turns: ['Wie füge ich einem Behälter einen Deckel hinzu?'],
    sources: ['/designer/lids'],
    expect:
      'In German, because the question is German, with the English control labels alone, because the app is in English.',
  },
  {
    id: 'X08',
    group: 'language',
    page: '/designer/lids',
    locale: 'de',
    turns: ['How do I add a lid to a bin?'],
    sources: ['/designer/lids'],
    expect:
      'In English, because the question is English, with each control as its German label and the English label in parentheses, because the app is in German.',
  },

  // Follow-up pairs
  {
    id: 'F01',
    group: 'followup',
    page: '/designer/base',
    turns: ['How do I add magnet holes to a bin?', 'And to the baseplate?'],
    sources: ['/designer/base', '/baseplates/magnets-and-screws'],
    expect: 'The second answer gives the baseplate magnet settings.',
  },
  {
    id: 'F02',
    group: 'followup',
    page: '/designer/lids',
    turns: ['How do I add a lid to a bin?', 'Can it slide on instead?'],
    sources: ['/designer/lids'],
    expect: 'The second answer covers sliding lids.',
  },
  {
    id: 'F03',
    group: 'followup',
    page: '/baseplates/splitting',
    turns: [
      'How do I split a baseplate that is bigger than my printer?',
      'How do the pieces stay together?',
    ],
    sources: ['/baseplates/splitting'],
    expect: 'The second answer covers how the split pieces lock together.',
  },
  {
    id: 'F04',
    group: 'followup',
    page: '/layouts/drawer-setup',
    turns: [
      'What grid fits a drawer that is 400 by 300 mm inside?',
      'And if the drawer is only 50 mm deep, how tall can the bins be?',
    ],
    sources: ['/layouts/drawer-setup', '/concepts/units'],
    expect: 'The second answer uses the same drawer and gives the height from drawer_fit.',
  },
  {
    id: 'F05',
    group: 'followup',
    page: '/cutouts/photo-trace',
    turns: [
      'How do I trace a tool from a photo?',
      'The trace got one corner wrong. How do I fix it?',
    ],
    sources: ['/cutouts/photo-trace'],
    expect: 'The second answer covers editing the points of the outline.',
  },
  {
    id: 'F06',
    group: 'followup',
    page: '/sharing/share-links',
    turns: ['Can I share a layout with a friend?', 'Can we both edit it at the same time?'],
    sources: ['/sharing/share-links', '/sharing/live-collaboration'],
    expect: 'The second answer covers live sessions.',
  },

  {
    id: 'L25',
    group: 'lookup',
    page: '/printing/slicers',
    turns: ['print settings?'],
    sources: ['/settings/settings', '/printing/slicers'],
    expect:
      "The app's print values are on the Print & material tab of Settings: filament cost, layer height, infill and nozzle size. Exported files carry no slicer profile, so the slicer keeps its own printer, filament and process profiles.",
  },
  {
    id: 'L26',
    group: 'lookup',
    page: '/baseplates/basics',
    turns: ['connectors for split parts'],
    sources: ['/baseplates/splitting'],
    expect:
      'Pick a style under Connectors in the Base section, which shows only when the plate splits: None, Dovetail, Puzzle, Puzzle key or Snap clip. Puzzle key and Snap clip are separate small parts that the export includes.',
  },
  {
    id: 'L27',
    group: 'lookup',
    page: '/designer/save-and-reuse',
    turns: ['reset to default'],
    sources: ['/designer/save-and-reuse', '/settings/settings'],
    expect:
      'To go back to the factory settings for new bins: in Saved designs, open More options and click Reset to factory defaults, or in Settings open Categories & bins and click Reset next to New bin defaults. Existing designs do not change.',
  },
  {
    id: 'N09',
    group: 'no',
    page: '/designer/stacking',
    turns: ['i want a bin in a bin'],
    sources: ['/designer/stacking', '/designer/special-bins', '/designer/compartments'],
    expect:
      'The app has no bin that holds other Gridfinity bins inside it. The nearest options: small bins locked onto the lip of a bigger bin with Lip notches, a sliding tray inside a bin (Labs), or compartments inside one bin.',
  },
  {
    id: 'L28',
    group: 'lookup',
    page: '/layouts/drawer-setup',
    turns: ['Can I put everything in centimeter instead of the unit thing?'],
    sources: ['/concepts/units', '/settings/settings'],
    expect:
      'Grid sizes stay in grid units and height units. In Settings, on the General tab, set Measure in to Centimeters: the drawer height, the measured drawer size and the baseplate plate size then show and take centimeters.',
  },
  // Plans: Ask AI places the bins with the app's own code and draws the result.
  {
    id: 'P01',
    group: 'plan',
    page: '/getting-started/first-drawer',
    turns: [
      'My drawer is 40 x 30 cm and 8 cm deep. Can you plan bins for M3, M4 and M5 screws, a set of hex keys and a tape measure?',
    ],
    sources: ['/layouts/drawer-setup', '/concepts/units', '/layouts/placing-bins'],
    expect:
      'Plans the 40 x 30 cm drawer with bins for the three screw sizes, the hex keys and the tape measure, shows the plan, and keeps bin heights under the 8 cm drawer. The grid is 9 x 7, or 9.5 x 7 when a bin takes half units; the answer gives the grid that plan_layout reports.',
  },
  {
    id: 'P02',
    group: 'plan',
    page: '/recipes/screw-drawer',
    turns: [
      'Plan a 13 x 10 inch drawer with 1 x 1 bins for M2, M3, M4, M5, M6 and M8 screws, two bins of each.',
    ],
    sources: ['/recipes/screw-drawer', '/layouts/drawer-setup'],
    expect:
      'Plans twelve 1 x 1 bins, two for each screw size, on the 7 x 6 grid of a 13 x 10 inch drawer, and shows the plan.',
  },
  {
    id: 'P03',
    group: 'plan',
    page: '/layouts/placing-bins',
    turns: [
      'My drawer is only 20 x 20 cm. Plan a 3 x 3 bin for my multimeter and four 2 x 2 bins for probes and clips.',
    ],
    sources: ['/layouts/placing-bins', '/concepts/layouts-layers-stash'],
    expect:
      'The drawer takes a 4 x 4 grid. The 3 x 3 bin fits, and the 2 x 2 bins do not: the answer says that they went to the stash for lack of room, and suggests a change that lets them fit, such as narrower bins.',
  },
  {
    id: 'P04',
    group: 'plan',
    page: '/layouts/drawer-setup',
    turns: ['My drawer is a 6 x 4 grid. Plan bins for scissors, tape, glue sticks and markers.'],
    sources: ['/layouts/placing-bins', '/layouts/drawer-setup'],
    expect:
      'Plans the 6 x 4 grid without a measurement, with a bin for each of the four things, shows the plan, and says that the sizes are a starting point.',
  },
];
