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

<Screenshot id="sharing-community-open-gallery" alt="In the bin designer panel, the pointer clicks Community designs. The gallery opens on its Community tab, with a grid of design cards." spec="Clip. Bin designer, desktop, with the community API routed to made-up designs. A close-up of the Community designs entry in the panel, then a cut to the gallery dialog on its Community tab." />

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

<Screenshot id="sharing-community-design-page" alt="The design page of a community design: the 3D view on the left, and on the right the maker, the Remix button, the counts, the Like this design button, the description, the dimensions and the print estimates. Link to this design and Report are at the bottom." spec="Community design page, desktop, with the community API routed to a made-up design built on a built-in example. Show the whole dialog." />

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

A **print report** tells the next maker how a design printed for you. It's a real help to anyone who is about to print the same bin.

1. Open the design page and click <Ui k="community.print.cta" />. Sign in if the page asks.
2. Under <Ui k="community.print.fitTitle" />, pick one answer:
   - <Ui k="community.print.fit.asDesigned" />
   - <Ui k="community.print.fit.adjusted" />
   - <Ui k="community.print.fit.didNotFit" />
3. Add a photo, a note, or both. The form needs at least one of them.
4. Fill in <Ui k="community.print.settingsTitle" /> if you like. All these fields are optional.
5. Click <Ui k="community.print.save" />.

<Screenshot id="sharing-community-post-print" alt="The Add your print form with Fit as designed picked, a note about the print, PETG as the material, and the Post print button. More optional settings are lower in the form." spec="Community design page, desktop, signed in through routed made-up account data. Click I printed this, pick Fit as designed, type a note, and fill in some settings. Show the whole dialog, scrolled to the top." />

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

<Screenshot id="sharing-community-report" alt="The Report this design dialog with four reasons, Doesn't generate correctly picked, a note for the moderator, and the Submit report button." spec="Community design page, desktop, signed in through routed made-up account data. Click Report, pick a reason and type a short note. Crop to the dialog." />

You must sign in to report. When 5 different people report a design, the gallery hides it until a moderator reviews it. To report a single print, use <Ui k="community.prints.report" /> on that print.

## When it goes wrong

### Publish won't accept the name or the description

Give the design a name that says what it is, not the default name of a new design. In the description, say what the bin holds or what it's for. If the content filter flags a word, reword the text.

The dialog and the server check the text against the rules in [Publish a design](#publish-a-design). A name with no letters, or with one character over and over, fails even when it's long enough.

<Screenshot id="sharing-community-publish-checks" alt="The publish dialog with the one-word description Bits. A note next to the Publish button says that the description is too short." spec="Bin designer, desktop, a named 2 by 3 bin, signed in through routed made-up account data. Click Publish, fill in the name, a one-word description, a category and a public name. Show the whole dialog." />

### The server says that the design is already in the gallery

Change the design before you publish it. For a remix, change something in the copy first.

The server refuses a design that matches a published design or a built-in example. Is the original of your remix gone? Then the dialog offers <Ui k="community.publish.error.publishWithoutRemix" />.

### You reach the limit of published designs

Open one of your published designs. In the menu of the publish dialog, click <Ui k="community.publish.unpublish" />. Then publish the new one.

Each account can have 25 published designs at a time.

### A photo won't attach to your print

Use an image file under 25 MB. If the message says that the image is too detailed, crop it, and add it again.

The Layout Tool shrinks each photo before upload. A very large or very detailed photo can't shrink far enough.

## Next steps

- [Find bins that fit](../layouts/find-bins-that-fit): see the community designs that fit an empty area of a drawer.
- [Save and reuse designs](../designer/save-and-reuse): keep a remixed design in your library.
- [Accounts and sync](./accounts-and-sync): sign in to publish, like and post prints.
- [Share a layout](./share-links): send a whole layout instead of one design.
