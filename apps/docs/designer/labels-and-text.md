---
title: Labels and text
description: 'Add label tabs and wall, floor and lid text, then set the font, size and finish of the letters.'
sources:
  - src/features/bin-designer/components/panel/LabelTabsSection/
  - src/features/bin-designer/components/panel/TypeSection/
  - src/features/bin-designer/types/text.ts
  - src/features/bin-designer/types/labelTabs.ts
  - src/features/bin-designer/components/panel/WallsSection/WallSurfaceSection.tsx
  - src/features/bin-designer/components/panel/FloorTextSection/
  - src/features/bin-designer/components/panel/LidSection/LidSection.tsx
  - src/features/bin-inspector/components/Inspector/BinLabelField/
  - src/shared/utils/typePlan.ts
  - src/features/design-linking/hooks/useQuickExport.ts
---

# Labels and text

A label tells you what's in a bin before you open the drawer. You can print text on label tabs, walls, floors and lids. All the text on one bin shares one type style, so a drawer full of bins reads as one tidy set.

## Add label tabs

A **label tab** is a small ledge along the top of a compartment wall. Print a caption on it, stick a paper label on it, or give it a [swappable label plate](./label-plates).

1. In the bin designer, open the <Ui k="binDesigner.group.interior" /> group and turn on <Ui k="binDesigner.labelTabs" />.
2. Under <Ui k="binDesigner.tabMode" />, keep <Ui k="binDesigner.tabMode.text" />.
3. Type a caption for each compartment in the <Ui k="binDesigner.labelText" /> list.

Each row in the list matches a compartment number on the grid. Not sure which row is which? Click <Ui k="binDesigner.labelTextPickOnGrid" />, then click the compartment. Press <kbd>Enter</kbd> to jump to the next row. A blank row prints a bare ledge, which still takes a paper label.

