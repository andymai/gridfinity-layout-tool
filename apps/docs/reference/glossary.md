---
title: Glossary
description: 'Look up the terms that you meet in the Layout Tool and in these docs, from baseplate to Workshop, in alphabetical order.'
sources:
  - src/i18n/locales/en.ts
  - src/shared/printSettings/gridfinityGeometry.ts
  - src/core/constants.ts
  - src/core/labs/features.ts
  - docs/schemas/bin-design.md
  - docs/schemas/layout.md
---

# Glossary

This page explains the terms that you meet in the Gridfinity Layout Tool and in these docs, in alphabetical order. Each entry links to the page with the details.

## Numbers

**3D preview**: the 3D view of a layout, a bin or a baseplate. In the layout editor, press <kbd>V</kbd> to show or hide it. See [Preview and export](../concepts/preview-and-export).

**3MF**: a 3D print file that can carry more than one filament color. Each color zone of a bin goes to the slicer as a separate filament. See [Multi-color printing](../concepts/multi-color).

## B

**Base**: the bottom of a bin, with one foot under each grid cell. It can also hold magnet holes and screw holes. See [The base](../designer/base).

**Baseplate**: a printed grid of pockets that lies in the drawer. Each foot of a bin drops into a pocket, so the bin stays in place. See [Baseplate basics](../baseplates/basics).

**Baseplate generator**: the tool that builds baseplates. Open it with the <Ui k="toolSwitcher.baseplateGenerator" /> tab. See [Make your first baseplate](../getting-started/first-baseplate).

**Bento**: an interior style where you draw compartments of any size, with walls only where you want them. See [Compartments and dividers](../designer/compartments).

**Bin**: one box on the grid. A bin is a whole number of grid units wide and deep, or a half unit in half-grid mode. See [Anatomy of a bin](../concepts/bin-anatomy).

**Bin designer**: the tool that designs one custom bin. Open it with the <Ui k="toolSwitcher.binDesigner" /> tab, or press <kbd>Shift</kbd>+<kbd>D</kbd>. See [Design your first bin](../getting-started/first-bin).

**Blocked zone**: striped cells on a layer that another bin keeps free for its tall contents. No bin can rest there. See [Work in layers](../layouts/layers).

## C

**Category**: a named color group for bins, for example screws or tools. A layout has 1 to 20 categories. See [Categories and colors](../layouts/categories).

**Clearance**: empty space that you reserve above a bin for contents that stick out, such as scissor handles. It blocks bins on the layers above, but it does not add height to the printed bin. See [Work in layers](../layouts/layers).

**Command palette**: a search box for commands. Press <kbd>Ctrl</kbd>+<kbd>K</kbd> (<kbd>Cmd</kbd>+<kbd>K</kbd> on a Mac) in the layout editor. See [Keyboard and command palette](../settings/keyboard-and-command-palette).

**Community**: the gallery of bin designs from other makers. You can preview a design in 3D, remix an editable copy and export it. See [The community gallery](../sharing/community).

**Compartment**: one open space inside a bin. Dividers separate the compartments. See [Compartments and dividers](../designer/compartments).

**Connector**: the joint that locks two pieces of a split baseplate together. The styles are <Ui k="baseplate.connectorStyle.dovetail" />, <Ui k="baseplate.connectorStyle.puzzle" />, <Ui k="baseplate.connectorStyle.dovetailKey" /> and <Ui k="baseplate.connectorStyle.snapClip" />. See [Split for your print bed](../baseplates/splitting).

**Cutout**: any shape that the bin designer cuts into a bin, for example the outline of a tool. You draw cutouts in the <Ui k="binDesigner.cutoutEditor.title" />. See [Cutout basics](../cutouts/basics).

## D

**Detachable feet**: feet that print as separate parts and press onto the bin. They use less material than built-in feet. See [The base](../designer/base).

**Divider**: a wall inside a bin between two compartments. With <Ui k="binDesigner.interior.slotted.title" />, the dividers are separate parts that slide into slots. See [Compartments and dividers](../designer/compartments).

