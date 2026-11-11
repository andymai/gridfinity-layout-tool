---
title: Settings and accessibility
description: 'Find each tab of the Settings dialog: language, theme, accessibility, layout defaults, print values, data and exports.'
sources:
  - src/shell/Modals/SettingsModal/
  - src/core/store/settings.types.ts
  - src/i18n/types.ts
  - src/core/constants.ts
---

# Settings and accessibility

The Settings dialog of the Gridfinity Layout Tool holds the choices that apply to all your work. These include the language, the look of the app, accessibility, and the values for new layouts and bins. This page tells you what each tab does. Each device keeps its own settings, and an account does not sync them.

## Open Settings

- Click the gear button (<Ui k="sidebar.settings" />) in the header. It is in the layout editor, the bin designer and the baseplate generator.
- In the command palette, run <Ui k="commandPalette.openSettings" />.

To find one setting, type a word in <Ui k="settings.search.placeholder" /> at the top of the dialog, for example "dark" or "nozzle". The results show the tab of each match.

Each section has a <Ui k="settings.section.reset" /> button that sets that section back to its defaults. The bottom of the dialog has <Ui k="settings.resetTabDefaults" /> and <Ui k="settings.resetOnboarding" />. <Ui k="settings.resetOnboarding" /> shows the first-time tutorial again after a reload.

<Screenshot id="settings-settings-dialog" alt="The Settings dialog with the tab list in four groups on the left and the Appearance tab open on the right." spec="Desktop, any tool. Open Settings from the gear in the header and select the Appearance tab. Show the whole dialog, with the search box and the four tab groups visible." />

## Preferences

| Tab                                 | Setting                                         | What it does                                                                                                                                     |
| ----------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| <Ui k="settings.tabs.general" />    | <Ui k="settings.language" />                    | <Ui k="settings.autoDetect" /> follows the browser. You can also choose one of 16 languages.                                                     |
| <Ui k="settings.tabs.general" />    | <Ui k="settings.general.showUpdateSummaries" /> | Shows a short summary of the changes after an update. The sidebar marks new items either way.                                                    |
| <Ui k="settings.tabs.general" />    | <Ui k="settings.spacemouse" />                  | Turns on a 3Dconnexion SpaceMouse. See [SpaceMouse](./spacemouse).                                                                               |
| <Ui k="settings.tabs.appearance" /> | <Ui k="settings.theme" />                       | <Ui k="settings.theme.dark" />, <Ui k="settings.theme.light" />, or <Ui k="settings.theme.system" /> to follow your computer.                    |
| <Ui k="settings.tabs.appearance" /> | <Ui k="settings.accentColor" />                 | The color of buttons and other controls. There are six colors.                                                                                   |
| <Ui k="settings.tabs.appearance" /> | <Ui k="settings.uiDensity" />                   | <Ui k="settings.uiDensity.compact" />, <Ui k="settings.uiDensity.default" /> or <Ui k="settings.uiDensity.comfortable" /> spacing and text size. |

## Accessibility

The <Ui k="settings.tabs.accessibility" /> tab has three switches:

| Setting                              | What it does                              |
| ------------------------------------ | ----------------------------------------- |
| <Ui k="settings.reduceMotion" />     | <Ui k="settings.reduceMotionHint" />.     |
| <Ui k="settings.highContrast" />     | <Ui k="settings.highContrastHint" />.     |
| <Ui k="settings.categoryPatterns" /> | <Ui k="settings.categoryPatternsHint" />. |

Turn on <Ui k="settings.categoryPatterns" /> if you find some category colors hard to tell apart. See [Categories](../layouts/categories).

Most dialogs, menus and lists also work from the keyboard. See [Keyboard and command palette](./keyboard-and-command-palette).

## Defaults

These tabs set the values that a new layout or a new bin starts with. They do not change your existing layouts.

**<Ui k="settings.tabs.defaults" />** sets the drawer width, depth and height, the <Ui k="settings.defaultLayerHeight" />, the <Ui k="settings.defaultPrintBedSize" /> and the <Ui k="settings.defaultGridUnit" />. The drawer size and the layer height are in grid units and height units. The print bed and the grid unit are in millimeters. The grid unit can go from 20 to 60 mm, and standard Gridfinity is 42 mm. <Ui k="settings.copyFromCurrentLayout" /> copies these values from the open layout. See [Units](../concepts/units).

**<Ui k="settings.tabs.print" />** holds the values for print estimates: <Ui k="settings.filamentCostPerKg" />, <Ui k="settings.printLayerHeight" />, <Ui k="settings.infillPercent" /> and <Ui k="settings.nozzleSize" />. Set them to match your slicer profile. Connectors, wall locks and baseplate clips scale to the nozzle size, so they print on wider nozzles. See [Estimates](../printing/estimates).

**<Ui k="settings.tabs.categories" />** has two sections. <Ui k="settings.defaultCategories" /> sets the categories of a new layout. Click <Ui k="settings.saveCategoriesAsDefaults" /> to use the categories of the open layout. <Ui k="settings.binDefaults.title" /> shows if new bins in the bin designer start from your own defaults. To set them, run <Ui k="commandPalette.setBinDefault" /> in the command palette.

## Account and data

| Tab                              | What it holds                                                                                                                                                                |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <Ui k="settings.tabs.account" /> | Sign-in, sync state, sign-out and account deletion. See [Accounts and sync](../sharing/accounts-and-sync).                                                                   |
| <Ui k="settings.tabs.privacy" /> | <Ui k="settings.helpImprove" />: <Ui k="settings.helpImproveHint" />. If your browser sends a privacy signal, it starts off.                                                 |
| <Ui k="settings.tabs.storage" /> | The storage state, the number of layouts and the database size. <Ui k="settings.storage.clearAllData" /> is here too.                                                        |
| <Ui k="settings.tabs.exports" /> | <Ui k="exportDestination.folder.title" /> puts exports in a folder, not in Downloads. <Ui k="exportDestination.url.title" /> also sends a copy of each export to an address. |

::: warning
Back up your layouts before you click <Ui k="settings.storage.clearAllData" />. It deletes all layouts, snapshots and cached data in this browser, and you cannot undo it. Your settings, your saved bin designs and your saved baseplates stay.
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
