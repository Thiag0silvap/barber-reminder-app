import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { AppSettings } from '../database/settingsRepository';

const DAILY_REMINDER_ID = 'daily-client-reminder';
const CHANNEL_ID = 'client-reminders';

type ScheduleDailyClientReminderOptions = {
  requestPermission?: boolean;
};

export function configureNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

async function configureAndroidChannel() {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Lembretes de clientes',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#C08A3E',
  });
}

export async function requestNotificationPermission() {
  const currentPermissions = await Notifications.getPermissionsAsync();

  if (currentPermissions.granted) {
    return true;
  }

  const requestedPermissions = await Notifications.requestPermissionsAsync();
  return requestedPermissions.granted;
}

async function hasNotificationPermission() {
  const currentPermissions = await Notifications.getPermissionsAsync();
  return currentPermissions.granted;
}

export async function cancelDailyClientReminder() {
  await Notifications.cancelScheduledNotificationAsync(DAILY_REMINDER_ID);
}

export async function scheduleDailyClientReminder(
  settings: AppSettings,
  options: ScheduleDailyClientReminderOptions = {}
) {
  try {
    await configureAndroidChannel();
    await cancelDailyClientReminder();

    if (!settings.notificationsEnabled) {
      return false;
    }

    const hasPermission = options.requestPermission
      ? await requestNotificationPermission()
      : await hasNotificationPermission();

    if (!hasPermission) {
      return false;
    }

    await Notifications.scheduleNotificationAsync({
      identifier: DAILY_REMINDER_ID,
      content: {
        title: settings.barbershopName || 'Barber Reminder',
        body: 'Abra o app e confira os clientes que precisam de contato hoje.',
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        channelId: CHANNEL_ID,
        hour: settings.notificationHour,
        minute: settings.notificationMinute,
      },
    });

    return true;
  } catch (error) {
    console.warn('Nao foi possivel agendar a notificacao diaria.', error);
    return false;
  }
}

export async function sendTestReminder(settings: AppSettings) {
  await configureAndroidChannel();

  const hasPermission = await requestNotificationPermission();

  if (!hasPermission) {
    return false;
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: settings.barbershopName || 'Barber Reminder',
      body: 'Teste de lembrete ativado com sucesso.',
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 2,
    },
  });

  return true;
}
