import type {
  GroupBuyOpeningReminderDay,
  GroupBuyReminderUpdate,
} from "../api";
import type { GroupBuy } from "../types";
import {
  DEFAULT_NOTIFICATION_REMINDER_DAYS,
  NOTIFICATION_REMINDER_DAYS,
  type NotificationReminderDay,
} from "./notificationPreferences";
import {
  buildGroupBuyOpeningReminderOptions,
  buildGroupBuyReminderOptions,
  DEFAULT_OPENING_REMINDER_TIME_MINUTES,
  OPENING_REMINDER_DAYS,
} from "./reminderDates";

export function normalizeReminderDays(
  value: unknown,
  fallback: readonly NotificationReminderDay[] = DEFAULT_NOTIFICATION_REMINDER_DAYS,
) {
  const allowed = new Set<number>(NOTIFICATION_REMINDER_DAYS);
  const source = Array.isArray(value) ? value : fallback;
  return [...new Set(source)]
    .filter(
      (day): day is NotificationReminderDay =>
        typeof day === "number" && allowed.has(day),
    )
    .sort((left, right) => left - right);
}

function normalizeOpeningReminderDays(value: unknown) {
  const allowed = new Set<number>(OPENING_REMINDER_DAYS);
  return [...new Set(Array.isArray(value) ? value : [])]
    .filter(
      (day): day is GroupBuyOpeningReminderDay =>
        typeof day === "number" && allowed.has(day),
    )
    .sort((left, right) => left - right);
}

export function normalizeReminderPreference(
  value: unknown,
  legacyReminderDays: unknown,
  fallbackReminderDays: readonly NotificationReminderDay[] = DEFAULT_NOTIFICATION_REMINDER_DAYS,
): GroupBuyReminderUpdate {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const candidate = value as Record<string, unknown>;
    if (candidate.type === "opening") {
      const reminderTimeMinutes = Number(candidate.reminderTimeMinutes);
      const hasValidTime =
        Number.isInteger(reminderTimeMinutes) &&
        reminderTimeMinutes >= 0 &&
        reminderTimeMinutes < 24 * 60;
      return {
        type: "opening",
        reminderDays: hasValidTime
          ? normalizeOpeningReminderDays(candidate.reminderDays)
          : [],
        reminderTimeMinutes: hasValidTime
          ? reminderTimeMinutes
          : DEFAULT_OPENING_REMINDER_TIME_MINUTES,
      };
    }
    if (candidate.type === "deadline") {
      return {
        type: "deadline",
        reminderDays: normalizeReminderDays(candidate.reminderDays, []),
        reminderTimeMinutes: null,
      };
    }
  }
  return {
    type: "deadline",
    reminderDays: normalizeReminderDays(
      legacyReminderDays,
      fallbackReminderDays,
    ),
    reminderTimeMinutes: null,
  };
}

export function normalizeReminderUpdate(
  value: GroupBuyReminderUpdate | readonly NotificationReminderDay[],
): GroupBuyReminderUpdate {
  return Array.isArray(value)
    ? {
        type: "deadline",
        reminderDays: normalizeReminderDays(value, []),
        reminderTimeMinutes: null,
      }
    : normalizeReminderPreference(value, [], []);
}

export function prunePastReminderDays(
  item: GroupBuy,
  preference: GroupBuyReminderUpdate,
  now = Date.now(),
): GroupBuyReminderUpdate {
  const eventDate =
    preference.type === "opening" ? item.startDate : item.endDate;
  if (!eventDate || Number.isNaN(new Date(eventDate).getTime())) {
    return preference;
  }
  if (preference.type === "opening") {
    const available = new Set(
      buildGroupBuyOpeningReminderOptions(
        eventDate,
        preference.reminderTimeMinutes,
        now,
      )
        .filter(({ available: isAvailable }) => isAvailable)
        .map(({ reminderDay }) => reminderDay),
    );
    return {
      ...preference,
      reminderDays: preference.reminderDays.filter((day) => available.has(day)),
    };
  }
  const available = new Set(
    buildGroupBuyReminderOptions(eventDate, now)
      .filter(({ available: isAvailable }) => isAvailable)
      .map(({ reminderDay }) => reminderDay),
  );
  return {
    ...preference,
    reminderDays: preference.reminderDays.filter((day) => available.has(day)),
  };
}
