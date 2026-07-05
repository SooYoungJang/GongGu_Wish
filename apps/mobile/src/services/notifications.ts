import type { NotificationTriggerInput } from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Expo Go does not fully support expo-notifications native modules.
// Lazy-load to avoid importing the module at app startup in Expo Go.
const IS_EXPO_GO = Constants.appOwnership === 'expo';
let NotificationsModule: typeof import('expo-notifications') | null = null;

async function getNotifications() {
  if (IS_EXPO_GO || NotificationsModule) return NotificationsModule;
  NotificationsModule = await import('expo-notifications');
  try {
    NotificationsModule.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch {
    // ignore
  }
  return NotificationsModule;
}

export async function requestNotificationPermissions(): Promise<boolean> {
  if (IS_EXPO_GO) return false;
  const Notifications = await getNotifications();
  if (!Notifications) return false;
  try {
    const existingStatus = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    const currentStatus = (existingStatus as { status?: string }).status;
    if (currentStatus !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      finalStatus = requested;
    }

    const finalStatusValue = (finalStatus as { status?: string }).status;
    if (finalStatusValue !== 'granted') {
      return false;
    }
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('group-buy-start', {
        name: '공구 시작 알림',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#F0445E',
      }).catch(() => {});
    }
    return true;
  } catch {
    return false;
  }
}

export type ScheduledNotification = {
  id: string;
  groupBuyId: string;
  productName: string | null;
  triggerDate: Date | null;
};

export async function scheduleGroupBuyStart(
  groupBuyId: string,
  productName: string | null,
  startDate: string | null,
): Promise<ScheduledNotification | null> {
  if (IS_EXPO_GO || !startDate) return null;
  const Notifications = await getNotifications();
  if (!Notifications) return null;

  const triggerDate = new Date(startDate);
  if (Number.isNaN(triggerDate.getTime())) return null;

  const notifyAt = new Date(triggerDate.getTime() - 60 * 60 * 1000);
  if (notifyAt.getTime() <= Date.now()) return null;

  const triggerSeconds = Math.round((notifyAt.getTime() - Date.now()) / 1000);
  if (triggerSeconds <= 0) return null;

  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: '공구 시작 알림',
      body: `${productName ?? '공동구매'} 공구가 곧 시작될 예정이요!`,
      data: { groupBuyId },
    },
    trigger: Platform.select({
      ios: {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        hour: notifyAt.getHours(),
        minute: notifyAt.getMinutes(),
        day: notifyAt.getDate(),
        month: notifyAt.getMonth() + 1,
        year: notifyAt.getFullYear(),
      },
      android: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: triggerSeconds,
        channelId: 'group-buy-start',
      },
      default: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: triggerSeconds,
        channelId: 'group-buy-start',
      },
    }) as NotificationTriggerInput,
  });

  return { id: identifier, groupBuyId, productName, triggerDate: notifyAt };
}

export async function cancelScheduledNotification(identifier: string): Promise<void> {
  if (IS_EXPO_GO) return;
  const Notifications = await getNotifications();
  if (!Notifications) return;
  await Notifications.cancelScheduledNotificationAsync(identifier);
}

export async function cancelAllScheduledNotifications(): Promise<void> {
  if (IS_EXPO_GO) return;
  const Notifications = await getNotifications();
  if (!Notifications) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function getScheduledNotifications() {
  if (IS_EXPO_GO) return [];
  const Notifications = await getNotifications();
  if (!Notifications) return [];
  return Notifications.getAllScheduledNotificationsAsync();
}
