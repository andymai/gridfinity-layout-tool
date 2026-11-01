/**
 * Short looping clips that show what a designer feature does, played in the
 * card behind the feature's play dot. Clips are rendered onto each theme's
 * card surface by `pnpm run capture:feature-tips`, which writes every file
 * imported here; `featureTips.test.ts` fails if one is missing.
 */

import compartmentsDark from './clips/compartments.dark.mp4';
import compartmentsDarkPoster from './clips/compartments.dark.webp';
import compartmentsLight from './clips/compartments.light.mp4';
import compartmentsLightPoster from './clips/compartments.light.webp';
import customShapeDark from './clips/customShape.dark.mp4';
import customShapeDarkPoster from './clips/customShape.dark.webp';
import customShapeLight from './clips/customShape.light.mp4';
import customShapeLightPoster from './clips/customShape.light.webp';
import cutEditorDark from './clips/cutEditor.dark.mp4';
import cutEditorDarkPoster from './clips/cutEditor.dark.webp';
import cutEditorLight from './clips/cutEditor.light.mp4';
import cutEditorLightPoster from './clips/cutEditor.light.webp';
import handlesDark from './clips/handles.dark.mp4';
import handlesDarkPoster from './clips/handles.dark.webp';
import handlesLight from './clips/handles.light.mp4';
import handlesLightPoster from './clips/handles.light.webp';
import labelTabsDark from './clips/labelTabs.dark.mp4';
import labelTabsDarkPoster from './clips/labelTabs.dark.webp';
import labelTabsLight from './clips/labelTabs.light.mp4';
import labelTabsLightPoster from './clips/labelTabs.light.webp';
import lidsDark from './clips/lids.dark.mp4';
import lidsDarkPoster from './clips/lids.dark.webp';
import lidsLight from './clips/lids.light.mp4';
import lidsLightPoster from './clips/lids.light.webp';
import overhangDark from './clips/overhang.dark.mp4';
import overhangDarkPoster from './clips/overhang.dark.webp';
import overhangLight from './clips/overhang.light.mp4';
import overhangLightPoster from './clips/overhang.light.webp';
import pullTabDark from './clips/pullTab.dark.mp4';
import pullTabDarkPoster from './clips/pullTab.dark.webp';
import pullTabLight from './clips/pullTab.light.mp4';
import pullTabLightPoster from './clips/pullTab.light.webp';
import scanToPocketDark from './clips/scanToPocket.dark.mp4';
import scanToPocketDarkPoster from './clips/scanToPocket.dark.webp';
import scanToPocketLight from './clips/scanToPocket.light.mp4';
import scanToPocketLightPoster from './clips/scanToPocket.light.webp';
import scoopsDark from './clips/scoops.dark.mp4';
import scoopsDarkPoster from './clips/scoops.dark.webp';
import scoopsLight from './clips/scoops.light.mp4';
import scoopsLightPoster from './clips/scoops.light.webp';
import slantDark from './clips/slant.dark.mp4';
import slantDarkPoster from './clips/slant.dark.webp';
import slantLight from './clips/slant.light.mp4';
import slantLightPoster from './clips/slant.light.webp';
import wallCutoutsDark from './clips/wallCutouts.dark.mp4';
import wallCutoutsDarkPoster from './clips/wallCutouts.dark.webp';
import wallCutoutsLight from './clips/wallCutouts.light.mp4';
import wallCutoutsLightPoster from './clips/wallCutouts.light.webp';
import { LID_TIP_SEGMENT_SECONDS, LID_TIP_SEGMENTS } from './timing';

export type FeatureTipId =
  | 'customShape'
  | 'compartments'
  | 'scanToPocket'
  | 'cutEditor'
  | 'scoops'
  | 'labelTabs'
  | 'handles'
  | 'wallCutouts'
  | 'pullTab'
  | 'overhang'
  | 'slant'
  | 'lids';

