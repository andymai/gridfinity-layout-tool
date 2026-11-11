---
title: Find bins that fit
description: 'Find community bins that fit an empty area of your layout, and get a bin size from its label.'
sources:
  - src/features/grid-editor/components/Grid/GridToolbar/GridToolbar.tsx
  - src/shell/Mobile/MobileLayersPanel/ToolsTab/ToolsTab.tsx
  - src/shared/hooks/interactions/useDrawInteraction.ts
  - src/core/store/gapFit.ts
  - src/shell/Modals/DesignGalleryModal/communityDesignerBridge.ts
  - src/features/community/components/CommunityGalleryTab/
  - src/features/bin-recommender/
---

# Find bins that fit

You do not have to design every bin yourself. The Gridfinity Layout Tool can show community designs that fit an empty area of your drawer. It can also suggest a bin size from a label. This page shows both tools.

## Open the gap search

The control has the same name on every screen: <Ui k="toolbar.findBins" />.

- **On a computer:** click <Ui k="toolbar.findBins" /> in the toolbar above the grid. In a narrow window with two or more layers, it is in the <Ui k="common.moreOptions" /> menu of the toolbar.
- **On a phone:** tap <Ui k="common.layers" /> in the bar at the bottom of the screen. Open the <Ui k="mobile.tabs.tools" /> tab and tap <Ui k="toolbar.findBins" />.

<Screenshot id="layouts-find-bins-toolbar" alt="The grid toolbar with the Find bins that fit button turned on, and an empty area of the grid selected." spec="Layout editor on desktop. Layout with a 6 by 4 drawer and bins on most cells, with a 2 by 2 empty area. Click Find bins that fit so it shows as pressed, then start a drag across the empty 2 by 2 area. Crop to the toolbar and the grid." />

## Pick an empty area

1. Turn on <Ui k="toolbar.findBins" />.
2. On the grid, drag across the empty cells that you want to fill.
3. Release. The gallery opens on its community tab.

If your drag crosses a bin, the Layout Tool uses only the empty part. To stop without a search, press <kbd>Escape</kbd>. On a phone, tap the <Ui k="toolbar.findBins" /> button above the grid again.

## Choose a design

The gallery shows only the designs that fit the area. A design must fit the width and the depth of the area, turned or not. It must also fit the free height above the active layer. A design made for a different grid unit or height unit does not show, because it would print at the wrong size.

A banner above the cards gives the size of the area. The Layout Tool sorts the cards by <Ui k="community.gallery.sort.bestFit" />, so the designs that fill the area best come first.

To place a design:

1. Click a card to open the design.
2. Click <Ui k="community.detail.placeInLayout" />.

The Layout Tool saves a copy of the design to your saved designs. Then it puts a bin that uses the copy in the area. If the design fits only when turned, the bin goes in turned.

If nothing fits, the gallery tells you. Select a larger area, or click <Ui k="community.gallery.clearFitsGap" /> to see all the designs. When you close the gallery, the search ends.

## Get a size from a label

The inspector can suggest a size for a bin from its label. Use it when you know what goes in the bin, but not how large the bin must be.

1. Select a bin. On a phone, tap <Ui k="mobile.nav.bin" /> in the bar at the bottom of the screen to open the inspector.
2. Type what the bin holds in the <Ui k="common.label" /> field, for example "screws".
3. If a line with a size shows under the field, click <Ui k="inspector.sizeSuggestionApply" />.

The size gives the width, the depth and the height in units. When you apply it, the bin changes to that size where it stands.

The line shows only when the label matches a known size, and when that size is different from the current size. If the size does not fit where the bin is, the line shows <Ui k="inspector.sizeSuggestionNoFit" /> and has no apply button. A bin with a locked size cannot take the size. Click <Ui k="inspector.sizeSuggestionDismiss" /> (the X) to hide the line for that label.

The Layout Tool finds the size on your device. Your label does not leave the browser for this suggestion.

## Next steps

- [Community designs](../sharing/community): browse, like and share designs.
- [Saved designs and linked bins](../concepts/saved-designs): what the placed copy is and how to edit it.
- [Place and edit bins](./placing-bins): resize or move the bin after you place it.
