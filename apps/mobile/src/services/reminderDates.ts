export const NOTIFICATION_REMINDER_DAYS = [1, 3, 7] as const;
export type NotificationReminderDay =
  (typeof NOTIFICATION_REMINDER_DAYS)[number];

const SEOUL_DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

export type GroupBuyReminderScheduleOptions = {
  now?: number;
};

function resolveGroupBuyReminderScheduleOptions(
  value: number | GroupBuyReminderScheduleOptions | undefined,
) {
  return typeof value === "number" ? value : (value?.now ?? Date.now());
}

function getSeoulCalendarDate(value: Date) {
  const parts = SEOUL_DATE_FORMAT.formatToParts(value);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  const year = Number(values.get("year"));
  const month = Number(values.get("month"));
  const day = Number(values.get("day"));
  return Number.isInteger(year) &&
    Number.isInteger(month) &&
    Number.isInteger(day)
    ? { year, month, day }
    : null;
}

export function buildGroupBuyReminderDates(
  endDate: string,
  reminderDays: readonly number[],
  options?: number | GroupBuyReminderScheduleOptions,
) {
  const now = resolveGroupBuyReminderScheduleOptions(options);
  const deadline = new Date(endDate);
  if (Number.isNaN(deadline.getTime())) return [];
  const deadlineDate = getSeoulCalendarDate(deadline);
  if (!deadlineDate) return [];
  const allowed = new Set<number>(NOTIFICATION_REMINDER_DAYS);
  return [...new Set(reminderDays)]
    .filter((day): day is NotificationReminderDay => allowed.has(day))
    .map((reminderDay) => ({
      reminderDay,
      // 09:00 Asia/Seoul is 00:00 UTC; Korea has no DST transitions.
      triggerDate: new Date(
        Date.UTC(
          deadlineDate.year,
          deadlineDate.month - 1,
          deadlineDate.day - reminderDay,
        ),
      ),
    }))
    .filter(({ triggerDate }) => triggerDate.getTime() > now)
    .sort(
      (left, right) => left.triggerDate.getTime() - right.triggerDate.getTime(),
    );
}
