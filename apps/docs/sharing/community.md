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

Need a bin for a tool that you own? Look in the community gallery first. It holds bin designs that other makers published from the Gridfinity Layout Tool. Print one as it is, or remix it into your own design. When you make a bin that works well, publish it so other people can print it too.

## Open the gallery

There are three ways in:

- In the bin designer, click <Ui k="binExamples.sidebarEntry" /> in the panel. The gallery opens on its <Ui k="binExamples.gallery.tabs.community" /> tab. The <Ui k="binExamples.gallery.tabs.examples" /> tab next to it holds the built-in examples.
- Open [the community page](https://gridfinitylayouttool.com/community) in your browser.
- In the layout editor, pick an empty area of the drawer to see the designs that fit it. See [Find bins that fit](../layouts/find-bins-that-fit).

You don't need an account to browse, open or remix a design.

## Find a design

Type in <Ui k="community.gallery.searchLabel" /> to search the design names and the public names of the makers. To narrow the results, use the <Ui k="community.gallery.filterPanelLabel" /> panel:

| Filter                                                                               | What it keeps                                                |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| <Ui k="community.gallery.showSection" /> > <Ui k="community.gallery.likedFilter" />  | Designs that you liked                                       |
| <Ui k="community.gallery.showSection" /> > <Ui k="community.gallery.mineFilter" />   | Your own designs                                             |
| <Ui k="community.gallery.showSection" /> > <Ui k="community.gallery.recentFilter" /> | Designs that you opened recently                             |
| <Ui k="community.gallery.categoryLabel" />                                           | One category of designs                                      |
| <Ui k="community.gallery.sizeLabel" />                                               | A range of width, depth and height                           |
| <Ui k="community.gallery.techniqueLabel" />                                          | Designs that use one feature, such as a scoop or a label tab |

To change the order, pick an option in <Ui k="community.gallery.sortLabel" />:

| Sort                                      | Shows first                             |
| ----------------------------------------- | --------------------------------------- |
| <Ui k="community.gallery.sort.newest" />  | The most recent designs                 |
| <Ui k="community.gallery.sort.likes" />   | The designs with the most likes         |
| <Ui k="community.gallery.sort.remixes" /> | The designs with the most remixes       |
| <Ui k="community.gallery.sort.prints" />  | The designs with the most posted prints |

The print count on a card shows how many people printed the design and posted the result. The address of the community page keeps your search and filters, so you can send a filtered gallery to someone else.

<Screenshot id="sharing-community-gallery" alt="The community gallery with the filter panel open on the left and a grid of design cards on the right." spec="Open gridfinitylayouttool.com/community on desktop at 1440 px wide. Leave the filter panel open, choose one category, and sort by most printed. Show the panel, the sort control and the first two rows of cards. Crop to the gallery area below the header." />

## Open a design

Click a card to open its design page, with 3D views, the dimensions and the posted prints. Every design has the CC BY 4.0 license.

| Button                                    | What it does                                                                           |
| ----------------------------------------- | -------------------------------------------------------------------------------------- |
| <Ui k="community.detail.remix" />         | Opens an editable copy of the design in the bin designer. The original doesn't change. |
| <Ui k="community.detail.placeInLayout" /> | Shows when you came from an empty area of a layout. It puts the design into that area. |
| <Ui k="community.detail.share" />         | Copies a link to the design page.                                                      |
| The heart                                 | Likes the design. You must sign in to like a design.                                   |
| <Ui k="community.detail.report" />        | Tells the moderators about a problem. See [Report a design](#report-a-design).         |

## Publish a design

Did a bin turn out well? Publish it, and the next maker with the same tool can print it.

1. Open your design in the bin designer, and click <Ui k="community.publishButton" /> in the header.
2. Type a <Ui k="community.publish.form.nameLabel" /> and a <Ui k="community.publish.form.descriptionLabel" />. The server checks both (see the table below).
3. Pick a <Ui k="community.publish.form.categoryLabel" />.
4. Check <Ui k="community.publish.identity.label" />. It shows on all your published designs.
5. Click <Ui k="community.publish.submit" />.

Not signed in? The button then reads <Ui k="community.publish.submitSignedOut" />. Sign in with Google or GitHub, and the dialog comes back with your text in place. The Layout Tool makes the preview images from the design for you.

<Screenshot id="sharing-community-publish" alt="The publish dialog, with the design preview on the left and the name, description, category and public name fields on the right." spec="Bin designer, desktop, a 2 by 3 bin with dividers and a label tab, saved with a real name. Click Publish in the header. Fill in a name, a two-line description and a category, and leave the error state empty. Show the whole dialog." />

The server checks the text before it accepts the design:

| Field                                              | Rule                                                                      |
| -------------------------------------------------- | ------------------------------------------------------------------------- |
| <Ui k="community.publish.form.nameLabel" />        | At least 3 characters, and not the default name of a new design.          |
| <Ui k="community.publish.form.descriptionLabel" /> | At least 12 characters, with letters and at least 5 different characters. |
| All text                                           | The content filter refuses blocked words. Reword the text and try again.  |

The description rule is on by default. The person who runs the server can switch it off.

A few more rules:

- The server refuses a design that is the same as a published design or a built-in example.
- A remix must be different from the design that it copies. The published remix gives credit to the original.
- Each account can have 25 published designs at a time. Unpublish one to make space.

The server can switch publishing off. The dialog then shows <Ui k="community.publish.unavailable.title" />. Your design stays saved, so you can try again later.

::: warning
Publish only a design that you want to be public. <Ui k="community.publish.disclosure" />
:::

To update a published design, open its page, click <Ui k="community.detail.editOriginal" />, change the design, and publish again. To take it down, open the menu in the publish dialog and click <Ui k="community.publish.unpublish" />. Remixes that people made from it stay.

## Post a print

A print report tells the next maker how a design printed for you. It's a real help to anyone who is about to print the same bin.

1. Open the design page and click <Ui k="community.print.cta" />. Sign in if the page asks.
2. Under <Ui k="community.print.fitTitle" />, pick one answer:
   - <Ui k="community.print.fit.asDesigned" />
   - <Ui k="community.print.fit.adjusted" />
   - <Ui k="community.print.fit.didNotFit" />
3. Add a photo, a note, or both. The form needs at least one of them.
4. Fill in <Ui k="community.print.settingsTitle" /> if you like. All these fields are optional.
5. Click <Ui k="community.print.save" />.

You can post one print for each design, and a new post replaces your old one. After a few people report their prints, the design shows their print times in place of the estimate. See [Filament and time estimates](../printing/estimates#how-far-to-trust-the-estimates).

The Layout Tool shrinks each photo before upload and removes its location data. The owner of a design can use a print photo as the card image.

The server can switch print reports off. The form then tells you that print reports are not available.

## Report a design

1. On the design page, click <Ui k="community.detail.report" />.
2. Pick a <Ui k="community.report.reasonLabel" />:
   - <Ui k="community.report.reason.inappropriate" />
   - <Ui k="community.report.reason.spam" />
   - <Ui k="community.report.reason.broken" />
   - <Ui k="community.report.reason.stolen" />
3. Add a note for the moderator if you like.
4. Click <Ui k="community.report.submit" />.

You must sign in to report. When 5 different people report a design, the gallery hides it until a moderator reviews it. To report a single print, use <Ui k="community.prints.report" /> on that print.

## Next steps

- [Find bins that fit](../layouts/find-bins-that-fit): see the community designs that fit an empty area of a drawer.
- [Save and reuse designs](../designer/save-and-reuse): keep a remixed design in your library.
- [Accounts and sync](./accounts-and-sync): sign in to publish, like and post prints.
- [Share a layout](./share-links): send a whole layout instead of one design.
