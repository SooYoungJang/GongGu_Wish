import type { GroupBuy } from '../types';

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDateKey(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

export function getGroupBuyDateRange(item: GroupBuy): { start: Date | null; end: Date | null } {
  const start = parseDate(item.startDate);
  const end = parseDate(item.endDate);

  return {
    start: start ? startOfDay(start) : null,
    end: end ? endOfDay(end) : null,
  };
}

export function isGroupBuyActiveOnDate(item: GroupBuy, date: Date): boolean {
  const { start, end } = getGroupBuyDateRange(item);
  if (!start && !end) return false;

  const targetStart = startOfDay(date);
  const targetEnd = endOfDay(date);
  const startsBeforeDateEnds = !start || start <= targetEnd;
  const endsAfterDateStarts = !end || end >= targetStart;

  return startsBeforeDateEnds && endsAfterDateStarts;
}

export function doesGroupBuyOverlapRange(item: GroupBuy, rangeStart: Date, rangeEnd: Date): boolean {
  const { start, end } = getGroupBuyDateRange(item);
  if (!start && !end) return false;

  const normalizedStart = startOfDay(rangeStart);
  const normalizedEnd = endOfDay(rangeEnd);
  const startsBeforeRangeEnds = !start || start <= normalizedEnd;
  const endsAfterRangeStarts = !end || end >= normalizedStart;

  return startsBeforeRangeEnds && endsAfterRangeStarts;
}
