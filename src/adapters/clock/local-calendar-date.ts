export function toLocalCalendarDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function toLocalCalendarMonth(date: Date): string {
  return toLocalCalendarDate(date).slice(0, 7);
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
