import type { CreditsPlan } from './creditsPlan';
import {
  buildRollTimeline,
  messageDwell,
  type ReadingMark,
  type RollTimeline,
} from './rollTimeline';
import type { SupporterBin } from './supportersData';

export const INTRO_SECONDS = 7.5;

const NAME_STAGGER = 0.07;
const HEADING_DWELL = 1.4;
const GAG_DWELL = 1.8;
/** The camera leaves for a department this long before its heading is read. */
const CAMERA_LEAD = 1.4;
/** Where the last credit sits, as a fraction of the region, when the roll ends. */
const END_POSITION = 0.3;

export interface MeasuredCredit {
  id: string;
  /** Centre and height in px, measured from the top of the credits list. */
  center: number;
  height: number;
  /** Each name in a block, which can wrap onto several rows. */
  members?: { id: string; center: number }[];
}

export interface RollRegion {
  height: number;
  /** Distance from the region's top to the line credits are read at. */
  readingLine: number;
}

export interface RollSchedule {
  timeline: RollTimeline;
  /** When each bin lands in its socket. */
  seatTimes: Map<string, number>;
  /** When the camera should head for each department's zone, in roll order. */
  zoneCues: { zone: number; time: number }[];
  /** When each bin's credit crosses the reading line, for seeking to it. */
  creditTimes: Map<string, number>;
}

export function buildRollSchedule(
  plan: CreditsPlan,
  binsById: Map<string, SupporterBin>,
  measured: MeasuredCredit[],
  region: RollRegion,
  baseSpeed: number
): RollSchedule {
  const byId = new Map(measured.map((m) => [m.id, m]));
  const passOffset = (m: MeasuredCredit) => m.center - region.readingLine;

  const marks: ReadingMark[] = [];
  for (const item of plan.items) {
    const m = byId.get(item.id);
    if (!m) continue;
    let dwell = 0;
    if (item.kind === 'message') {
      const bin = binsById.get(item.binId);
      dwell = messageDwell((bin?.message?.length ?? 0) + (bin?.name?.length ?? 0));
    } else if (item.kind === 'department') {
      dwell = HEADING_DWELL;
    } else if (item.kind === 'gag' || item.kind === 'note') {
      dwell = GAG_DWELL;
    }
    if (dwell > 0) marks.push({ at: passOffset(m), height: m.height, dwell });
  }

  const first = measured.at(0);
  const last = measured.at(-1);
  const startOffset = first ? first.center - first.height / 2 - region.height : -region.height;
  const endOffset = last ? last.center - region.height * END_POSITION : startOffset;
  const timeline = buildRollTimeline({
    startOffset,
    endOffset,
    baseSpeed,
    marks,
    introSeconds: INTRO_SECONDS,
  });

  const seatTimes = new Map<string, number>();
  const creditTimes = new Map<string, number>();
  const zoneCues: { zone: number; time: number }[] = [];
  for (const item of plan.items) {
    const m = byId.get(item.id);
    if (!m) continue;
    const time = timeline.timeAt(passOffset(m));
    if (item.kind === 'department') {
      zoneCues.push({ zone: item.department, time: Math.max(INTRO_SECONDS, time - CAMERA_LEAD) });
    } else if (item.kind === 'names') {
      const centers = new Map((m.members ?? []).map((member) => [member.id, member.center]));
      const perRow = new Map<number, number>();
      item.binIds.forEach((id, i) => {
        const center = centers.get(id);
        if (center === undefined) {
          seatTimes.set(id, time + i * NAME_STAGGER);
          creditTimes.set(id, time);
          return;
        }
        // Names side by side in one row land one after another, not at once.
        const inRow = perRow.get(center) ?? 0;
        perRow.set(center, inRow + 1);
        const own = timeline.timeAt(center - region.readingLine);
        seatTimes.set(id, own + inRow * NAME_STAGGER);
        creditTimes.set(id, own);
      });
    } else if (item.kind === 'message') {
      seatTimes.set(item.binId, time);
      creditTimes.set(item.binId, time);
    }
  }

  return { timeline, seatTimes, zoneCues, creditTimes };
}

/** The department the camera should be on at `time`, or null before the first. */
export function zoneAt(schedule: RollSchedule, time: number): number | null {
  let zone: number | null = null;
  for (const cue of schedule.zoneCues) {
    if (cue.time > time) break;
    zone = cue.zone;
  }
  return zone;
}
