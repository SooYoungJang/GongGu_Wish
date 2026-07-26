import {
  buildGroupBuyReminderDates,
  NOTIFICATION_REMINDER_DAYS,
  type NotificationReminderDay,
} from "../services/reminderDates";

export function getAvailableReminderDays(
  endDate: string | null,
  now = Date.now(),
): NotificationReminderDay[] {
  if (!endDate) return [];
  return NOTIFICATION_REMINDER_DAYS.filter(
    (day) => buildGroupBuyReminderDates(endDate, [day], now).length > 0,
  );
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
