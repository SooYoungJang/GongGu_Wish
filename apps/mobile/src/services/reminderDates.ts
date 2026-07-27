export const NOTIFICATION_REMINDER_DAYS = [1, 2, 3, 4, 5, 6, 7] as const;
export type NotificationReminderDay =
  (typeof NOTIFICATION_REMINDER_DAYS)[number];
export const OPENING_REMINDER_DAYS = [0, 1, 2, 3, 4, 5, 6, 7] as const;
export type OpeningReminderDay = (typeof OPENING_REMINDER_DAYS)[number];
export const DEFAULT_NOTIFICATION_REMINDER_DAYS: readonly NotificationReminderDay[] =
  [1, 3, 7];
export const DEFAULT_OPENING_REMINDER_TIME_MINUTES = 9 * 60;

const SEOUL_UTC_OFFSET_MINUTES = 9 * 60;
const DEADLINE_REMINDER_TIME_MINUTES = 9 * 60;

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

export type GroupBuyOpeningReminderOption = {
  reminderDay: OpeningReminderDay;
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

function isValidReminderTimeMinutes(value: number) {
  return Number.isInteger(value) && value >= 0 && value < 24 * 60;
}

function buildTriggerDate(
  eventDate: { year: number; month: number; day: number },
  reminderDay: number,
  reminderTimeMinutes: number,
) {
  return new Date(
    Date.UTC(
      eventDate.year,
      eventDate.month - 1,
      eventDate.day - reminderDay,
      0,
      reminderTimeMinutes - SEOUL_UTC_OFFSET_MINUTES,
    ),
  );
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
    const triggerDate = buildTriggerDate(
      deadlineDate,
      reminderDay,
      DEADLINE_REMINDER_TIME_MINUTES,
    );
    return {
      reminderDay,
      triggerDate,
      available: triggerDate.getTime() > now,
    };
  });
}

export function buildGroupBuyOpeningReminderDates(
  startDate: string,
  reminderDays: readonly number[],
  reminderTimeMinutes: number,
  options?: number | GroupBuyReminderScheduleOptions,
) {
  const selectedDays = new Set(reminderDays);
  return buildGroupBuyOpeningReminderOptions(
    startDate,
    reminderTimeMinutes,
    options,
  )
    .filter(
      ({ reminderDay, available }) =>
        available && selectedDays.has(reminderDay),
    )
    .map(({ reminderDay, triggerDate }) => ({ reminderDay, triggerDate }))
    .sort(
      (left, right) => left.triggerDate.getTime() - right.triggerDate.getTime(),
    );
}

export function buildGroupBuyOpeningReminderOptions(
  startDate: string,
  reminderTimeMinutes: number,
  options?: number | GroupBuyReminderScheduleOptions,
): GroupBuyOpeningReminderOption[] {
  if (!isValidReminderTimeMinutes(reminderTimeMinutes)) return [];
  const now = resolveGroupBuyReminderScheduleOptions(options);
  const opening = new Date(startDate);
  if (Number.isNaN(opening.getTime())) return [];
  const openingDate = getSeoulCalendarDate(opening);
  if (!openingDate) return [];
  return OPENING_REMINDER_DAYS.map((reminderDay) => {
    const triggerDate = buildTriggerDate(
      openingDate,
      reminderDay,
      reminderTimeMinutes,
    );
    return {
      reminderDay,
      triggerDate,
      available: triggerDate.getTime() > now,
    };
  });
}
