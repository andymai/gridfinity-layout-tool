---
title: SpaceMouse
description: 'Turn on a 3Dconnexion SpaceMouse and use it to pan, zoom and orbit the 3D previews.'
sources:
  - src/shared/spacemouse/
  - src/shell/Modals/SettingsModal/tabs/GeneralTab/GeneralTab.tsx
  - src/shared/spacemouse/buttonMap.ts
  - src/shared/spacemouse/navlib/types.ts
---

# SpaceMouse

The Gridfinity Layout Tool can use a 3Dconnexion SpaceMouse to move the camera in its 3D previews. Push, tilt and twist the puck to pan, zoom and orbit around a bin or a baseplate while your other hand stays on the mouse. The SpaceMouse is off until you turn it on.

## Turn it on

1. Open Settings and select <Ui k="settings.tabs.general" />.
2. In the <Ui k="settings.spacemouse" /> section, turn on <Ui k="settings.spacemouseEnable" />.
3. Look at the status line below the switch. If it shows <Ui k="spacemouse.status.idle" />, click <Ui k="spacemouse.connect" />.
4. In the browser dialog, select your SpaceMouse and allow the connection.

While the switch is off, the Layout Tool does not look for a driver or a device. The switch applies to all open tabs of the Layout Tool.

<Screenshot id="settings-spacemouse-general" alt="The SpaceMouse section on the General tab of Settings, with the switch on, the status line, and the speed and invert controls." spec="Settings, General tab, desktop Chrome without the 3Dconnexion driver, with a SpaceMouse paired. Turn on the SpaceMouse switch so the status, the three sliders and the five invert switches show. Crop to the SpaceMouse section." />

## Driver or direct connection

The Layout Tool connects to the SpaceMouse in one of two ways. It tries the driver first.

| Connection         | When the Layout Tool uses it                                 | Browsers              | Where you set speed and axes                                                      |
| ------------------ | ------------------------------------------------------------ | --------------------- | --------------------------------------------------------------------------------- |
| 3Dconnexion driver | The 3Dconnexion driver is installed and runs on the computer | Any browser           | The 3Dconnexion control panel. Settings shows <Ui k="spacemouse.driverManaged" /> |
| Direct             | No driver answers                                            | Chrome, Edge or Opera | Settings in the Layout Tool                                                       |

If the status shows <Ui k="spacemouse.status.unsupported" />, the browser cannot make a direct connection. Install the 3Dconnexion driver, or use Chrome, Edge or Opera. If the driver stops, the Layout Tool changes to the direct connection.

After the first pairing, the direct connection connects again by itself to the same device. If the status shows <Ui k="spacemouse.status.error" />, click <Ui k="spacemouse.connect" /> to try again.

## Adjust the movement

With the direct connection, the <Ui k="settings.spacemouse" /> section has these controls:

| Control                               | What it changes                                                                                                                                                                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <Ui k="spacemouse.sensitivity" />     | The speed of all movement, on top of the two speeds below                                                                                                                                                                             |
| <Ui k="spacemouse.speed.translate" /> | The speed of pan and zoom                                                                                                                                                                                                             |
| <Ui k="spacemouse.speed.rotate" />    | The speed of orbit                                                                                                                                                                                                                    |
| <Ui k="spacemouse.invertAxes" />      | Five switches that reverse one direction of movement each: <Ui k="spacemouse.axis.panX" />, <Ui k="spacemouse.axis.panY" />, <Ui k="spacemouse.axis.zoom" />, <Ui k="spacemouse.axis.orbitH" /> and <Ui k="spacemouse.axis.orbitV" /> |

<Ui k="common.reset" /> sets all of them back to the defaults.

## What it moves in each tool

The SpaceMouse moves the camera of one 3D view at a time:

| Tool                | 3D view                                                                  |
| ------------------- | ------------------------------------------------------------------------ |
| Layout editor       | The 3D preview of the layout                                             |
| Bin designer        | The preview of the bin, and the Workshop view                            |
| Baseplate generator | The preview of the baseplate                                             |
| Dialogs             | The 3D view in a dialog, for example a community design or an STL import |

When a dialog with a 3D view is open, the SpaceMouse moves that view. If not, it moves the view that the mouse pointer was over last. The SpaceMouse moves nothing while the browser window does not have the focus. Each view keeps its own limits, so the camera cannot orbit past the angles that the view allows.

## The buttons

With the direct connection, the buttons do these actions:

| Button | Action                    |
| ------ | ------------------------- |
| 1      | Fit the model in the view |
| 2      | Reset the view            |
| 3      | Top view                  |
| 4      | Front view                |
| 5      | Right view                |
| 6      | Isometric view            |
| 7      | Undo                      |
| 8      | Redo                      |

Every SpaceMouse has buttons 1 and 2. The larger models also have the other buttons. With the driver, assign these same actions to the buttons in the 3Dconnexion control panel. The Fit button of the puck works without an assignment.

## Next steps

- [Preview and export](../concepts/preview-and-export): what the 3D preview shows.
- [Settings and accessibility](./settings): the other tabs in Settings.
- [Keyboard shortcuts](../reference/shortcuts): the keys for the 3D preview.
