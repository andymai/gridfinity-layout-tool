import { describe, expect, it } from 'vitest';
import { isYearReviewOpen, nextYearReviewChange } from './window';

const at = (year: number, month: number, day: number, hour: number, minute = 0): number =>
  new Date(year, month, day, hour, minute).getTime();

describe('isYearReviewOpen', () => {
  it('opens at local midnight on 1 December', () => {
    expect(isYearReviewOpen(at(2026, 10, 30, 23, 59))).toBe(false);
    expect(isYearReviewOpen(at(2026, 11, 1, 0))).toBe(true);
  });

  it('stays open through 15 January and closes after it', () => {
    expect(isYearReviewOpen(at(2027, 0, 15, 23, 59))).toBe(true);
    expect(isYearReviewOpen(at(2027, 0, 16, 0))).toBe(false);
  });

  it('names the next moment the window opens or closes', () => {
    expect(nextYearReviewChange(new Date(2026, 10, 27).getTime())).toBe(
      new Date(2026, 11, 1).getTime()
    );
    expect(nextYearReviewChange(new Date(2026, 11, 5).getTime())).toBe(
      new Date(2027, 0, 16).getTime()
    );
    expect(nextYearReviewChange(new Date(2027, 0, 16).getTime())).toBeNull();
  });
});
