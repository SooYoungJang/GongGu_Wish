import {
  buildGroupBuyOpeningReminderOptions,
  buildGroupBuyReminderOptions,
  NOTIFICATION_REMINDER_DAYS,
  OPENING_REMINDER_DAYS,
  type NotificationReminderDay,
  type OpeningReminderDay,
} from "../services/reminderDates";

export type GroupBuyReminderPickerMode = "opening" | "deadline";

export function getReminderPickerMode(
  startDate: string | null,
  now = Date.now(),
): GroupBuyReminderPickerMode {
  if (!startDate) return "deadline";
  const parsedStartDate = new Date(startDate).getTime();
  return Number.isNaN(parsedStartDate) || parsedStartDate <= now
    ? "deadline"
    : "opening";
}

export function getReminderDayOptions(
  endDate: string | null,
  now = Date.now(),
) {
  return endDate ? buildGroupBuyReminderOptions(endDate, now) : [];
}

export function getAvailableReminderDays(
  endDate: string | null,
  now = Date.now(),
): NotificationReminderDay[] {
  return getReminderDayOptions(endDate, now)
    .filter(({ available }) => available)
    .map(({ reminderDay }) => reminderDay);
}

export function getInitialReminderDays(
  endDate: string | null,
  currentDays: readonly NotificationReminderDay[],
  now = Date.now(),
) {
  const available = new Set(getAvailableReminderDays(endDate, now));
  return NOTIFICATION_REMINDER_DAYS.filter(
    (day) => available.has(day) && currentDays.includes(day),
  );
}

export function getOpeningReminderDayOptions(
  startDate: string | null,
  reminderTimeMinutes: number,
  now = Date.now(),
) {
  return startDate
    ? buildGroupBuyOpeningReminderOptions(startDate, reminderTimeMinutes, now)
    : [];
}

export function getAvailableOpeningReminderDays(
  startDate: string | null,
  reminderTimeMinutes: number,
  now = Date.now(),
): OpeningReminderDay[] {
  return getOpeningReminderDayOptions(startDate, reminderTimeMinutes, now)
    .filter(({ available }) => available)
    .map(({ reminderDay }) => reminderDay);
}

export function getInitialOpeningReminderDays(
  startDate: string | null,
  currentDays: readonly OpeningReminderDay[],
  reminderTimeMinutes: number,
  now = Date.now(),
) {
  const available = new Set(
    getAvailableOpeningReminderDays(startDate, reminderTimeMinutes, now),
  );
  return OPENING_REMINDER_DAYS.filter(
    (day) => available.has(day) && currentDays.includes(day),
  );
}
