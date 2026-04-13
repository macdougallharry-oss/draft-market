/**
 * DraftMarket fantasy week: Monday 00:00 UTC → Sunday 23:59 UTC.
 * Pick window: Monday 00:00 UTC through Tuesday 23:59:59.999 UTC.
 */

/** Monday 00:00:00.000 UTC of the calendar week that contains `date` (UTC). */
export function getMondayUTCOfDate(date: Date = new Date()): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const dom = date.getUTCDate();
  const dow = date.getUTCDay();
  const daysFromMonday = (dow + 6) % 7;
  return new Date(Date.UTC(y, m, dom - daysFromMonday, 0, 0, 0, 0));
}

function endOfTuesdayUTC(monday: Date): Date {
  const t = new Date(monday);
  t.setUTCDate(monday.getUTCDate() + 1);
  t.setUTCHours(23, 59, 59, 999);
  return t;
}

function endOfSundayUTC(monday: Date): Date {
  const t = new Date(monday);
  t.setUTCDate(monday.getUTCDate() + 6);
  t.setUTCHours(23, 59, 59, 999);
  return t;
}

/**
 * ISO 8601 week number and the calendar year of that week’s Thursday (UTC).
 * Matches standard “week 1 contains the first Thursday of the year”.
 */
export function getISOWeekKey(date: Date = new Date()): {
  weekNumber: number;
  year: number;
} {
  const target = new Date(date.getTime());
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = target.getTime();
  target.setUTCFullYear(target.getUTCFullYear(), 0, 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCDate(1 + ((4 - target.getUTCDay() + 7) % 7));
  }
  const weekNumber =
    1 + Math.ceil((firstThursday - target.getTime()) / 604800000);
  return { weekNumber, year: target.getUTCFullYear() };
}

/** True during Monday 00:00 UTC through Tuesday 23:59:59.999 UTC. */
export function isPickWindowOpen(now: Date = new Date()): boolean {
  const monday = getMondayUTCOfDate(now);
  const start = monday.getTime();
  const end = endOfTuesdayUTC(monday).getTime();
  const t = now.getTime();
  return t >= start && t <= end;
}

/**
 * End of the current pick window if still in the future; otherwise the end of
 * next week’s pick window (Tuesday 23:59:59.999 UTC).
 */
export function getPickDeadline(now: Date = new Date()): Date {
  const monday = getMondayUTCOfDate(now);
  const tueEnd = endOfTuesdayUTC(monday);
  if (now.getTime() <= tueEnd.getTime()) return tueEnd;
  const nextMon = new Date(monday);
  nextMon.setUTCDate(monday.getUTCDate() + 7);
  return endOfTuesdayUTC(nextMon);
}

/**
 * End of the current Mon–Sun week (Sunday 23:59:59.999 UTC), or next week’s
 * if that moment has already passed.
 */
export function getWeekEndDate(now: Date = new Date()): Date {
  const monday = getMondayUTCOfDate(now);
  const sunEnd = endOfSundayUTC(monday);
  if (now.getTime() <= sunEnd.getTime()) return sunEnd;
  const nextMon = new Date(monday);
  nextMon.setUTCDate(monday.getUTCDate() + 7);
  return endOfSundayUTC(nextMon);
}

/** Next Monday 00:00:00.000 UTC when the pick window opens again. */
export function getNextPickWindowOpenUTC(now: Date = new Date()): Date {
  const mondayThisWeek = getMondayUTCOfDate(now);
  const next = new Date(mondayThisWeek);
  next.setUTCDate(mondayThisWeek.getUTCDate() + 7);
  next.setUTCHours(0, 0, 0, 0);
  return next;
}

/** Split remaining time into parts (floored); all zero if `ms` ≤ 0. */
export function formatDurationParts(ms: number): {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
} {
  const x = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(x / 86400),
    hours: Math.floor((x % 86400) / 3600),
    minutes: Math.floor((x % 3600) / 60),
    seconds: x % 60,
  };
}

/** UI label for the weekly cash pool. */
export function weeklyPrizeGbpLabel(): string {
  return "£10";
}
