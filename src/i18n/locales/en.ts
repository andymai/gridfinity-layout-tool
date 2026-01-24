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
  'common.clear': 'Clear',
  'common.height': 'Height',
  'common.quantity': 'Quantity',
  'common.value': 'Value',

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
  // Sidebar
  // ===========================================================================
  'sidebar.expandPanel': 'Expand panel',
  'sidebar.collapsePanel': 'Collapse panel',
  'sidebar.settings': 'Settings',
  'sidebar.maxHeight': 'Maximum height in units',
  'sidebar.halfBinTooltip': 'Enable 0.5 grid unit precision for half-size bins (H)',
  'sidebar.halfBinLeft': 'Place half-unit column on the left',
  'sidebar.halfBinRight': 'Place half-unit column on the right',
  'sidebar.halfBinBottom': 'Place half-unit row at the bottom',
  'sidebar.halfBinTop': 'Place half-unit row at the top',
  'sidebar.tools': 'Tools',
  'sidebar.inspirationGallery': 'Inspiration Gallery',
  'sidebar.inspirationHint': 'Get ideas for your drawer',
  'sidebar.gridSize': 'Grid Size',
  'sidebar.halfBinMode': 'Half-bin mode',
  'sidebar.physicalUnits': 'Physical Units',

  // ===========================================================================
  // Right Panel (Bin List)
  // ===========================================================================
  'rightPanel.expandPanel': 'Expand panel',
  'rightPanel.collapsePanel': 'Collapse panel',
  'rightPanel.expandBinList': 'Expand bin list',
  'rightPanel.copyTSV': 'Copy as TSV for spreadsheets',
  'rightPanel.piecesAfterSplit': 'Pieces after split',
  'rightPanel.filamentMeters': 'Estimated filament (meters)',

  // ===========================================================================
  // Bin Inspector
  // ===========================================================================
  'inspector.bin': '{width}×{depth} Bin',
  'inspector.category': 'Category',
  'inspector.label': 'Label',
  'inspector.notes': 'Notes',
  'inspector.width': 'Width',
  'inspector.depth': 'Depth',
  'inspector.height': 'Height',
  'inspector.clearance': 'Clearance',
  'inspector.clearanceTooltip': 'Extra blocked space above for tall contents',
  'inspector.swapDimensions': 'Swap width ↔ depth (R)',
  'inspector.labelPlaceholder': 'Optional label',
  'inspector.notesPlaceholder': 'e.g., 2 dividers, STL link, contents',
  'inspector.toStash': 'To Stash',
  'inspector.findSTL': 'Find STL',
  'inspector.multi.title': '{count} Bins Selected',
  'inspector.multi.category': 'Category',
  'inspector.multi.layer': 'Layer',
  'inspector.multi.delete': 'Delete All',
  'inspector.multi.rotate': 'Rotate All',
  'inspector.multi.duplicate': 'Duplicate All',
  'inspector.multi.toStash': 'All to Stash',
  'inspector.multi.clearanceTooltip': 'Extra blocked space above bins for tall contents',
  'inspector.split.title': 'Oversized for print bed',
  'inspector.split.message': 'This {width}×{depth} bin ({widthMm}×{depthMm}mm) exceeds your print bed ({bedSize}mm). It will be split into smaller pieces for printing.',
  'inspector.split.piecesNeeded': '{count} piece(s) needed',
  'inspector.customProps.title': 'Custom Properties',
  'inspector.customProps.addProperty': 'Add Property',
  'inspector.customProps.deleteProperty': 'Delete property',
  'inspector.customProps.keyPlaceholder': 'Property name (e.g., SKU, Quantity)',
  'inspector.customProps.valuePlaceholder': 'Value',
  'inspector.customProps.multiKeyPlaceholder': 'Property name',
  'inspector.customProps.multiValuePlaceholder': 'Value',
  'inspector.empty.title': 'No bin selected',
  'inspector.empty.drawHint': 'Click a bin on the grid or draw to create one',
  'inspector.empty.mobileHint': 'Tap a bin on the grid, or use the Tools tab to create one',
  'inspector.empty.howToCreate': 'How to create bins:',
  'inspector.empty.mobileStep1': 'Go to Layers → Tools tab',
  'inspector.empty.mobileStep2': 'Select a bin size',
  'inspector.empty.mobileStep3': 'Tap on the grid to place',
  'inspector.empty.hintDraw': 'Draw to create a bin',
  'inspector.empty.hintDuplicate': 'Duplicate selected bin',
  'inspector.empty.hintLabel': 'Add/edit label',

  // ===========================================================================
  // Layers
  // ===========================================================================
  'layers.title': 'Layers',
  'layers.addLayer': 'Add Layer',
  'layers.heightTooltip': 'Height for new bins placed on this layer',
  'layers.deleteTooltip': 'Delete this layer',
  'layers.confirmDelete.title': 'Delete Layer',
  'layers.confirmDelete.message': 'Delete "{name}"? The {count} bin(s) on this layer will be moved to the Stash.',
  'layers.confirmDelete.confirm': 'Delete',
  'layers.clearLayer.title': 'Clear Layer',
  'layers.clearLayer.message': 'Move all {count} bin(s) on this layer to the stash?',
  'layers.clearLayer.confirm': 'Clear',
  'layers.layerNamePlaceholder': 'Layer name',
  'layers.binPalette': 'Bin Palette',
  'layers.decreaseHeight': 'Decrease {name} height',
  'layers.increaseHeight': 'Increase {name} height',

  // ===========================================================================
  // Categories
  // ===========================================================================
  'categories.title': 'Categories',
  'categories.addCategory': 'Add category',
  'categories.deleteCategory': 'Delete category',
  'categories.editCategory': 'Edit category',
  'categories.editColor': 'Click to edit color',
  'categories.confirmDelete.title': 'Delete Category',
  'categories.confirmDelete.message': 'Delete "{name}"? Bins in this category will be moved to the default category.',
  'categories.confirmDelete.confirm': 'Delete Category',
  'categories.cannotDeleteLast': 'Cannot delete the last category',
  'categories.categoryNamePlaceholder': 'Category name',
  'categories.selectCategory': 'Select Category',

  // ===========================================================================
  // Staging / Stash
  // ===========================================================================
  'staging.title': 'Stash',
  'staging.rotateBin': 'Rotate bin (R)',
  'staging.clearStash.title': 'Clear Stash',
  'staging.clearStash.message': 'Delete all {count} stashed bin(s)? This cannot be undone.',
  'staging.clearStash.confirm': 'Clear All',

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
  'print.summary.uniqueSizes': '{count} unique size(s)',
  'print.summary.pieces': '{count} piece(s)',
  'print.summary.filament': '~{meters}m filament',
  'print.summary.filamentTooltip': 'Estimated 1.75mm PLA usage based on bin dimensions',
  'print.summary.cost': '~{cost}',
  'print.summary.costTooltip': 'Based on $15/kg filament cost',
  'print.summary.printTime': '~{hours} print time',
  'print.summary.printTimeTooltip': 'Based on 0.4mm nozzle, 0.2mm layer height, 15% infill',
  'print.summary.spoolTooltip': 'Based on 1kg spool (~330m of 1.75mm PLA)',
  'print.summary.total': 'Total',
  'print.summary.filamentLabel': 'Filament',
  'print.summary.costLabel': 'Cost',
  'print.summary.timeLabel': 'Time',
  'print.summary.spoolLabel': 'Spool',
  'print.empty.title': 'No bins to print',
  'print.empty.message': 'Add bins to the grid to see the print list',
  'print.sort.dragToReorder': 'Drag to reorder',
  'print.sort.moveUp': 'Move up',
  'print.sort.moveDown': 'Move down',
  'print.sort.sortBySize': 'Sort by size (area)',
  'print.sort.sortByHeight': 'Sort by height',
  'print.sort.sortByFilament': 'Sort by filament usage',
  'print.sort.customProperties': 'Custom properties',

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
  'share.link.urlEncoded': 'URL-encoded (may be long)',
  'share.file.description': 'Download your layout as a JSON file.',
  'share.file.download': 'Download JSON',
  'share.file.downloaded': 'Downloaded!',
  'share.file.saveAsFile': 'Save as file',
  'share.json.description': 'Copy raw JSON to clipboard.',
  'share.json.copy': 'Copy JSON',
  'share.json.copied': 'JSON copied!',
  'share.button.share': 'Share',
  'share.button.shared': 'Shared',
  'share.button.shareLayout': 'Share layout',
  'share.button.manageShare': 'Manage shared layout',
  'share.banner.viewing': 'Viewing shared layout',
  'share.banner.saveToMyLayouts': 'Save to My Layouts',
  'share.banner.savedToLayouts': 'Saved "{name}" to your layouts',
  'share.banner.discarded': 'Shared layout discarded',
  'share.banner.discardTitle': 'Discard shared layout?',
  'share.banner.discardMessage': 'Any changes you made will be lost. You\'ll return to your previous layout.',
  'share.banner.discardConfirm': 'Discard',
  'share.shareToCloud': 'Share to Cloud',
  'share.copyLink': 'Copy Link',
  'share.failedToShare': 'Failed to share',
  'share.sharedSuccessfully': 'Shared successfully!',
  'share.failedToShareLayout': 'Failed to share layout',
  'share.loadingShared': 'Loading shared layout...',

  // ===========================================================================
  // Layout Library
  // ===========================================================================
  'layouts.title': 'Layouts',
  'layouts.newLayout': 'New Layout',
  'layouts.shareLayout': 'Share Layout',
  'layouts.searchPlaceholder': 'Search layouts...',
  'layouts.layoutNamePlaceholder': 'Layout name',
  'layouts.confirmDelete.title': 'Delete Layout',
  'layouts.confirmDelete.message': 'Delete "{name}"? This cannot be undone.',
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
  'settings.confirmSaveDefaults.title': 'Save as Defaults',
  'settings.confirmSaveDefaults.message': 'Save current settings as defaults for new layouts?\n\nDrawer: {width}×{depth}×{height}u\nLayer height: {layerHeight}u\nPrint bed: {printBed}mm\nGrid unit: {gridUnit}mm',
  'settings.confirmSaveDefaults.confirm': 'Save',
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
  'settings.experimental': 'Experimental',
  'settings.drawerDimensions': 'Drawer Dimensions',
  'settings.gridSettings': 'Grid Settings',

  // ===========================================================================
  // Help
  // ===========================================================================
  'help.title': 'Keyboard Shortcuts',
  'help.searchPlaceholder': 'Search shortcuts...',

  // ===========================================================================
  // Mobile
  // ===========================================================================
  'mobile.nav.layers': 'Layers',
  'mobile.nav.bin': 'Bin',
  'mobile.nav.categories': 'Categories',
  'mobile.nav.list': 'List',
  'mobile.help': 'Help',
  'mobile.settings': 'Settings',
  'mobile.binMenu.editProperties': 'Edit Properties',
  'mobile.binMenu.duplicate': 'Duplicate',
  'mobile.binMenu.rotate': 'Rotate',
  'mobile.binMenu.toStash': 'To Stash',
  'mobile.binMenu.delete': 'Delete',
  'mobile.tools.instructions': 'Select a size, then tap or drag on grid to place bins.',
  'mobile.tools.squares': 'Squares',
  'mobile.tools.rectangles': 'Rectangles',
  'mobile.tools.tall': 'Tall',
  'mobile.tools.wide': 'Wide',
  'mobile.tools.switchToWide': 'Switch to wide rectangles',
  'mobile.tools.switchToTall': 'Switch to tall rectangles',
  'mobile.tools.selectForPaint': '{action} {width}×{depth} for painting',
  'mobile.tools.select': 'Select',
  'mobile.tools.deselect': 'Deselect',
  'mobile.tools.fillWithSize': 'Fill with {width}×{depth}',
  'mobile.tools.fillGaps': 'Fill {count} Gaps',
  'mobile.tools.noGaps': 'No Gaps',
  'mobile.tools.clearBins': 'Clear {count} Bins',
  'mobile.tools.noBins': 'No Bins',
  'mobile.confirm.deleteMulti': 'Delete {count} selected bin(s)?',
  'mobile.confirm.deleteSingle': 'Delete this {width}×{depth} bin?',
  'mobile.copyToClipboard': 'Copy to clipboard',

  // ===========================================================================
  // Error States
  // ===========================================================================
  'error.message': 'An unexpected error occurred.',
  'error.tryAgain': 'Try Again',

  // ===========================================================================
  // Toast Messages
  // ===========================================================================
  'toast.layoutCreated': 'New layout created',
  'toast.layoutDuplicated': 'Layout duplicated',
  'toast.layoutDeleted': 'Layout deleted',
  'toast.layoutImported': 'Imported "{name}"',
  'toast.layoutNotFound': 'Layout not found',
  'toast.layoutSwitchFailed': 'Failed to switch layout',
  'toast.layoutCreateFailed': 'Failed to create layout',
  'toast.layoutDeleteFailed': 'Failed to delete layout',
  'toast.layoutDuplicateFailed': 'Failed to duplicate layout',
  'toast.layoutImportFailed': 'Failed to import layout',
  'toast.binsDeleted': 'Deleted {count} bin(s)',
  'toast.binRotated': 'Bin rotated',
  'toast.clearComplete': 'Cleared {count} bin(s) from layer',
  'toast.fillComplete': 'Added {count} bin(s) to fill gaps',
  'toast.fillWithSize': 'Added {count} {width}×{depth} bins',
  'toast.binAddedToStash': 'Added {width}×{depth} to stash',
  'toast.linkCopied': 'Link copied to clipboard',
  'toast.jsonCopied': 'JSON copied to clipboard',
  'toast.copyFailed': 'Failed to copy to clipboard',
  'toast.categoryAssigned': 'Category assigned to {count} bin(s)',
  'toast.categoryChanged': 'Changed {count} bin(s) to "{name}"',
  'toast.binsMovedToLayer': '{count} bin(s) moved to layer',
  'toast.movedToLayer': 'Moved to {name}',
  'toast.movedMultiToLayer': 'Moved {count} bins to {name}',
  'toast.noMovableCollisions': 'No bins can be moved to this layer (collisions)',
  'toast.dragFromStash': 'Drag bin from stash to place it on a layer',
  'toast.customPropertySet': 'Set "{key}" on {count} bins',
  'toast.resizeTip': 'Tip: Drag the handles to resize',
  'toast.paintModeHint': 'Paint Mode: Drag to fill area, press Esc or click × to exit',
  'toast.binDeletedMulti': 'Deleted {count} bins',
  'toast.binDeleteFailed': 'Some bins could not be deleted: {error}',
  'toast.binUpdateFailed': 'Some bins could not be updated: {error}',
  'toast.downloadedFile': 'Downloaded {format} file',
  'toast.copiedFormat': 'Copied {format} to clipboard',
  'toast.stashCleared': 'Deleted {count} stashed bins',
  'toast.galleryAddFailed': 'Failed to add layout',
  'toast.galleryAdded': 'Added "{name}"',
  'toast.sharedLayoutFailed': 'Failed to load shared layout: {error}',
  'toast.savedToLayouts': 'Saved "{name}" to your layouts',
  'toast.online': 'Back online',
  'toast.offline': 'You\'re offline. Changes save locally.',
  'toast.updating': 'Updating to latest version...',
  'toast.sessionRestored': 'Session restored',
  'toast.rotateFailed': 'Cannot rotate bin',
  'toast.rotateBoundsFailed': 'Cannot rotate: bin would exceed drawer bounds',
  'toast.rotateCollisionFailed': 'Cannot rotate: would collide with another bin',
  'toast.rotateBlockedFailed': 'Cannot rotate: space is blocked by a bin below',

  // ===========================================================================
  // Grid Editor
  // ===========================================================================
  'grid.resizeDialog.title': 'Resize Grid',
  'grid.resizeDialog.message': '{count} bin(s) won\'t fit in the new grid and will be moved to the Stash. Continue?',
  'grid.resizeDialog.confirm': 'Move to Stash',
  'grid.exceedsPrintSize': 'Exceeds print size, will be split',
  'grid.labelPlaceholder': 'Enter label...',
  'grid.resizeColumns': 'Drag to add/remove columns',
  'grid.resizeRows': 'Drag to add/remove rows',
  'grid.resizeCorner': 'Drag to add/remove rows and columns',

  // ===========================================================================
  // 3D Preview
  // ===========================================================================
  'preview3d.isometricView': 'Isometric view',
  'preview3d.frontView': 'Front view',
  'preview3d.sideView': 'Side view',
  'preview3d.focusLayer': 'Focus: Show only active layer',
  'preview3d.stackLayers': 'Stack: Show active layer and below',
  'preview3d.allLayers': 'All: Show all layers',

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
  'binDesigner.exportBin': 'Export bin',
  'binDesigner.exportSTL': 'Export bin as STL',
  'binDesigner.formatSTL': 'STL',
  'binDesigner.format3MF': '3MF',
  'binDesigner.clickToRename': 'Click to rename design',
  'binDesigner.openDesignList': 'Open design list',
  'binDesigner.myDesigns': 'My Designs',
  'binDesigner.dimensions': 'Dimensions',
  'binDesigner.interior': 'Interior',
  'binDesigner.walls': 'Walls',
  'binDesigner.wallCutouts': 'Wall Cutouts',
  'binDesigner.base': 'Base',
  'binDesigner.scoops': 'Scoops',
  'binDesigner.physicalUnits': 'Physical Units',
  'binDesigner.resetView': 'Reset view (R)',
  'binDesigner.toggleWireframe': 'Toggle wireframe (W)',
  'binDesigner.changeColor': 'Change preview color',
  'binDesigner.customColor': 'Custom color',
  'binDesigner.filenamePlaceholder': 'Enter filename',
  'binDesigner.shareDesign': 'Share Design',
  'binDesigner.createShareLink': 'Create Share Link',
  'binDesigner.loadSharedDesign': 'Load Shared Design',
  'binDesigner.pasteShareUrl': 'Paste share URL or ID',
  'binDesigner.exportCart': 'Export Cart',
  'binDesigner.cartEmpty': 'Cart is empty',
  'binDesigner.cartEmptyHint': 'Use the "Add to Cart" button to queue designs for batch export.',

  // ===========================================================================
  // Tablet
  // ===========================================================================
  'tablet.layersCategories': 'Layers & Categories',
  'tablet.selectionActions': 'Selection & Actions',

  // ===========================================================================
  // Loading States
  // ===========================================================================
  'loading.gallery': 'Loading gallery',
  'loading.settings': 'Loading settings',
  'loading.binList': 'Loading bin list',
  'loading.collaboration': 'Loading collaboration',
  'loading.designer': 'Loading designer',
  'loading.mobileLayout': 'Loading mobile layout',
  'loading.help': 'Loading help',
  'loading.sharedWithMe': 'Loading...',

  // ===========================================================================
  // Bin List Modal
  // ===========================================================================
  'binList.searchPlaceholder': 'Search label or notes...',
  'binList.enterLabel': 'Enter label...',
  'binList.enterNotes': 'Enter notes...',
  'binList.enterNotesShortcut': 'Enter notes... ({mod}+Enter to apply)',

  // ===========================================================================
  // Dashboard (Bin List Stats)
  // ===========================================================================
  'dashboard.statistics': 'Statistics',
  'dashboard.expandStats': 'Show statistics',
  'dashboard.collapseStats': 'Hide statistics',
  'dashboard.binTypes': 'Bin Types',
  'dashboard.totalBins': 'Total Bins',
  'dashboard.printPieces': 'Print Pieces',
  'dashboard.filament': 'Filament',
  'dashboard.estCost': 'Est. Cost',
  'dashboard.printTime': 'Print Time',
  'dashboard.spools': 'Spools',
  'dashboard.filamentByCategory': 'Filament by Category',
  'dashboard.noData': 'No data to display',
  'dashboard.other': 'Other ({count})',

  // ===========================================================================
  // Collaboration
  // ===========================================================================
  'collab.connected': 'Connected',
  'collab.reconnecting': 'Reconnecting',
  'collab.connecting': 'Connecting',
  'collab.disconnected': 'Disconnected',
  'collab.noOneHere': 'No one else is here',
  'collab.participants': 'Participants',
  'collab.you': '(you)',
  'collab.owner': 'Owner',

  // ===========================================================================
  // Mobile Tabs
  // ===========================================================================
  'mobile.tabs.layers': 'Layers',
  'mobile.tabs.tools': 'Tools',
};

export default en;
