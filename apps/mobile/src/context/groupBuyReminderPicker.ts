import {
  buildGroupBuyReminderOptions,
  NOTIFICATION_REMINDER_DAYS,
  type NotificationReminderDay,
} from "../services/reminderDates";

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
