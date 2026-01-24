/**
 * English locale - source of truth for all translatable strings.
 *
 * Key naming convention: feature.context.element
 * Examples:
 *   header.layoutName      → Header component, layout name button
 *   inspector.width        → Bin inspector, width label
 *   toast.layoutSaved      → Toast notification for saved layout
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
  'common.confirm': 'Confirm',
  'common.delete': 'Delete',
  'common.close': 'Close',
  'common.loading': 'Loading...',
  'common.copy': 'Copy',
  'common.copied': 'Copied!',
  'common.download': 'Download',
  'common.edit': 'Edit',
  'common.rename': 'Rename',
  'common.duplicate': 'Duplicate',
  'common.export': 'Export',
  'common.import': 'Import',
  'common.share': 'Share',
  'common.done': 'Done',
  'common.reset': 'Reset',
  'common.apply': 'Apply',
  'common.add': 'Add',
  'common.remove': 'Remove',
  'common.search': 'Search',
  'common.none': 'None',
  'common.all': 'All',
  'common.yes': 'Yes',
  'common.no': 'No',
  'common.ok': 'OK',
  'common.back': 'Back',
  'common.next': 'Next',
  'common.or': 'or',
  'common.current': '(current)',

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
  'inspector.deselectBin': 'Deselect bin',
  'inspector.width': 'Width',
  'inspector.depth': 'Depth',
  'inspector.height': 'Height',
  'inspector.clearance': 'Clearance',
  'inspector.clearanceTitle': 'Extra blocked space above for tall contents',
  'inspector.clearanceAbove': '+{mm}mm above',
  'inspector.swapDimensions': 'Swap width ↔ depth (R)',
  'inspector.swapWidthDepth': 'Swap width and depth',
  'inspector.category': 'Category',
  'inspector.layer': 'Layer',
  'inspector.label': 'Label',
  'inspector.labelPlaceholder': 'Optional label',
  'inspector.notes': 'Notes',
  'inspector.notesPlaceholder': 'e.g., 2 dividers, STL link, contents',
  'inspector.binWidth': 'Bin width',
  'inspector.binDepth': 'Bin depth',
  'inspector.binHeight': 'Bin height',
  'inspector.binClearance': 'Bin clearance',
  'inspector.binCategory': 'Bin category',
  'inspector.binLayer': 'Bin layer',
  'inspector.binLabel': 'Bin label',
  'inspector.binNotes': 'Bin notes',
  'inspector.toStash': 'To Stash',
  'inspector.findSTL': 'Find STL',

  // Multi-bin inspector
  'inspector.multi.title': '{count} Bins Selected',
  'inspector.multi.category': 'Category',
  'inspector.multi.layer': 'Layer',
  'inspector.multi.mixed': 'Mixed',
  'inspector.multi.toStash': 'All to Stash',
  'inspector.multi.delete': 'Delete All',
  'inspector.multi.deselectAll': 'Deselect all',
  'inspector.multi.rotate': 'Rotate All',
  'inspector.multi.duplicate': 'Duplicate All',

  // Empty state
  'inspector.empty.title': 'No bin selected',
  'inspector.empty.instruction': 'Click a bin on the grid or draw to create one',
  'inspector.empty.drawHint': 'Drag on grid to draw a new bin',

  // Split warning
  'inspector.split.title': 'Oversized for print bed',
  'inspector.split.message': 'This {width}×{depth} bin ({widthMm}×{depthMm}mm) exceeds your print bed ({bedSize}mm). It will be split into smaller pieces for printing.',
  'inspector.split.piecesNeeded': '{count} piece(s) needed',

  // Custom properties
  'inspector.customProps.title': 'Custom Properties',
  'inspector.customProps.add': 'Add Property',
  'inspector.customProps.keyPlaceholder': 'Key',
  'inspector.customProps.valuePlaceholder': 'Value',
  'inspector.customProps.remove': 'Remove property',
  'inspector.customProps.limit': 'Maximum {max} properties reached',

  // ===========================================================================
  // Layers Panel
  // ===========================================================================
  'layers.title': 'Layers',
  'layers.addLayer': 'Add layer',
  'layers.deleteLayer': 'Delete layer',
  'layers.renameLayer': 'Rename layer',
  'layers.moveUp': 'Move layer up',
  'layers.moveDown': 'Move layer down',
  'layers.heightLabel': 'Height',
  'layers.heightUnit': '{height}u',
  'layers.binCount': '{count} bin(s)',
  'layers.active': 'Active',
  'layers.setActive': 'Set as active layer',
  'layers.confirmDelete.title': 'Delete Layer',
  'layers.confirmDelete.message': 'Delete "{name}"? The {count} bin(s) on this layer will be moved to the Stash.',
  'layers.confirmDelete.confirm': 'Delete Layer',
  'layers.maxReached': 'Maximum {max} layers reached',
  'layers.editHeight': 'Edit layer height',
  'layers.nameInput': 'Layer name',

  // Active layer panel
  'layers.activeLayer': 'Active Layer',
  'layers.drawerSize': 'Drawer: {width}×{depth}×{height}u',
  'layers.gridUnit': 'Grid unit: {mm}mm',
  'layers.heightUnitLabel': 'Height unit: {mm}mm',
  'layers.printBed': 'Print bed: {mm}mm',

  // ===========================================================================
  // Categories Panel
  // ===========================================================================
  'categories.title': 'Categories',
  'categories.addCategory': 'Add category',
  'categories.deleteCategory': 'Delete category',
  'categories.renameCategory': 'Rename category',
  'categories.changeColor': 'Change color',
  'categories.binCount': '{count} bin(s)',
  'categories.confirmDelete.title': 'Delete Category',
  'categories.confirmDelete.message': 'Delete "{name}"? Bins in this category will be moved to the default category.',
  'categories.confirmDelete.confirm': 'Delete Category',
  'categories.maxReached': 'Maximum {max} categories reached',
  'categories.nameInput': 'Category name',
  'categories.default': 'Default',

  // ===========================================================================
  // Staging / Stash
  // ===========================================================================
  'staging.title': 'Stash',
  'staging.empty': 'Empty',
  'staging.emptyHint': 'Bins moved here can be placed back on the grid later',
  'staging.binCount': '{count} bin(s)',
  'staging.clearAll': 'Clear all',
  'staging.confirmClear.title': 'Clear Stash',
  'staging.confirmClear.message': 'Delete all {count} bin(s) from the stash? This cannot be undone.',
  'staging.confirmClear.confirm': 'Clear All',
  'staging.dragToGrid': 'Drag to place on grid',
  'staging.delete': 'Delete from stash',

  // ===========================================================================
  // Print / Export
  // ===========================================================================
  'print.title': 'Print Layout',
  'print.preview': 'Preview',
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
  'print.orientation': 'Orientation',
  'print.portrait': 'Portrait',
  'print.landscape': 'Landscape',
  'print.sortOrder': 'Bin list sort',

  // Print list summary
  'print.summary.title': 'Print List',
  'print.summary.totalBins': '{count} bin(s) total',
  'print.summary.uniqueSizes': '{count} unique size(s)',
  'print.summary.pieces': '{count} piece(s)',
  'print.summary.splitRequired': 'Split required',
  'print.summary.filament': '~{grams}g filament',
  'print.summary.cost': '~{cost}',
  'print.summary.printTime': '~{hours} print time',

  // Print list empty
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

  // Cloud share
  'share.cloud.description': 'Share via a short link. Others can view your layout online.',
  'share.cloud.publish': 'Publish',
  'share.cloud.publishing': 'Publishing...',
  'share.cloud.update': 'Update',
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

  // Link share
  'share.link.description': 'The layout is encoded in the URL. No server needed.',
  'share.link.generate': 'Generate Link',
  'share.link.copyLink': 'Copy Link',
  'share.link.urlCopied': 'URL copied to clipboard!',

  // File share
  'share.file.description': 'Download your layout as a JSON file.',
  'share.file.download': 'Download JSON',
  'share.file.downloaded': 'Downloaded!',
  'share.file.filename': 'Filename',

  // JSON share
  'share.json.description': 'Copy raw JSON to clipboard.',
  'share.json.copy': 'Copy JSON',
  'share.json.copied': 'JSON copied!',

  // Share button
  'share.button.share': 'Share',
  'share.button.shared': 'Shared',
  'share.button.shareLayout': 'Share layout',
  'share.button.manageShare': 'Manage shared layout',

  // Shared layout banner
  'share.banner.viewing': 'Viewing shared layout',
  'share.banner.by': 'by {name}',
  'share.banner.saveToMyLayouts': 'Save to My Layouts',
  'share.banner.saved': 'Saved!',
  'share.banner.viewingReadOnly': 'View only — save a copy to edit',
  'share.banner.openOriginal': 'Open original',

  // ===========================================================================
  // Layout Library / Manager
  // ===========================================================================
  'layouts.title': 'Layouts',
  'layouts.tabs.myLayouts': 'My Layouts',
  'layouts.tabs.shared': 'Shared',
  'layouts.tabs.import': 'Import',
  'layouts.newLayout': 'New Layout',
  'layouts.importLayout': 'Import Layout',
  'layouts.deleteLayout': 'Delete Layout',
  'layouts.duplicateLayout': 'Duplicate layout',
  'layouts.renameLayout': 'Rename layout',
  'layouts.shareLayout': 'Share layout',
  'layouts.active': 'Active',
  'layouts.lastModified': 'Modified {date}',
  'layouts.binCount': '{count} bin(s)',
  'layouts.emptyState': 'No layouts yet',
  'layouts.emptyHint': 'Create your first layout to get started',
  'layouts.sharedEmpty': 'No shared layouts yet',
  'layouts.sharedHint': 'Layouts shared with you will appear here',
  'layouts.importHint': 'Import layouts from JSON files or shared links',
  'layouts.confirmDelete.title': 'Delete Layout',
  'layouts.confirmDelete.message': 'Delete "{name}"? This cannot be undone.',
  'layouts.confirmDelete.confirm': 'Delete Layout',
  'layouts.countWarning': '{count} of {max} layouts used',
  'layouts.maxReached': 'Maximum {max} layouts reached',

  // Import
  'layouts.import.title': 'Import Layout',
  'layouts.import.dropHint': 'Drop a JSON file here or click to browse',
  'layouts.import.browseFiles': 'Browse files',
  'layouts.import.pasteJson': 'Or paste JSON:',
  'layouts.import.pasteLink': 'Or paste a share link:',
  'layouts.import.importing': 'Importing...',
  'layouts.import.success': 'Layout imported successfully!',
  'layouts.import.error': 'Failed to import layout',
  'layouts.import.invalidJson': 'Invalid JSON format',
  'layouts.import.invalidLayout': 'Invalid layout data',

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
  'settings.confirmSaveDefaults.title': 'Save as Defaults',
  'settings.confirmSaveDefaults.message': 'Save current settings as defaults for new layouts?\n\nDrawer: {width}×{depth}×{height}u\nLayer height: {layerHeight}u\nPrint bed: {printBed}mm\nGrid unit: {gridUnit}mm',

  // STL Search
  'settings.stlSearch': 'STL Search',
  'settings.stlSearchHint': 'Choose which sites to search for Gridfinity STL files:',
  'settings.toggleSite': 'Toggle {name}',

  // Privacy
  'settings.privacy': 'Privacy',
  'settings.helpImprove': 'Help improve suggestions',
  'settings.helpImproveHint': 'Share bin sizes and placement patterns (no personal data)',
  'settings.toggleUsageData': 'Toggle usage data collection',

  // Language
  'settings.language': 'Language',
  'settings.languageHint': 'Choose your preferred language',
  'settings.autoDetect': 'Auto (browser default)',

  // Labs
  'settings.labs': 'Labs',
  'settings.labsHint': 'Try new features before they\'re released. Features may change based on feedback.',
  'settings.labsEmpty': 'No experimental features available right now.',
  'settings.labsCheckBack': 'Check back later!',

  // ===========================================================================
  // Labs Features
  // ===========================================================================
  'labs.experimental': 'Experimental',
  'labs.comingSoon': 'Coming Soon',
  'labs.graduated': 'Graduated',
  'labs.enabled': 'Enabled',
  'labs.disabled': 'Disabled',
  'labs.toggle': 'Toggle {name}',
  'labs.graduatedSection': 'Previously in Labs',
  'labs.graduatedHint': 'These features have graduated from Labs and are now available to everyone.',

  // ===========================================================================
  // Help Modal
  // ===========================================================================
  'help.title': 'Keyboard Shortcuts',
  'help.sections.grid': 'Grid',
  'help.sections.bins': 'Bins',
  'help.sections.navigation': 'Navigation',
  'help.sections.view': 'View',
  'help.sections.other': 'Other',

  // Grid shortcuts
  'help.grid.draw': 'Draw bin',
  'help.grid.paint': 'Paint mode',
  'help.grid.fill': 'Fill layer',
  'help.grid.halfBin': 'Toggle half-bin mode',

  // Bin shortcuts
  'help.bins.delete': 'Delete selected',
  'help.bins.duplicate': 'Duplicate selected',
  'help.bins.rotate': 'Rotate selected',
  'help.bins.selectAll': 'Select all',
  'help.bins.deselect': 'Deselect',
  'help.bins.toStash': 'Move to stash',
  'help.bins.move': 'Move mode',
  'help.bins.resize': 'Resize mode',

  // Navigation shortcuts
  'help.nav.undo': 'Undo',
  'help.nav.redo': 'Redo',
  'help.nav.zoomIn': 'Zoom in',
  'help.nav.zoomOut': 'Zoom out',
  'help.nav.fitToScreen': 'Fit to screen',
  'help.nav.panGrid': 'Pan grid',

  // View shortcuts
  'help.view.3dPreview': '3D preview',
  'help.view.labels': 'Toggle labels',
  'help.view.otherLayers': 'Show layers below',
  'help.view.layoutManager': 'Layout manager',

  // ===========================================================================
  // Mobile-specific
  // ===========================================================================
  'mobile.nav.layers': 'Layers',
  'mobile.nav.bin': 'Bin',
  'mobile.nav.categories': 'Categories',
  'mobile.nav.list': 'List',
  'mobile.settings': 'Settings',
  'mobile.help': 'Help',
  'mobile.grid.draw': 'Draw',
  'mobile.grid.paint': 'Paint',
  'mobile.grid.select': 'Select',
  'mobile.grid.zoomFit': 'Fit',

  // Mobile bin context menu
  'mobile.binMenu.editProperties': 'Edit Properties',
  'mobile.binMenu.duplicate': 'Duplicate',
  'mobile.binMenu.rotate': 'Rotate',
  'mobile.binMenu.toStash': 'To Stash',
  'mobile.binMenu.delete': 'Delete',

  // Mobile settings
  'mobile.settings.drawerDimensions': 'Drawer Dimensions',
  'mobile.settings.gridSettings': 'Grid Settings',
  'mobile.settings.width': 'Width',
  'mobile.settings.depth': 'Depth',
  'mobile.settings.height': 'Height',

  // ===========================================================================
  // Error / Loading States
  // ===========================================================================
  'error.title': 'Something went wrong',
  'error.message': 'An unexpected error occurred.',
  'error.reload': 'Reload',
  'error.tryAgain': 'Try Again',
  'error.details': 'Error details',
  'error.panelError': 'This panel encountered an error',
  'error.panelReload': 'Reload panel',

  'loading.default': 'Loading...',
  'loading.layouts': 'Loading layouts...',
  'loading.preview': 'Loading preview...',
  'loading.importing': 'Importing...',

  // ===========================================================================
  // Toast Messages
  // ===========================================================================
  // Layout operations
  'toast.layoutCreated': 'New layout created',
  'toast.layoutDuplicated': 'Layout duplicated',
  'toast.layoutDeleted': 'Layout deleted',
  'toast.layoutRenamed': 'Layout renamed',
  'toast.layoutImported': 'Imported "{name}"',
  'toast.layoutSwitched': 'Switched to "{name}"',
  'toast.layoutSaved': 'Layout saved',
  'toast.layoutExported': 'Layout exported',

  // Layout errors
  'toast.layoutSwitchFailed': 'Failed to switch layout',
  'toast.layoutCreateFailed': 'Failed to create layout',
  'toast.layoutDeleteFailed': 'Failed to delete layout',
  'toast.layoutImportFailed': 'Failed to import layout',
  'toast.layoutExportFailed': 'Failed to export layout',

  // Bin operations
  'toast.binDuplicated': 'Bin duplicated',
  'toast.binsDuplicated': '{count} bin(s) duplicated',
  'toast.binDeleted': 'Bin deleted',
  'toast.binsDeleted': 'Deleted {count} bin(s)',
  'toast.binRotated': 'Bin rotated',
  'toast.binsRotated': '{count} bin(s) rotated',
  'toast.binMovedToStash': 'Bin moved to stash',
  'toast.binsMovedToStash': '{count} bin(s) moved to stash',
  'toast.binPlaced': 'Bin placed from stash',

  // Bin errors
  'toast.duplicateFailed': 'Failed to duplicate: no space available',
  'toast.placementFailed': 'Cannot place here: collision detected',
  'toast.rotateFailed': 'Cannot rotate: not enough space',

  // Fill operations
  'toast.fillComplete': 'Filled layer with {count} bin(s)',
  'toast.fillFailed': 'No space to fill',
  'toast.clearComplete': 'Cleared {count} bin(s) from layer',

  // Share operations
  'toast.sharePublished': 'Layout shared successfully!',
  'toast.shareUpdated': 'Share updated',
  'toast.shareDeleted': 'Share removed',
  'toast.shareFailed': 'Failed to share layout',
  'toast.linkCopied': 'Link copied to clipboard',
  'toast.jsonCopied': 'JSON copied to clipboard',
  'toast.urlCopied': 'URL copied to clipboard',
  'toast.copyFailed': 'Failed to copy to clipboard',

  // Layer operations
  'toast.layerAdded': 'Layer added',
  'toast.layerDeleted': 'Layer deleted, bins moved to stash',
  'toast.layerRenamed': 'Layer renamed',

  // Category operations
  'toast.categoryAdded': 'Category added',
  'toast.categoryDeleted': 'Category deleted',
  'toast.categoryRenamed': 'Category renamed',

  // Settings
  'toast.defaultsSaved': 'Defaults saved',
  'toast.settingsReset': 'Settings reset to defaults',

  // PWA
  'toast.updateAvailable': 'Update available! Click to reload.',
  'toast.updateReady': 'App updated — refresh to see changes',
  'toast.offline': 'Working offline',
  'toast.online': 'Back online',

  // Cloud sync
  'toast.syncFailed': 'Failed to sync',
  'toast.syncRetrying': 'Sync failed, retrying...',

  // ===========================================================================
  // Accessibility / Screen Reader
  // ===========================================================================
  'a11y.binPlaced': 'Bin placed at position {x}, {y}',
  'a11y.binSelected': 'Bin selected: {width} by {depth}',
  'a11y.binDeselected': 'Bin deselected',
  'a11y.binDeleted': 'Bin deleted',
  'a11y.binResized': 'Bin resized to {width} by {depth}',
  'a11y.binMoved': 'Bin moved to position {x}, {y}',
  'a11y.binRotated': 'Bin rotated: now {width} by {depth}',
  'a11y.paintModeEntered': 'Paint mode: drag to fill {width} by {depth} bins',
  'a11y.paintModeExited': 'Paint mode exited',
  'a11y.moveMode': 'Move mode: use arrow keys to move, Enter to place',
  'a11y.resizeMode': 'Resize mode: use arrow keys to resize, Enter to apply',
  'a11y.layerSwitched': 'Switched to layer: {name}',
  'a11y.zoomLevel': 'Zoom: {percent}%',
  'a11y.layoutSwitched': 'Switched to layout: {name}',
  'a11y.gridCell': 'Grid cell {x}, {y}',
  'a11y.binAt': 'Bin at {x}, {y}: {width}×{depth}',
  'a11y.emptyCell': 'Empty cell',
  'a11y.occupiedByLayer': 'Occupied by bin on layer below',
  'a11y.dismiss': 'Dismiss notification',
  'a11y.closeModal': 'Close modal',
  'a11y.expandSection': 'Expand {section}',
  'a11y.collapseSection': 'Collapse {section}',

  // ===========================================================================
  // Collaboration
  // ===========================================================================
  'collab.cursors': 'Collaborators',
  'collab.userJoined': '{name} joined',
  'collab.userLeft': '{name} left',
  'collab.guest': 'Guest',
  'collab.you': 'You',
  'collab.editing': 'Editing',
  'collab.viewing': 'Viewing',

  // ===========================================================================
  // STL Search
  // ===========================================================================
  'stlSearch.findSTL': 'Find STL',
  'stlSearch.findOnSite': 'Find on {site}',
  'stlSearch.searchFor': 'Search for {width}×{depth} bin',
  'stlSearch.splitNote': 'Will be split for printing',
  'stlSearch.openIn': 'Open in {site}',

  // ===========================================================================
  // Drawer Settings (Sidebar)
  // ===========================================================================
  'drawer.title': 'Drawer',
  'drawer.width': 'Width',
  'drawer.depth': 'Depth',
  'drawer.height': 'Height',
  'drawer.gridUnit': 'Grid Unit',
  'drawer.heightUnit': 'Height Unit',
  'drawer.printBed': 'Print Bed',
  'drawer.halfBinMode': 'Half-Bin Mode',
  'drawer.halfBinModeHint': 'Enable 0.5 unit precision for bin placement',

  // ===========================================================================
  // Half-Bin Mode Blocked Modal
  // ===========================================================================
  'halfBinBlocked.title': 'Cannot Disable Half-Bin Mode',
  'halfBinBlocked.message': 'Some bins use fractional dimensions. Resize or delete these bins before disabling half-bin mode:',
  'halfBinBlocked.binItem': '{width}×{depth} bin at ({x}, {y})',
  'halfBinBlocked.close': 'Got it',

  // ===========================================================================
  // Inspiration Gallery
  // ===========================================================================
  'gallery.title': 'Inspiration Gallery',
  'gallery.loading': 'Loading gallery...',
  'gallery.empty': 'No layouts in the gallery yet',
  'gallery.useLayout': 'Use this layout',
  'gallery.preview': 'Preview',
  'gallery.by': 'by {author}',
  'gallery.bins': '{count} bin(s)',
  'gallery.layers': '{count} layer(s)',

  // ===========================================================================
  // Tool Switcher
  // ===========================================================================
  'toolSwitcher.gridEditor': 'Grid Editor',
  'toolSwitcher.binDesigner': 'Bin Designer',
  'toolSwitcher.switchTo': 'Switch to {tool}',

  // ===========================================================================
  // Bin Designer
  // ===========================================================================
  'binDesigner.title': 'Bin Designer',
  'binDesigner.parameters': 'Parameters',
  'binDesigner.preview': 'Preview',
  'binDesigner.export': 'Export',
  'binDesigner.exportSTL': 'Export STL',
  'binDesigner.export3MF': 'Export 3MF',
  'binDesigner.dimensions': 'Dimensions',
  'binDesigner.features': 'Features',
  'binDesigner.inserts': 'Inserts',
  'binDesigner.walls': 'Walls',
  'binDesigner.style': 'Style',
  'binDesigner.presets': 'Presets',
  'binDesigner.templates': 'Templates',

  // ===========================================================================
  // Grid First-Use Hints
  // ===========================================================================
  'hints.drawFirst': 'Drag on the grid to create your first bin',
  'hints.clickBin': 'Click a bin to select and edit it',
  'hints.paintMode': 'Press P or click Paint to fill areas quickly',
  'hints.undoAvailable': 'Press {mod}+Z to undo',

  // ===========================================================================
  // Confirm Dialog (shared)
  // ===========================================================================
  'confirm.defaultTitle': 'Are you sure?',
  'confirm.defaultMessage': 'This action cannot be undone.',
  'confirm.defaultConfirm': 'Confirm',
  'confirm.defaultCancel': 'Cancel',

  // ===========================================================================
  // Sort fields
  // ===========================================================================
  'sort.category': 'Category',
  'sort.layer': 'Layer',
  'sort.position': 'Position',
  'sort.size': 'Size',
  'sort.height': 'Height',
  'sort.label': 'Label',

  // ===========================================================================
  // PWA Install
  // ===========================================================================
  'pwa.installPrompt': 'Install app for offline use',
  'pwa.install': 'Install',
  'pwa.dismiss': 'Dismiss',
};

export default en;
