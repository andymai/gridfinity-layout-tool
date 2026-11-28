import { cardCopy, summaryEntries } from '../components/YearCardView/cardCopy';
import { typeName } from '../components/YearCardView/typeCopy';
import { areaScene } from './areaScene';
import { binsScene } from './binsScene';
import { designsScene } from './designsScene';
import { drawerScene } from './drawerScene';
import { drawersScene } from './drawersScene';
import { exportsScene } from './exportsScene';
import { filamentScene } from './filamentScene';
import { introScene } from './introScene';
import { complicatedScene, longestScene } from './modelScenes';
import { monthScene } from './monthScene';
import type { Scene, SceneInput } from './scene';
import { sizeScene } from './sizeScene';
import { summaryScene } from './summaryScene';
import { thanksScene } from './thanksScene';
import { typeScene } from './typeScene';

/** The card's layout and its drawing, or null when its numbers are missing. */
export function buildScene(input: SceneInput): Scene | null {
  const { kind } = input.card;
  if (kind === 'summary') return summaryScene(input, summaryEntries(input));
  const copy = cardCopy(kind, { ...input, shown: (value) => value });
  if (!copy) return null;
  switch (kind) {
    case 'intro':
      return introScene(input, copy);
    case 'drawers':
      return drawersScene(input, copy);
    case 'bins':
      return binsScene(input, copy);
    case 'area':
      return areaScene(input, copy);
    case 'biggest':
      return drawerScene(input, copy);
    case 'size':
      return sizeScene(input, copy);
    case 'designs':
      return designsScene(input, copy);
    case 'month':
      return monthScene(input, copy);
    case 'filament':
      return filamentScene(input, copy);
    case 'longest':
      return longestScene(input, copy);
    case 'complicated':
      return complicatedScene(input, copy);
    case 'exports':
      return exportsScene(input, copy);
    case 'type':
      return typeScene(input, copy, typeName(input.t, input.stats.type.id));
    case 'thanks':
      return thanksScene(input, copy);
  }
}
