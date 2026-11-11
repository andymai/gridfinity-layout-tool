---
title: Settings and accessibility
description: 'Find each tab of the Settings dialog: language, theme, accessibility, layout defaults, print values, data and exports.'
sources:
  - src/shell/Modals/SettingsModal/
  - src/core/store/settings.types.ts
  - src/i18n/types.ts
  - src/core/constants.ts
  - src/shell/styles/themes.css
---

# Settings and accessibility

Make the app look and work the way you like. The Settings dialog of the Gridfinity Layout Tool holds the choices that apply to all your work. These include the language, the theme, accessibility, and the values that new layouts and bins start with. Each device keeps its own settings, and an account doesn't sync them.

## Open Settings

- Click the gear button (<Ui k="sidebar.settings" />) in the header. It's there in the layout editor, the bin designer and the baseplate generator.
- In the command palette, run <Ui k="commandPalette.openSettings" />.

Need to find one setting? Type a word in <Ui k="settings.search.placeholder" /> at the top of the dialog, for example "dark" or "nozzle". Each result shows the tab that holds it.

Changed something and want it back? Each section has a <Ui k="settings.section.reset" /> button that puts that section back to its defaults. At the bottom of the dialog, <Ui k="settings.resetTabDefaults" /> puts every setting back to its default, and you can't undo it. <Ui k="settings.resetOnboarding" /> shows the first-time tutorial again after a reload.

<Screenshot id="settings-settings-dialog" alt="The Settings dialog with the tab list in four groups on the left and the Appearance tab open on the right." spec="Desktop, any tool. Open Settings from the gear in the header and select the Appearance tab. Show the whole dialog, with the search box and the four tab groups visible." />

## Preferences

The <Ui k="settings.tabs.general" /> tab:

| Setting                                         | What it does                                                                                                       |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| <Ui k="settings.language" />                    | <Ui k="settings.autoDetect" /> follows your browser. You can also pick one of 16 languages.                        |
| <Ui k="settings.general.showUpdateSummaries" /> | Shows a short summary of the changes after an update. The sidebar marks new items either way.                      |
| <Ui k="settings.general.installApp" />          | Installs the Layout Tool as an app with its own window. See [Install and work offline](./offline#install-the-app). |
| <Ui k="settings.spacemouse" />                  | Turns on a 3Dconnexion SpaceMouse. See [SpaceMouse](./spacemouse).                                                 |

The <Ui k="settings.tabs.appearance" /> tab:

| Setting                         | What it does                                                                                                                                                                                                                      |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <Ui k="settings.theme" />       | <Ui k="settings.theme.system" /> follows your computer. Pick <Ui k="settings.theme.dark" /> or <Ui k="settings.theme.light" /> to keep one look.                                                                                  |
| <Ui k="settings.accentColor" /> | The color of buttons and other controls. Pick one of six colors.                                                                                                                                                                  |
| <Ui k="settings.uiDensity" />   | The spacing and the text size. <Ui k="settings.uiDensity.compact" /> fits more on the screen. <Ui k="settings.uiDensity.comfortable" /> gives more room and larger text. <Ui k="settings.uiDensity.default" /> sits between them. |

## Accessibility

The <Ui k="settings.tabs.accessibility" /> tab has three switches:

| Setting                              | What it does                              |
| ------------------------------------ | ----------------------------------------- |
| <Ui k="settings.reduceMotion" />     | <Ui k="settings.reduceMotionHint" />.     |
| <Ui k="settings.highContrast" />     | <Ui k="settings.highContrastHint" />.     |
| <Ui k="settings.categoryPatterns" /> | <Ui k="settings.categoryPatternsHint" />. |

If some category colors look alike to you, turn on <Ui k="settings.categoryPatterns" />. See [Categories](../layouts/categories).

Most dialogs, menus and lists also work from the keyboard. See [Keyboard and command palette](./keyboard-and-command-palette).

## Defaults

These tabs set the values that a new layout or a new bin starts with. Your existing layouts don't change.

**<Ui k="settings.tabs.defaults" />** has these settings:

| Setting                                 | Unit                                                    |
| --------------------------------------- | ------------------------------------------------------- |
| Drawer width, depth and height          | Grid units for width and depth, height units for height |
| <Ui k="settings.defaultLayerHeight" />  | Height units                                            |
| <Ui k="settings.defaultPrintBedSize" /> | Millimeters                                             |
| <Ui k="settings.defaultGridUnit" />     | Millimeters, from 20 to 60. Standard Gridfinity is 42.  |

Not sure about the grid unit? Keep 42 mm, unless your other parts use a size that is not standard. After you set up one drawer the way you like, <Ui k="settings.copyFromCurrentLayout" /> copies these values from the open layout. See [Units](../concepts/units).

**<Ui k="settings.tabs.print" />** holds the values that the print estimates use. Set them to match your slicer profile:

- <Ui k="settings.filamentCostPerKg" />
- <Ui k="settings.printLayerHeight" />
- <Ui k="settings.infillPercent" />
- <Ui k="settings.nozzleSize" />: connectors, wall locks and baseplate clips scale to it, so they still print on wider nozzles.

See [Estimates](../printing/estimates).

**<Ui k="settings.tabs.categories" />** has two sections:

- <Ui k="settings.defaultCategories" /> sets the categories of a new layout. Click <Ui k="settings.saveCategoriesAsDefaults" /> to use the categories of the open layout.
- <Ui k="settings.binDefaults.title" /> shows if new bins in the bin designer start from your own defaults. To set them, run <Ui k="commandPalette.setBinDefault" /> in the command palette.

## Account and data

| Tab                              | What it holds                                                                                                                                                                |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <Ui k="settings.tabs.account" /> | Sign-in, sync state, sign-out and account deletion. See [Accounts and sync](../sharing/accounts-and-sync).                                                                   |
| <Ui k="settings.tabs.privacy" /> | <Ui k="settings.helpImprove" />: <Ui k="settings.helpImproveHint" />. If your browser sends a privacy signal, it starts off.                                                 |
| <Ui k="settings.tabs.storage" /> | The storage state, the number of layouts and the database size. <Ui k="settings.storage.clearAllData" /> is here too.                                                        |
| <Ui k="settings.tabs.exports" /> | <Ui k="exportDestination.folder.title" /> puts exports in a folder, not in Downloads. <Ui k="exportDestination.url.title" /> also sends a copy of each export to an address. |

::: warning
Back up your layouts before you click <Ui k="settings.storage.clearAllData" />. It deletes all layouts, snapshots and cached data in this browser, and you can't undo it. Your settings, your saved bin designs and your saved baseplates stay.
:::

## Advanced

| Tab                                   | What it holds                                               |
| ------------------------------------- | ----------------------------------------------------------- |
| <Ui k="settings.tabs.integrations" /> | The websites that STL search looks at for Gridfinity files. |
| <Ui k="settings.tabs.labs" />         | Early features that you can turn on. See [Labs](./labs).    |

## Next steps

- [Keyboard and command palette](./keyboard-and-command-palette): run any command without the mouse.
- [Labs](./labs): try the early features.
- [Your data and privacy](../introduction/your-data): what the browser stores and how to back it up.
- [Install and work offline](./offline): use the Layout Tool without a connection.
