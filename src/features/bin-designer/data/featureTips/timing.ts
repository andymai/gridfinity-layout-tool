import type { LidAttachment } from '../../types/lid';

/** The lid types the Lids clip cycles through, in order. */
export const LID_TIP_SEGMENTS: readonly LidAttachment[] = ['friction', 'slide', 'hinge'];

/** Seconds each lid type holds the clip; the card's chips change on the same marks. */
export const LID_TIP_SEGMENT_SECONDS = 2;
