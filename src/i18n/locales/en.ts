/**
 * English locale - source of truth for all translatable strings.
 *
 * Key naming convention: feature.context.element
 * Examples:
 *   header.layoutName      → Header component, layout name button
 *   toast.binsDeleted      → Toast notification for deleted bins
 *
 * Interpolation uses {variableName} syntax:
 *   "Deleted {count} bin(s)" → t('toast.binsDeleted', { count: 5 })
 *
 * NOTE: Gridfinity-specific terms stay in English across all locales:
 *   bin, drawer, layer, staging/stash, grid unit, height unit, print bed, Gridfinity
 */

const en: Record<string, string> = {
  // ===========================================================================
  // Common / Shared
  // ===========================================================================
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.delete': 'Delete',
  'common.close': 'Close',
  'common.loading': 'Loading...',
  'common.copy': 'Copy',
  'common.copied': 'Copied!',
  'common.download': 'Download',
  'common.rename': 'Rename',
  'common.duplicate': 'Duplicate',
  'common.import': 'Import',
  'common.done': 'Done',
  'common.apply': 'Apply',
  'common.search': 'Search',
  'common.all': 'All',

  // ===========================================================================
  // Header
  // ===========================================================================
  'header.editLayoutName': 'Click to edit layout name',
  'header.layoutName': 'Layout name',
  'header.halfBinMode': 'Half-Bin Mode',
  'header.halfBinModeShort': '½-bin',
  'header.halfBinModeTitle': 'Half-bin mode is active: 0.5 unit precision enabled (press H to toggle)',
  'header.layouts': 'Layouts',
  'header.openLayoutManager': 'Open layout manager',
  'header.print': 'Print',
  'header.printLayout': 'Print layout',
  'header.toggleSidebar': 'Toggle sidebar panel',
  'header.toggleInspector': 'Toggle inspector panel',
  'header.saving': 'Saving...',
  'header.saved': 'Saved',
  'header.undoAction': 'Undo last action ({mod}+Z)',
  'header.undo': 'Undo ({mod}+Z)',
  'header.redoAction': 'Redo last undone action ({mod}+Y or {mod}+Shift+Z)',
  'header.redo': 'Redo ({mod}+Y)',
  'header.discussOnReddit': 'Discuss on Reddit',
  'header.showHelp': 'Show keyboard shortcuts (? or /)',
  'header.helpAndShortcuts': 'Show help and keyboard shortcuts',
  'header.pressForHelp': 'Press',
  'header.forHelp': 'for help',
  'header.help': 'Help',
  'header.loadingLayouts': 'Loading layouts',

  // ===========================================================================
  // Grid Toolbar
  // ===========================================================================
  'toolbar.showLayersPanel': 'Show layers panel',
  'toolbar.exitPaintMode': 'Exit paint mode',
  'toolbar.clickToExitPaint': 'Click to exit paint mode',
  'toolbar.paint': 'Paint {width}×{depth}',
  'toolbar.moveMode': 'Move Mode',
  'toolbar.toMove': 'to move',
  'toolbar.toPlace': 'to place',
  'toolbar.exitMoveMode': 'Exit move mode',
  'toolbar.exitMoveModeEsc': 'Exit move mode (Esc)',
  'toolbar.resizeMode': 'Resize Mode',
  'toolbar.toResize': 'to resize',
  'toolbar.toApply': 'to apply',
  'toolbar.exitResizeMode': 'Exit resize mode',
  'toolbar.exitResizeModeEsc': 'Exit resize mode (Esc)',
  'toolbar.labels': 'Labels',
  'toolbar.showLayersBelow': 'Show layers below',
  'toolbar.zoomControls': 'Zoom controls',
  'toolbar.zoomOut': 'Zoom out',
  'toolbar.zoomOutKey': 'Zoom out (−)',
  'toolbar.zoomIn': 'Zoom in',
  'toolbar.zoomInKey': 'Zoom in (+)',
  'toolbar.fit': 'Fit',
  'toolbar.fitToScreen': 'Fit to screen',
  'toolbar.fitGridToScreen': 'Fit grid to screen',
  'toolbar.3dView': '3D View',
  'toolbar.show3dPreview': 'Show 3D preview',
  'toolbar.hide3dPreview': 'Hide 3D preview',
  'toolbar.moreOptions': 'More options',

  // ===========================================================================
  // Bin Inspector
  // ===========================================================================
  'inspector.bin': '{width}×{depth} Bin',
  'inspector.category': 'Category',
  'inspector.label': 'Label',
  'inspector.notes': 'Notes',
  'inspector.multi.title': '{count} Bins Selected',
  'inspector.multi.category': 'Category',
  'inspector.multi.layer': 'Layer',
  'inspector.multi.delete': 'Delete All',
  'inspector.split.title': 'Oversized for print bed',
  'inspector.split.message': 'This {width}×{depth} bin ({widthMm}×{depthMm}mm) exceeds your print bed ({bedSize}mm). It will be split into smaller pieces for printing.',
  'inspector.split.piecesNeeded': '{count} piece(s) needed',

  // ===========================================================================
  // Layers
  // ===========================================================================
  'layers.title': 'Layers',

  // ===========================================================================
  // Categories
  // ===========================================================================
  'categories.title': 'Categories',
  'categories.addCategory': 'Add category',
  'categories.deleteCategory': 'Delete category',
  'categories.confirmDelete.title': 'Delete Category',
  'categories.confirmDelete.message': 'Delete "{name}"? Bins in this category will be moved to the default category.',
  'categories.confirmDelete.confirm': 'Delete Category',

  // ===========================================================================
  // Print / Export
  // ===========================================================================
  'print.title': 'Print Layout',
  'print.printNow': 'Print Now',
  'print.options': 'Options',
  'print.binDisplay': 'Bin Display',
  'print.showLabel': 'Label',
  'print.showCategoryColor': 'Category color',
  'print.showSize': 'Size',
  'print.showHeight': 'Height',
  'print.showNotes': 'Notes',
  'print.showCustomProperties': 'Custom properties',
  'print.headerOptions': 'Header',
  'print.showHeader': 'Show header',
  'print.showLayoutName': 'Layout name',
  'print.showDrawerInfo': 'Drawer info',
  'print.showDate': 'Date',
  'print.layoutOptions': 'Layout',
  'print.showGridCoordinates': 'Grid coordinates',
  'print.showLegend': 'Legend',
  'print.showBinList': 'Bin list',
  'print.sortOrder': 'Bin list sort',
  'print.summary.title': 'Print List',
  'print.summary.totalBins': '{count} bin(s) total',
  'print.summary.pieces': '{count} piece(s)',
  'print.summary.filament': '~{meters}m filament',
  'print.summary.cost': '~{cost}',
  'print.summary.printTime': '~{hours} print time',
  'print.empty.title': 'No bins to print',
  'print.empty.message': 'Add bins to the grid to see the print list',

  // ===========================================================================
  // Cloud Share
  // ===========================================================================
  'share.title': 'Share Layout',
  'share.tabs.cloud': 'Cloud',
  'share.tabs.link': 'Link',
  'share.tabs.file': 'File',
  'share.tabs.json': 'JSON',
  'share.cloud.description': 'Share via a short link. Others can view your layout online.',
  'share.cloud.publish': 'Publish',
  'share.cloud.publishing': 'Publishing...',
  'share.cloud.updating': 'Updating...',
  'share.cloud.unpublish': 'Unpublish',
  'share.cloud.published': 'Published!',
  'share.cloud.shareLink': 'Share link:',
  'share.cloud.copyLink': 'Copy link',
  'share.cloud.linkCopied': 'Link copied!',
  'share.cloud.permissions': 'Permissions',
  'share.cloud.viewOnly': 'View only',
  'share.cloud.canEdit': 'Can edit',
  'share.cloud.lastUpdated': 'Last updated: {date}',
  'share.link.description': 'The layout is encoded in the URL. No server needed.',
  'share.file.description': 'Download your layout as a JSON file.',
  'share.file.download': 'Download JSON',
  'share.file.downloaded': 'Downloaded!',
  'share.json.description': 'Copy raw JSON to clipboard.',
  'share.json.copy': 'Copy JSON',
  'share.json.copied': 'JSON copied!',
  'share.button.share': 'Share',
  'share.button.shared': 'Shared',
  'share.button.shareLayout': 'Share layout',
  'share.button.manageShare': 'Manage shared layout',
  'share.banner.viewing': 'Viewing shared layout',
  'share.banner.saveToMyLayouts': 'Save to My Layouts',

  // ===========================================================================
  // Layout Library
  // ===========================================================================
  'layouts.confirmDelete.confirm': 'Delete Layout',
  'layouts.import.title': 'Import Layout',
  'layouts.import.browseFiles': 'Browse files',
  'layouts.import.pasteLink': 'Or paste a share link:',

  // ===========================================================================
  // Settings
  // ===========================================================================
  'settings.title': 'Settings',
  'settings.defaultPreferences': 'Default Preferences',
  'settings.defaultPreferencesHint': 'New layouts will use these settings:',
  'settings.drawerSize': 'Drawer size',
  'settings.layerHeight': 'Layer height',
  'settings.printBed': 'Print bed',
  'settings.gridUnit': 'Grid unit',
  'settings.saveCurrentAsDefaults': 'Save Current as Defaults',
  'settings.saveCurrentTitle': 'Save current layout settings as defaults for new layouts',
  'settings.stlSearch': 'STL Search',
  'settings.stlSearchHint': 'Choose which sites to search for Gridfinity STL files:',
  'settings.toggleSite': 'Toggle {name}',
  'settings.privacy': 'Privacy',
  'settings.helpImprove': 'Help improve suggestions',
  'settings.helpImproveHint': 'Share bin sizes and placement patterns (no personal data)',
  'settings.toggleUsageData': 'Toggle usage data collection',
  'settings.language': 'Language',
  'settings.languageHint': 'Choose your preferred language',
  'settings.autoDetect': 'Auto (browser default)',
  'settings.labs': 'Labs',
  'settings.labsHint': 'Try new features before they\'re released. Features may change based on feedback.',
  'settings.labsEmpty': 'No experimental features available right now.',
  'settings.labsCheckBack': 'Check back later!',

  // ===========================================================================
  // Help
  // ===========================================================================
  'help.title': 'Keyboard Shortcuts',

  // ===========================================================================
  // Mobile
  // ===========================================================================
  'mobile.nav.layers': 'Layers',
  'mobile.nav.bin': 'Bin',
  'mobile.nav.categories': 'Categories',
  'mobile.nav.list': 'List',
  'mobile.help': 'Help',
  'mobile.binMenu.editProperties': 'Edit Properties',
  'mobile.binMenu.duplicate': 'Duplicate',
  'mobile.binMenu.rotate': 'Rotate',
  'mobile.binMenu.toStash': 'To Stash',

  // ===========================================================================
  // Error States
  // ===========================================================================
  'error.message': 'An unexpected error occurred.',
  'error.tryAgain': 'Try Again',

  // ===========================================================================
  // Toast Messages
  // ===========================================================================
  'toast.binsDeleted': 'Deleted {count} bin(s)',
  'toast.clearComplete': 'Cleared {count} bin(s) from layer',
  'toast.linkCopied': 'Link copied to clipboard',
  'toast.jsonCopied': 'JSON copied to clipboard',
  'toast.categoryAssigned': 'Category assigned to {count} bin(s)',
  'toast.binsMovedToLayer': '{count} bin(s) moved to layer',

  // ===========================================================================
  // STL Search
  // ===========================================================================
  'stlSearch.findSTL': 'Find STL',
  'stlSearch.findOnSite': 'Find on {site}',
  'stlSearch.searchFor': 'Search for {width}×{depth} bin',
  'stlSearch.searchForSplit': 'Search for split bin generators',

  // ===========================================================================
  // Drawer Settings
  // ===========================================================================
  'drawer.width': 'Width',
  'drawer.depth': 'Depth',
  'drawer.height': 'Height',

  // ===========================================================================
  // Half-Bin Mode Blocked
  // ===========================================================================
  'halfBinBlocked.title': 'Cannot Disable Half-Bin Mode',
  'halfBinBlocked.message': 'Some bins use fractional dimensions. Resize or delete these bins before disabling half-bin mode.',
  'halfBinBlocked.cancelAriaLabel': 'Cancel and keep half-bin mode enabled',
  'halfBinBlocked.close': 'Got it',

  // ===========================================================================
  // Inspiration Gallery
  // ===========================================================================
  'gallery.title': 'Inspiration Gallery',
  'gallery.empty': 'No layouts in the gallery yet',

  // ===========================================================================
  // Tool Switcher
  // ===========================================================================
  'toolSwitcher.gridEditor': 'Grid Editor',
  'toolSwitcher.binDesigner': 'Bin Designer',

  // ===========================================================================
  // Bin Designer
  // ===========================================================================
  'binDesigner.export': 'Export',
  'binDesigner.formatSTL': 'STL',
  'binDesigner.format3MF': '3MF',
};

export default en;
