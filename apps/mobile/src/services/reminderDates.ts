export const NOTIFICATION_REMINDER_DAYS = [1, 2, 3, 4, 5, 6, 7] as const;
export type NotificationReminderDay =
  (typeof NOTIFICATION_REMINDER_DAYS)[number];
export const DEFAULT_NOTIFICATION_REMINDER_DAYS: readonly NotificationReminderDay[] =
  [1, 3, 7];

const SEOUL_DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

export type GroupBuyReminderScheduleOptions = {
  now?: number;
};

export type GroupBuyReminderOption = {
  reminderDay: NotificationReminderDay;
  triggerDate: Date;
  available: boolean;
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
  const selectedDays = new Set(reminderDays);
  return buildGroupBuyReminderOptions(endDate, options)
    .filter(
      ({ reminderDay, available }) =>
        available && selectedDays.has(reminderDay),
    )
    .map(({ reminderDay, triggerDate }) => ({ reminderDay, triggerDate }))
    .sort(
      (left, right) => left.triggerDate.getTime() - right.triggerDate.getTime(),
    );
}

export function buildGroupBuyReminderOptions(
  endDate: string,
  options?: number | GroupBuyReminderScheduleOptions,
): GroupBuyReminderOption[] {
  const now = resolveGroupBuyReminderScheduleOptions(options);
  const deadline = new Date(endDate);
  if (Number.isNaN(deadline.getTime())) return [];
  const deadlineDate = getSeoulCalendarDate(deadline);
  if (!deadlineDate) return [];
  return NOTIFICATION_REMINDER_DAYS.map((reminderDay) => {
    const triggerDate = new Date(
      Date.UTC(
        deadlineDate.year,
        deadlineDate.month - 1,
        deadlineDate.day - reminderDay,
      ),
    );
    return {
      reminderDay,
      // 09:00 Asia/Seoul is 00:00 UTC; Korea has no DST transitions.
      triggerDate,
      available: triggerDate.getTime() > now,
    };
  });
}
