/**
 * ISO 8601 week number and the calendar year that contains that week's Thursday
 * (standard “week 1 = week with first Thursday” definition).
 */
export function getISOWeekKey(date: Date = new Date()): {
  weekNumber: number;
  year: number;
} {
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  const weekNumber =
    1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  return { weekNumber, year: target.getFullYear() };
}
