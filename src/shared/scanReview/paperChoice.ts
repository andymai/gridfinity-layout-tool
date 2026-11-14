import {
  detectReference,
  sheetSize,
  withReference,
  type ImageDataLike,
  type PaperSize,
  type SceneReference,
  type SceneTrace,
  type SceneTraceOptions,
} from '@/shared/scanTrace';

/** What the user says the sheet under the tools is: a size, or not paper at all. */
export type PaperChoice = PaperSize | 'off';

export function withPaperChoice(
  options: SceneTraceOptions,
  choice: PaperChoice | null
): SceneTraceOptions {
  return choice ? { ...options, paper: choice } : options;
}

/**
 * The choice to show as made: the user's own, else the size the photo's sheet
 * read as. Null when the photo has no sheet to ask about.
 */
export function shownPaperChoice(
  reference: SceneReference | null,
  choice: PaperChoice | null
): PaperChoice | null {
  if (choice) return choice;
  return reference?.kind === 'paper' ? sheetSize(reference.paper) : null;
}

/**
 * `scene` sized again after the user's word on the sheet changed. The
 * outlines stay as they are, so a tool the user removed stays removed.
 */
export function withPaperChosen(
  scene: SceneTrace,
  image: ImageDataLike,
  options: SceneTraceOptions
): SceneTrace {
  return withReference(scene, detectReference(image, options), options);
}
