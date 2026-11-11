import type { DefaultTheme } from 'vitepress';

export const APP_URL = 'https://gridfinitylayouttool.com';

export const nav: DefaultTheme.NavItem[] = [
  { text: 'Docs', link: '/introduction/what-it-does' },
  { text: 'Reference', link: '/reference/shortcuts' },
  { text: 'Community', link: `${APP_URL}/community`, target: '_self' },
  { text: 'Open the app', link: `${APP_URL}/`, target: '_self' },
];

export const sidebar: DefaultTheme.SidebarItem[] = [
  {
    text: 'Introduction',
    items: [
      { text: 'What the Layout Tool does', link: '/introduction/what-it-does' },
      { text: 'Gridfinity in five minutes', link: '/introduction/gridfinity-basics' },
      { text: 'Your data and privacy', link: '/introduction/your-data' },
    ],
  },
  {
    text: 'Getting started',
    items: [
      { text: 'Plan your first drawer', link: '/getting-started/first-drawer' },
      { text: 'Design your first bin', link: '/getting-started/first-bin' },
      { text: 'Make your first baseplate', link: '/getting-started/first-baseplate' },
      { text: 'A tour of the workspace', link: '/getting-started/workspace-tour' },
    ],
  },
  {
    text: 'Recipes',
    items: [
      { text: 'A screw and small-parts drawer', link: '/recipes/screw-drawer' },
      { text: 'A deep tool drawer in two layers', link: '/recipes/deep-tool-drawer' },
      { text: 'A kitchen utensil drawer', link: '/recipes/kitchen-utensil-drawer' },
      { text: 'Hand tools with custom pockets', link: '/recipes/hand-tool-pockets' },
      { text: 'An electronics and craft organizer', link: '/recipes/electronics-craft-organizer' },
    ],
  },
  {
    text: 'Core concepts',
    items: [
      { text: 'Units and sizes', link: '/concepts/units' },
      { text: 'Layouts, layers and the stash', link: '/concepts/layouts-layers-stash' },
      { text: 'Saved designs and linked bins', link: '/concepts/saved-designs' },
      { text: 'Anatomy of a bin', link: '/concepts/bin-anatomy' },
      { text: 'Preview and export', link: '/concepts/preview-and-export' },
      { text: 'Fitting the print bed', link: '/concepts/print-bed-fit' },
      { text: 'Multi-color printing', link: '/concepts/multi-color' },
    ],
  },
  {
    text: 'Planning layouts',
    items: [
      { text: 'Set up the drawer', link: '/layouts/drawer-setup' },
      { text: 'Place and edit bins', link: '/layouts/placing-bins' },
      { text: 'Work with several bins', link: '/layouts/multi-select' },
      { text: 'Work in layers', link: '/layouts/layers' },
      { text: 'Categories and colors', link: '/layouts/categories' },
      { text: 'Organize your layouts', link: '/layouts/organizing-layouts' },
      { text: 'Find bins that fit', link: '/layouts/find-bins-that-fit' },
    ],
  },
  {
    text: 'Designing bins',
    items: [
      { text: 'Size and shape', link: '/designer/size-and-shape' },
      { text: 'The base', link: '/designer/base' },
      { text: 'Walls', link: '/designer/walls' },
      { text: 'Compartments and dividers', link: '/designer/compartments' },
      { text: 'Scoops, fillets and pull tabs', link: '/designer/getting-things-out' },
      { text: 'Stacking', link: '/designer/stacking' },
      { text: 'Labels and text', link: '/designer/labels-and-text' },
      { text: 'Swappable label plates', link: '/designer/label-plates' },
      { text: 'Lids', link: '/designer/lids' },
      { text: 'Colors', link: '/designer/colors' },
      { text: 'Special bins', link: '/designer/special-bins' },
      { text: 'Save and reuse designs', link: '/designer/save-and-reuse' },
    ],
  },
  {
    text: 'Cutouts and pockets',
    items: [
      { text: 'Cutout basics', link: '/cutouts/basics' },
      { text: 'Arrange cutouts', link: '/cutouts/arranging' },
      { text: 'Import SVG and STL shapes', link: '/cutouts/import-svg-stl' },
      { text: 'Trace a photo', link: '/cutouts/photo-trace' },
      { text: 'Scan with your phone', link: '/cutouts/phone-scan' },
      { text: 'Check before you print', link: '/cutouts/print-checks' },
      { text: 'Workshop', link: '/cutouts/workshop' },
    ],
  },
  {
    text: 'Baseplates',
    items: [
      { text: 'Baseplate basics', link: '/baseplates/basics' },
      { text: 'Magnets and screws', link: '/baseplates/magnets-and-screws' },
      { text: 'Split for your print bed', link: '/baseplates/splitting' },
      { text: 'Drawers that are not rectangles', link: '/baseplates/odd-shaped-drawers' },
      { text: 'Eco plates and stack printing', link: '/baseplates/eco-and-stack-printing' },
    ],
  },
  {
    text: 'Printing and export',
    items: [
      { text: 'File formats', link: '/printing/file-formats' },
      { text: 'The print list and ZIP export', link: '/printing/print-list-and-zip' },
      { text: 'Slicer setup', link: '/printing/slicers' },
      { text: 'Fit and tolerances', link: '/printing/fit-and-tolerances' },
      { text: 'Filament and time estimates', link: '/printing/estimates' },
      { text: 'Troubleshooting prints', link: '/printing/troubleshooting' },
    ],
  },
  {
    text: 'Sharing and accounts',
    items: [
      { text: 'Share a layout', link: '/sharing/share-links' },
      { text: 'Work together live', link: '/sharing/live-collaboration' },
      { text: 'Accounts and sync', link: '/sharing/accounts-and-sync' },
      { text: 'The community gallery', link: '/sharing/community' },
    ],
  },
  {
    text: 'Settings',
    items: [
      { text: 'Settings and accessibility', link: '/settings/settings' },
      { text: 'Keyboard and command palette', link: '/settings/keyboard-and-command-palette' },
      { text: 'SpaceMouse', link: '/settings/spacemouse' },
      { text: 'Labs', link: '/settings/labs' },
      { text: 'Install and work offline', link: '/settings/offline' },
    ],
  },
  {
    text: 'Reference',
    items: [
      { text: 'Keyboard shortcuts', link: '/reference/shortcuts' },
      { text: 'Layout file format', link: '/reference/layout-file' },
      { text: 'Bin design file format', link: '/reference/design-file' },
      { text: 'Gridfinity dimensions', link: '/reference/dimensions' },
      { text: 'Glossary', link: '/reference/glossary' },
      { text: 'FAQ', link: '/reference/faq' },
      { text: 'Self-hosting with Docker', link: '/reference/self-hosting' },
    ],
  },
];