You can also type a caption right on the compartment grid. Above the grid, select <Ui k="binDesigner.compartmentEditor.modeLabels" />, then click a compartment. [Set up the compartment grid](./compartments#set-up-the-compartment-grid) explains the grid.

A tab needs compartment walls to hang from. That's why the section shows only for the <Ui k="binDesigner.interior.standard.title" /> and <Ui k="binDesigner.interior.bento.title" /> interiors. A custom-shape bin or a very shallow bin can't carry a tab.

<Screenshot id="designer-labels-and-text-tab-list" alt="Screws, Nuts and Washers are typed into the Label text list, with Enter to go to the next row. The bin then shows the three captions in capitals on its label tabs." spec="Bin designer, 3 x 1 bin with 3 compartments, Interior group, Label tabs on, Printed text. Close-up of the Label text list: type Screws, press Enter, type Nuts, press Enter, type Washers. Cut to the bin from above, so the captions read." />

### One tab per compartment or per row

Above the list, pick <Ui k="binDesigner.labelTextPerCompartment" /> or <Ui k="binDesigner.labelTextPerRow" />. Pick one per row when the compartments are too narrow for a legible caption. Each row then gets one full-width tab. A row gets a full-width tab only where a wall runs the full inner width behind it.

### Place and shape the tabs

Two folded groups below the list set where the tabs go and how big they are. Not sure? Keep the defaults: a full-width tab on the back wall, on a bracket.

| Group                                      | Control                                                                                                                             | What it does                                                                                                                                                          |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <Ui k="binDesigner.labelPlacementGroup" /> | <Ui k="binDesigner.tabEdges" />                                                                                                     | Puts the tab on the <Ui k="binDesigner.tabEdges.back" /> wall (the default), the <Ui k="binDesigner.tabEdges.front" /> wall, or <Ui k="binDesigner.tabEdges.both" />. |
| <Ui k="binDesigner.labelPlacementGroup" /> | <Ui k="binDesigner.tabAlignment" />                                                                                                 | Moves a tab that is narrower than its compartment to the left, center or right.                                                                                       |
| <Ui k="binDesigner.tabShapeGroup" />       | <Ui k="binDesigner.tabSupport" />                                                                                                   | Sets the support under the ledge: <Ui k="binDesigner.tabSupport.bracket" />, <Ui k="binDesigner.tabSupport.solid" /> or <Ui k="binDesigner.tabSupport.fillet" />.     |
| <Ui k="binDesigner.tabShapeGroup" />       | <Ui k="binDesigner.tabWidth" />, <Ui k="binDesigner.tabDepth" />, <Ui k="binDesigner.tabHeight" />, <Ui k="binDesigner.tabInset" /> | Width is a percent of the compartment. Depth is how far the ledge reaches in. Height sets how high the ledge sits. Inset moves it away from its wall.                 |
| <Ui k="binDesigner.tabShapeGroup" />       | <Ui k="binDesigner.tabLip" />                                                                                                       | Adds a raised rim on the front edge, so a loose paper label can't slide off.                                                                                          |

A shallow compartment can't hold two tabs. If you pick <Ui k="binDesigner.tabEdges.both" /> on one, the panel warns you. Click <Ui k="binDesigner.tabAutoFix" /> to sort it out: it sets the inset to zero and reduces the depth, or moves the tabs to one wall.

### Write a second line

A caption can have up to three lines of up to 50 characters each. Lines after the first print smaller, like a subheading.

- In the label list, press <kbd>Shift</kbd>+<kbd>Enter</kbd> for a new line.
- In a wall, floor or lid text box, press <kbd>Enter</kbd>.

If one long line doesn't fit, the Layout Tool can wrap it onto more lines. If a caption is too long to print at a legible size, its row shows a warning. Click <Ui k="binDesigner.labelTextWidenTabs" />, or shorten the text.

## Set the type style

The <Ui k="binDesigner.type.heading" /> section, in the <Ui k="binDesigner.group.finishing" /> group, sets one style for every caption on the bin. It shows up once the bin carries some text.

The quickest way in is a preset. Every new design starts with <Ui k="binDesigner.type.preset.engineering" />.

| Preset                                               | Looks like                                |
| ---------------------------------------------------- | ----------------------------------------- |
| <Ui k="binDesigner.type.preset.engineering" />       | Bold capitals at one fixed size           |
| <Ui k="binDesigner.type.preset.utility-mono" />      | Bold monospace capitals at one fixed size |
| <Ui k="binDesigner.type.preset.condensed-display" /> | Tall, narrow capitals at one fixed size   |
| <Ui k="binDesigner.type.preset.classic" />           | Letters as you typed them, sized to fit   |

Want every label in the drawer to match? Pick one of the first three. Want each caption as large as its space allows? Pick <Ui k="binDesigner.type.preset.classic" />.

Below the presets, you can change each part of the style yourself:

- **<Ui k="binDesigner.type.font" />:** seven fonts, for example <Ui k="binDesigner.type.font.atkinson" /> and <Ui k="binDesigner.type.font.jetbrains-mono" />.
- **<Ui k="binDesigner.type.case" />:** <Ui k="binDesigner.type.case.as-typed" />, <Ui k="binDesigner.type.case.upper" /> or <Ui k="binDesigner.type.case.title" />.
- **<Ui k="binDesigner.type.sizeMode" />:** <Ui k="binDesigner.type.sizeMode.auto" /> makes each caption as large as its space allows. <Ui k="binDesigner.type.sizeMode.fixed" /> prints all captions at one size from 2 to 40 mm, and shrinks text only where it can't fit.
- **<Ui k="binDesigner.type.anchor" />:** pins the text to one of nine points on its surface.

<Ui k="binDesigner.type.advanced" /> holds the finer controls:

- the finish (see [Pick a text finish](#pick-a-text-finish))
- <Ui k="binDesigner.type.tracking" /> and <Ui k="binDesigner.type.lineScale" />
- <Ui k="binDesigner.type.depth" /> and <Ui k="binDesigner.type.profile" />

If the strokes are too thin for your nozzle, the section tells you and offers a fix, for example <Ui k="binDesigner.type.stemFix.bold" />.

The <Ui k="binDesigner.tabTextGroup" /> group in the label section also sets the finish, the <Ui k="binDesigner.textDepth" /> and a maximum size for label tabs. Tabs in one row share one size, so a long caption makes its neighbors smaller.

<Screenshot id="designer-labels-and-text-typography" alt="The Typography section with the four presets, the type preview and the typeface, case and size controls." spec="Bin designer, Finishing group open, a bin with label tab captions so the section shows. Engineering preset active. Crop to the Typography section from its heading to the Position picker." />

## Pick a text finish

Each text surface has a <Ui k="binDesigner.textMode" /> picker. Not sure? Pick Engrave. It works on every surface and needs only one filament.

| Finish                                      | What prints                                                                                                          | Where                              |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| <Ui k="binDesigner.textMode.engrave" />     | Letters cut into the surface                                                                                         | Every surface                      |
| <Ui k="binDesigner.textMode.emboss" />      | Letters that stand up from the surface                                                                               | Every surface                      |
| <Ui k="binDesigner.textMode.through-cut" /> | Letters cut all the way through, in <Ui k="binDesigner.type.font.allerta-stencil" /> so letter centers stay attached | Tabs, walls and lid                |
| <Ui k="binDesigner.textMode.flat" />        | Letters level with the surface, in the <Ui k="binDesigner.textColor" />                                              | Every surface, with multi-color on |

Flat letters show only in a second filament, so the picker offers Flat only when multi-color is on. If the Text color matches the surface under flat letters, the panel warns you and offers <Ui k="binDesigner.textColor.useContrasting" />. See [Colors](./colors).

## Add wall text

Wall text puts a caption on the side of the bin, on the outside or the inside.

1. Open the <Ui k="binDesigner.group.finishing" /> group and turn on <Ui k="binDesigner.walls.text.heading" />.
2. Type text in the box for each wall that needs it.
3. Under each box, pick <Ui k="binDesigner.walls.text.face.outside" /> or <Ui k="binDesigner.walls.text.face.inside" />.

Inside text reads from inside the bin, so a caption on the back wall faces you when you open the drawer. The text goes in the clear area of each wall, away from cutouts and handles. Inside text also stays clear of dividers, scoops and label tabs. A solid bin has no inside face, and custom-shape bins take no wall text.

<Screenshot id="designer-labels-and-text-wall-text" alt="Wall text is turned on and Cables is typed in the Front box, with Outside picked under it. The front of the bin then shows CABLES engraved." spec="Bin designer, bin 3 x 2 x 4. Close-up of the Finishing group: turn on Wall text, type Cables in the Front box. Outside and Engrave are the defaults. Cut to the bin in the Front view." />

## Add floor and lid text

For floor text, open the <Ui k="binDesigner.group.finishing" /> group, turn on <Ui k="binDesigner.floor.text.heading" /> and type the text. It goes on the largest clear part of the floor, away from dividers, scoops and raised floors. A floor has a base under it, so it can't take Through-cut. <Ui k="binDesigner.lid.text.rotation" /> turns the text in quarter turns.

For lid text, turn on the lid in the <Ui k="binDesigner.group.lid" /> group, then turn on <Ui k="binDesigner.lid.section.text" />. A full stack grid covers the lid top, so lid text needs a flat top, a tray, or <Ui k="binDesigner.lid.stackLipOnly" />. See [Lids](./lids).

## Use label suggestions

In the layout editor, each bin has a <Ui k="inspector.binLabel" /> box in the bin inspector. Click in it or start to type, and a list of suggestions opens. Each one tells you why it's there, for example <Ui k="inspector.labelSuggest.reason.nextInSet" />. On a computer, the top suggestion shows as gray text, and <kbd>Tab</kbd> accepts it. Your browser makes the suggestions from your layout and a built-in catalog of common labels.

One design for many bins? If the design has only one caption, leave that caption blank. Each linked bin then prints its own <Ui k="inspector.binLabel" /> from the layout.

## When it goes wrong

### A caption is too long to print

Click <Ui k="binDesigner.labelTextWidenTabs" /> under the row, or make the text shorter. In narrow compartments, <Ui k="binDesigner.labelTextPerRow" /> gives each row one full-width tab.

Each caption must print at a size that you can read. A long caption on a narrow tab can't, so its row shows a warning.

### You can't turn on label tabs

Make the bin taller. A label tab needs more than 9 mm of depth inside the bin. Is the section not there at all? Pick the <Ui k="binDesigner.interior.standard.title" /> or <Ui k="binDesigner.interior.bento.title" /> interior.

A tab hangs from the compartment walls. Removable dividers, solid bins and custom-shape bins can't carry tabs. See [Add label tabs](#add-label-tabs).

### The letters are too thin to print

Click the button under the warning in <Ui k="binDesigner.type.heading" />. It applies the fix that suits your font: a bold cut, more space between letters, or a larger size.

The panel warns when the thinnest stroke of a letter is under 0.8 mm, about two lines of a 0.4 mm nozzle. Thinner strokes run together when they print.

### The tabs print blank

Type a caption in each row of <Ui k="binDesigner.labelText" />. <Ui k="binDesigner.labelTextNextBlank" /> takes you to the next empty row.

A blank row prints a bare ledge. A linked bin can print its layout label instead. Only the layout ZIP, the 3D layout preview and <Ui k="common.export" /> under <Ui k="designLinking.inspector.linkedDesign" /> in the inspector do this. See [Troubleshooting prints](../printing/troubleshooting#the-labels-are-blank-or-missing).

## Next steps

- [Swappable label plates](./label-plates): print labels on separate plates that you can change later.
- [Colors](./colors): print text in a second filament with the <Ui k="binDesigner.textColor" />.
- [Lids](./lids): add a lid that carries its own text.
- [Multi-color printing](../concepts/multi-color): learn how each color reaches your slicer.