**Drawer shape**: the outline of a drawer that is not a rectangle. You draw it in millimeters, and the baseplate follows it. See [Drawers that are not rectangles](../baseplates/odd-shaped-drawers).

## E

**Eco plate**: a baseplate option that uses up to a third less filament. The bins hold only on the corner posts. See [Eco plates and stack printing](../baseplates/eco-and-stack-printing).

**Experimental**: a label on features that are on for everyone but can still change, such as Workshop and <Ui k="binDesigner.slant.title" />. See [Labs](../settings/labs).

**Exploded view**: a 3D preview that moves the layers of a layout apart, so you can see each one. Press <kbd>E</kbd> in the layout editor. See [Work in layers](../layouts/layers).

## F

**Finger scoop**: a ramp from the floor up to a wall of a bin, so you can slide small parts out. See [Scoops, fillets and pull tabs](../designer/getting-things-out).

**Foot**: the tapered block under each grid cell of a bin. It drops into a pocket of the baseplate. See [Gridfinity dimensions](./dimensions#base-profile).

## G

**Grid unit**: the size of one grid cell, 42 mm in standard Gridfinity. Bin width, bin depth and drawer size count in grid units. See [Units and sizes](../concepts/units).

## H

**Half-grid mode**: a mode that allows sizes and positions in steps of half a grid unit (21 mm). Press <kbd>H</kbd> in the layout editor. See [Units and sizes](../concepts/units).

**Half sockets**: smaller feet at half the grid pitch under a bin, so the bin can sit on a half-unit position. See [The base](../designer/base).

**Handle**: an opening or grip in a bin wall, so you can lift the bin out of a deep drawer or off a stack. See [Walls](../designer/walls).

**Height unit**: one step of bin height, 7 mm in standard Gridfinity. A bin of 6 height units is 42 mm high to the top of its wall. See [Units and sizes](../concepts/units).

## I

**Interior fillet**: a round edge where the compartment walls meet the floor, so parts slide out and the bin is easy to clean. See [Scoops, fillets and pull tabs](../designer/getting-things-out).

## K

**Knife block**: a solid bin with slots that hold kitchen knives flat, and a handle rest for each knife. See [Special bins](../designer/special-bins).

## L

**Label plate**: a separate printed plate that clicks into a socket on a label tab, so you can change the label later. See [Swappable label plates](../designer/label-plates).

**Label tab**: a sloped shelf along one edge of a compartment, where a printed or written label sits. See [Labels and text](../designer/labels-and-text).

**Labs**: features that are still in development. Turn them on in <Ui k="settings.title" /> > <Ui k="settings.tabs.labs" />. See [Labs](../settings/labs).

**Layer**: one level of bins in a layout. Bins on a higher layer sit on top of the bins below. A layout has 1 to 10 layers. See [Layouts, layers and the stash](../concepts/layouts-layers-stash).

**Layout**: one planned drawer, with its grid, its layers and its bins. The Layout Tool saves each layout in your browser while you work. See [Layouts, layers and the stash](../concepts/layouts-layers-stash).

**Layout editor**: the tool where you plan a drawer. Open it with the <Ui k="toolSwitcher.layout" /> tab. See [Plan your first drawer](../getting-started/first-drawer).

**Layout manager**: the dialog that lists all your layouts, with folders, import and export. Press <kbd>Ctrl</kbd>+<kbd>O</kbd> (<kbd>Cmd</kbd>+<kbd>O</kbd> on a Mac). See [Organize your layouts](../layouts/organizing-layouts).

**Lid**: a cover that the bin designer builds to fit a bin. Most lids grip the stacking lip of the bin. A sliding lid runs in a channel and needs no lip. See [Lids](../designer/lids).

**Lightweight floor**: a base option that hollows each foot to save filament. See [The base](../designer/base).

**Linked bin**: a bin in a layout that uses a saved design. The layout shows and exports the shape of that design. See [Saved designs and linked bins](../concepts/saved-designs).

**Low-profile base**: a base 1.1 mm shorter in its straight middle band, so each bin has 1.1 mm more room inside. Standard bins still fit a low-profile plate. See [Baseplate basics](../baseplates/basics).

## M

**Magnet hole**: a round hole in the base of a bin or in a baseplate that holds a magnet. The default hole is 6.5 mm wide and 2 mm deep. See [Magnets and screws](../baseplates/magnets-and-screws).

## O

**Overhang**: extra width on one or more sides of a bin body, so the bin fills the gap at the edge of a drawer. See [Size and shape](../designer/size-and-shape).

## P

**Padding**: the solid margin, in millimeters, between the baseplate grid and the drawer wall on each side. See [Baseplate basics](../baseplates/basics).

**Paint mode**: a way to place many bins of one size. Pick a size with the <Ui k="layers.sizeSelector" />, then drag on the grid. See [Place and edit bins](../layouts/placing-bins).

**Places**: a Labs feature. You list what each bin holds, then find it in any layout from the command palette. See [Labs](../settings/labs).

**Print bed**: the build plate of your printer. A bin or a baseplate larger than the print bed size splits into pieces. See [Fitting the print bed](../concepts/print-bed-fit).

**Print list**: the list of every bin and piece to print for a layout, with filament, cost and time estimates. See [The print list and ZIP export](../printing/print-list-and-zip).

**Pull tab**: a raised grip on a wall or on the center divider of a bin. See [Scoops, fillets and pull tabs](../designer/getting-things-out).

## Q

**Quick label**: a small box to edit the label of a bin on the grid. Select one bin and press <kbd>L</kbd>, or double-click the bin. See [Place and edit bins](../layouts/placing-bins).

## S

**Saved design**: a bin design in your library in the bin designer. You can link it to bins in any layout. See [Save and reuse designs](../designer/save-and-reuse).

**Screw hole**: a hole in the base of a bin or in a baseplate for a screw. A baseplate can also have screw-down holes that fasten it to the drawer. See [Magnets and screws](../baseplates/magnets-and-screws).

**Slant**: a bin that leans toward one side, so tall items such as pens fit a shallow drawer. See [Special bins](../designer/special-bins).

**Spacer**: an open riser that you stack under a bin, so bins of different heights finish level. A spacer can be 1 height unit tall. See [Stacking](../designer/stacking).

**Split**: a bin or a baseplate cut into pieces that fit the print bed. See [Split for your print bed](../baseplates/splitting).

**Stacking lip**: the shaped rim at the top of a bin. The feet of another bin sit in it, so bins can stack. See [Stacking](../designer/stacking).

**Stash**: the holding area below the grid. Bins in the stash keep their size but are not in the drawer. A bin goes to the stash when a drawer resize has no room for it. See [Layouts, layers and the stash](../concepts/layouts-layers-stash).

**STEP**: a 3D file format that the bin designer and the baseplate generator can export. A STEP file cannot carry an imported STL shape. See [File formats](../printing/file-formats).

**STL**: a 3D file made of triangles. It holds no color data. See [File formats](../printing/file-formats).

## V

**Variant**: a design that takes its values from a parent design, except the values that you change. A change to the parent goes to every variant. See [Save and reuse designs](../designer/save-and-reuse).

**Version**: a named copy of a design at one point in time. You can restore it later. See [Save and reuse designs](../designer/save-and-reuse).

**Vertical stack**: a baseplate option that prints several plates in one tower, up to the build height of your printer. See [Eco plates and stack printing](../baseplates/eco-and-stack-printing).

## W

**Wall cutout**: an opening through a bin wall for cables, front access or air. See [Walls](../designer/walls).

**Wall pattern**: a repeated shape of holes, such as a honeycomb, cut through the walls of a bin. See [Walls](../designer/walls#add-a-wall-pattern).

**Workshop**: an Experimental way to build a tool holder out of parts. Start one with <Ui k="binDesigner.newWorkshop" /> in <Ui k="binDesigner.savedDesigns" />. See [Workshop](../cutouts/workshop).

## Next steps

- [Units and sizes](../concepts/units): the three units that the Layout Tool uses.
- [Gridfinity dimensions](./dimensions): the measurements behind each term.
- [FAQ](./faq): short answers to common questions.
