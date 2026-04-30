import { database } from './connection';

export type AppSettings = {
  barbershopName: string;
  whatsappMessage: string;
  notificationsEnabled: boolean;
  notificationHour: number;
  notificationMinute: number;
};

const DEFAULT_SETTINGS: AppSettings = {
  barbershopName: 'Barber Reminder',
  whatsappMessage:
    'Olá {cliente}, tudo bem? Já está próximo do período do seu corte. Quer reservar um horário esta semana?',
  notificationsEnabled: true,
  notificationHour: 9,
  notificationMinute: 0,
};

type SettingsRow = {
  key: string;
  value: string;
};

function getSettingValue(key: keyof AppSettings) {
  const row = database.getFirstSync(
    `
    SELECT value
    FROM app_settings
    WHERE key = ?;
    `,
    [key]
  ) as { value: string } | null;

  return row?.value;
}

function setSettingValue(key: keyof AppSettings, value: string) {
  database.runSync(
    `
    INSERT INTO app_settings (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value;
    `,
    [key, value]
  );
}

export function getAppSettings(): AppSettings {
  const rows = database.getAllSync(
    `
    SELECT key, value
    FROM app_settings;
    `
  ) as SettingsRow[];

  const values = rows.reduce<Record<string, string>>((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {});

  return {
    barbershopName: values.barbershopName ?? DEFAULT_SETTINGS.barbershopName,
    whatsappMessage: values.whatsappMessage ?? DEFAULT_SETTINGS.whatsappMessage,
    notificationsEnabled:
      values.notificationsEnabled === undefined
        ? DEFAULT_SETTINGS.notificationsEnabled
        : values.notificationsEnabled === 'true',
    notificationHour: Number(values.notificationHour ?? DEFAULT_SETTINGS.notificationHour),
    notificationMinute: Number(values.notificationMinute ?? DEFAULT_SETTINGS.notificationMinute),
  };
}

export function updateAppSettings(settings: AppSettings) {
  setSettingValue('barbershopName', settings.barbershopName);
  setSettingValue('whatsappMessage', settings.whatsappMessage);
  setSettingValue('notificationsEnabled', String(settings.notificationsEnabled));
  setSettingValue('notificationHour', String(settings.notificationHour));
  setSettingValue('notificationMinute', String(settings.notificationMinute));
}

export function getWhatsappMessageTemplate() {
  return getSettingValue('whatsappMessage') ?? DEFAULT_SETTINGS.whatsappMessage;
}

export function getDefaultAppSettings() {
  return DEFAULT_SETTINGS;
}
