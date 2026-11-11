import type { Shot } from '../session';
import { BASEPLATES_PRINTING } from './baseplatesPrinting';
import { CONCEPTS } from './concepts';
import { CUTOUTS } from './cutouts';
import { DESIGNER_BODY } from './designerBody';
import { DESIGNER_DETAILS } from './designerDetails';
import { GETTING_STARTED } from './gettingStarted';
import { HOME } from './home';
import { LAYOUTS } from './layouts';
import { SHARING_SETTINGS } from './sharingSettings';

export const SHOTS: readonly Shot[] = [
  ...HOME,
  ...GETTING_STARTED,
  ...CONCEPTS,
  ...LAYOUTS,
  ...DESIGNER_BODY,
  ...DESIGNER_DETAILS,
  ...CUTOUTS,
  ...BASEPLATES_PRINTING,
  ...SHARING_SETTINGS,
];