export interface FeatureTipClip {
  readonly video: string;
  readonly poster: string;
}

/** A label under the clip that lights up while its part of the clip plays. */
export interface FeatureTipChip {
  readonly labelKey: string;
  readonly fromSeconds: number;
}

export interface FeatureTip {
  readonly captionKey: string;
  readonly clips: Readonly<Record<'light' | 'dark', FeatureTipClip>>;
  readonly chips?: readonly FeatureTipChip[];
}

export const FEATURE_TIPS: Readonly<Record<FeatureTipId, FeatureTip>> = {
  customShape: {
    captionKey: 'binDesigner.featureTip.customShape',
    clips: {
      light: { video: customShapeLight, poster: customShapeLightPoster },
      dark: { video: customShapeDark, poster: customShapeDarkPoster },
    },
  },
  compartments: {
    captionKey: 'binDesigner.featureTip.compartments',
    clips: {
      light: { video: compartmentsLight, poster: compartmentsLightPoster },
      dark: { video: compartmentsDark, poster: compartmentsDarkPoster },
    },
  },
  scanToPocket: {
    captionKey: 'binDesigner.featureTip.scanToPocket',
    clips: {
      light: { video: scanToPocketLight, poster: scanToPocketLightPoster },
      dark: { video: scanToPocketDark, poster: scanToPocketDarkPoster },
    },
  },
  cutEditor: {
    captionKey: 'binDesigner.featureTip.cutEditor',
    clips: {
      light: { video: cutEditorLight, poster: cutEditorLightPoster },
      dark: { video: cutEditorDark, poster: cutEditorDarkPoster },
    },
  },
  scoops: {
    captionKey: 'binDesigner.featureTip.scoops',
    clips: {
      light: { video: scoopsLight, poster: scoopsLightPoster },
      dark: { video: scoopsDark, poster: scoopsDarkPoster },
    },
  },
  labelTabs: {
    captionKey: 'binDesigner.featureTip.labelTabs',
    clips: {
      light: { video: labelTabsLight, poster: labelTabsLightPoster },
      dark: { video: labelTabsDark, poster: labelTabsDarkPoster },
    },
  },
  handles: {
    captionKey: 'binDesigner.featureTip.handles',
    clips: {
      light: { video: handlesLight, poster: handlesLightPoster },
      dark: { video: handlesDark, poster: handlesDarkPoster },
    },
  },
  wallCutouts: {
    captionKey: 'binDesigner.featureTip.wallCutouts',
    clips: {
      light: { video: wallCutoutsLight, poster: wallCutoutsLightPoster },
      dark: { video: wallCutoutsDark, poster: wallCutoutsDarkPoster },
    },
  },
  pullTab: {
    captionKey: 'binDesigner.featureTip.pullTab',
    clips: {
      light: { video: pullTabLight, poster: pullTabLightPoster },
      dark: { video: pullTabDark, poster: pullTabDarkPoster },
    },
  },
  overhang: {
    captionKey: 'binDesigner.featureTip.overhang',
    clips: {
      light: { video: overhangLight, poster: overhangLightPoster },
      dark: { video: overhangDark, poster: overhangDarkPoster },
    },
  },
  slant: {
    captionKey: 'binDesigner.featureTip.slant',
    clips: {
      light: { video: slantLight, poster: slantLightPoster },
      dark: { video: slantDark, poster: slantDarkPoster },
    },
  },
  lids: {
    captionKey: 'binDesigner.featureTip.lids',
    clips: {
      light: { video: lidsLight, poster: lidsLightPoster },
      dark: { video: lidsDark, poster: lidsDarkPoster },
    },
    chips: LID_TIP_SEGMENTS.map((attachment, i) => ({
      labelKey: `binDesigner.lid.attachment.${attachment}`,
      fromSeconds: i * LID_TIP_SEGMENT_SECONDS,
    })),
  },
};
