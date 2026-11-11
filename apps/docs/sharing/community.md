---
title: The community gallery
description: 'Browse, remix and publish bin designs, post your prints, and report a problem design.'
sources:
  - src/features/community/
  - src/shared/utils/communityLowEffort.ts
  - api/lib/communityQuota.ts
  - api/lib/communityDesignActions.ts
  - src/shell/Modals/DesignGalleryModal/
  - src/features/bin-designer/components/DesignerPage/DesignerHeader.tsx
---

# The community gallery

The community gallery holds bin designs that other makers published from the Gridfinity Layout Tool. Browse it to find a bin for a tool you own, print it as it is, or remix it into your own design. When you make a bin that works well, publish it so other people can print it too.

## Open the gallery

- In the bin designer, click <Ui k="binExamples.sidebarEntry" /> in the panel. The gallery opens on its <Ui k="binExamples.gallery.tabs.community" /> tab. The <Ui k="binExamples.gallery.tabs.examples" /> tab holds the built-in examples.
- Open [the community page](https://gridfinitylayouttool.com/community) in your browser.
- In the layout editor, pick an empty area of the drawer and see the designs that fit it. See [Find bins that fit](../layouts/find-bins-that-fit).

You do not need an account to browse, open or remix a design.

## Find a design

Type in <Ui k="community.gallery.searchLabel" /> to search the design names and the public names of the makers. Narrow the results in the <Ui k="community.gallery.filterPanelLabel" /> panel:

| Filter                                      | What it keeps                                                                                                                          |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| <Ui k="community.gallery.showSection" />    | <Ui k="community.gallery.likedFilter" />, <Ui k="community.gallery.mineFilter" /> or <Ui k="community.gallery.recentFilter" /> designs |
| <Ui k="community.gallery.categoryLabel" />  | One category of designs                                                                                                                |
| <Ui k="community.gallery.sizeLabel" />      | A range of width, depth and height                                                                                                     |
| <Ui k="community.gallery.techniqueLabel" /> | Designs that use one feature, such as a scoop or a label tab                                                                           |

Change the order with <Ui k="community.gallery.sortLabel" />: <Ui k="community.gallery.sort.newest" />, <Ui k="community.gallery.sort.likes" />, <Ui k="community.gallery.sort.remixes" /> or <Ui k="community.gallery.sort.prints" />. The address of the community page keeps your search and filters, so you can send a filtered gallery to another person.

The print count on a card shows how many people printed the design and posted the result.

<Screenshot id="sharing-community-gallery" alt="The community gallery with the filter panel open on the left and a grid of design cards on the right." spec="Open gridfinitylayouttool.com/community on desktop at 1440 px wide. Leave the filter panel open, choose one category, and sort by most printed. Show the panel, the sort control and the first two rows of cards. Crop to the gallery area below the header." />

## Open a design

Click a card to open the design page, with 3D views, the dimensions and the posted prints. Every design has the CC BY 4.0 license.

| Button                                    | What it does                                                                            |
| ----------------------------------------- | --------------------------------------------------------------------------------------- |
| <Ui k="community.detail.remix" />         | Opens an editable copy of the design in the bin designer. The original does not change. |
| <Ui k="community.detail.placeInLayout" /> | Shows when you came from an empty area of a layout. It puts the design into that area.  |
| <Ui k="community.detail.share" />         | Copies a link to the design page.                                                       |
| The heart                                 | Likes the design. You must sign in to like a design.                                    |
| <Ui k="community.detail.report" />        | Reports a problem to the moderators. See [Report a design](#report-a-design).           |

## Publish a design

1. Open your design in the bin designer.
2. Click <Ui k="community.publishButton" /> in the header.
3. Fill in <Ui k="community.publish.form.nameLabel" />, <Ui k="community.publish.form.descriptionLabel" /> and <Ui k="community.publish.form.categoryLabel" />.
4. Check <Ui k="community.publish.identity.label" />. It shows on all your published designs.
5. Click <Ui k="community.publish.submit" />.

Without a sign-in, the button reads <Ui k="community.publish.submitSignedOut" />. Sign in with Google or GitHub, and the dialog comes back with your text. The Layout Tool makes the preview images from the design.

<Screenshot id="sharing-community-publish" alt="The publish dialog, with the design preview on the left and the name, description, category and public name fields on the right." spec="Bin designer, desktop, a 2 by 3 bin with dividers and a label tab, saved with a real name. Click Publish in the header. Fill in a name, a two-line description and a category, and leave the error state empty. Show the whole dialog." />

The server checks the text before it accepts the design:

| Field                                              | Rule                                                                      |
| -------------------------------------------------- | ------------------------------------------------------------------------- |
| <Ui k="community.publish.form.nameLabel" />        | At least 3 characters, and not the default name of a new design.          |
| <Ui k="community.publish.form.descriptionLabel" /> | At least 12 characters, with letters and at least 5 different characters. |
| All text                                           | The content filter refuses blocked words. Reword the text and try again.  |

The description rule is on by default. The person who runs the server can switch it off.

Other rules:

- The server refuses a design that is the same as a published design or a built-in example.
- A remix must be different from the design it copies. The published remix gives credit to the original.
- Each account can have 25 published designs at a time. Unpublish one to make space.

The server can switch publishing off. The dialog then shows <Ui k="community.publish.unavailable.title" />. Your design stays saved, and you can try again later.

::: warning
Publish only a design that you want to be public. <Ui k="community.publish.disclosure" />
:::

To update a published design, open its page, click <Ui k="community.detail.editOriginal" />, change the design, and publish again. To remove it, open the menu in the publish dialog and click <Ui k="community.publish.unpublish" />. Copies that people remixed stay.

## Post a print

A print report tells the next maker how a design printed for you.

1. Open the design page.
2. Click <Ui k="community.print.cta" />. Sign in if the page asks.
3. Under <Ui k="community.print.fitTitle" />, select <Ui k="community.print.fit.asDesigned" />, <Ui k="community.print.fit.adjusted" /> or <Ui k="community.print.fit.didNotFit" />.
4. Add a photo, a note, or both. The form needs at least one of them.
5. Fill in <Ui k="community.print.settingsTitle" /> if you want. All these fields are optional.
6. Click <Ui k="community.print.save" />.

You can post one print for each design. When you post again, your new report replaces the old one. The Layout Tool shrinks each photo before upload and removes its location data. The owner of a design can use a print photo as the card image.

The server can switch print reports off. The form then shows a message that print reports are not available.

## Report a design

1. On the design page, click <Ui k="community.detail.report" />.
2. Select a <Ui k="community.report.reasonLabel" />: <Ui k="community.report.reason.inappropriate" />, <Ui k="community.report.reason.spam" />, <Ui k="community.report.reason.broken" /> or <Ui k="community.report.reason.stolen" />.
3. Add a note for the moderator if you want.
4. Click <Ui k="community.report.submit" />.

You must sign in to report. When 5 different people report a design, the gallery hides it until a moderator reviews it. To report one print, use <Ui k="community.prints.report" /> on that print.

## Next steps

- [Find bins that fit](../layouts/find-bins-that-fit): see the community designs that fit an empty area of a drawer.
- [Save and reuse designs](../designer/save-and-reuse): keep a remixed design in your library.
- [Accounts and sync](./accounts-and-sync): sign in to publish, like and post prints.
- [Share a layout](./share-links): send a whole layout instead of one design.
