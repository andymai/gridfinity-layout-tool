/**
 * Short looping clips that show what a designer feature does, played in the
 * card behind the feature's play dot. Clips are rendered onto each theme's
 * card surface by `pnpm run capture:feature-tips`, which writes every file
 * imported here; `featureTips.test.ts` fails if one is missing.
 */

import cutEditorDark from './clips/cutEditor.dark.mp4';
import cutEditorDarkPoster from './clips/cutEditor.dark.webp';
import cutEditorLight from './clips/cutEditor.light.mp4';
import cutEditorLightPoster from './clips/cutEditor.light.webp';
import lidsDark from './clips/lids.dark.mp4';
import lidsDarkPoster from './clips/lids.dark.webp';
import lidsLight from './clips/lids.light.mp4';
import lidsLightPoster from './clips/lids.light.webp';
import scoopsDark from './clips/scoops.dark.mp4';
import scoopsDarkPoster from './clips/scoops.dark.webp';
import scoopsLight from './clips/scoops.light.mp4';
import scoopsLightPoster from './clips/scoops.light.webp';
import { LID_TIP_SEGMENT_SECONDS, LID_TIP_SEGMENTS } from './timing';

export type FeatureTipId = 'scoops' | 'lids' | 'cutEditor';

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
  scoops: {
    captionKey: 'binDesigner.featureTip.scoops',
    clips: {
      light: { video: scoopsLight, poster: scoopsLightPoster },
      dark: { video: scoopsDark, poster: scoopsDarkPoster },
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
  cutEditor: {
    captionKey: 'binDesigner.featureTip.cutEditor',
    clips: {
      light: { video: cutEditorLight, poster: cutEditorLightPoster },
      dark: { video: cutEditorDark, poster: cutEditorDarkPoster },
    },
  },
};
