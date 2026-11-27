import { toTime } from '@/shared/yearReview/yearWork';

export function monthOf(value: number | string): number {
  return new Date(toTime(value)).getMonth();
}

export function dayKey(value: number | string): string {
  const date = new Date(toTime(value));
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}
