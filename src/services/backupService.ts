import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import {
  clearAppointments,
  listAppointments,
  restoreAppointment,
} from '../database/appointmentsRepository';
import {
  clearClients,
  listClients,
  restoreClient,
} from '../database/clientsRepository';
import {
  AppSettings,
  getAppSettings,
  updateAppSettings,
} from '../database/settingsRepository';
import { Appointment } from '../types/Appointment';
import { Client } from '../types/Client';

const BACKUP_SCHEMA_VERSION = 1;
const BACKUP_EXTENSION = 'barberbackup';
const BACKUP_MIME_TYPE = 'application/vnd.barber-reminder.backup+json';

type BackupFile = {
  app: 'Barber Reminder';
  schemaVersion: number;
  exportedAt: string;
  clients: Client[];
  appointments: Appointment[];
  settings: AppSettings;
};

type BackupPreview = {
  fileUri: string;
  exportedAt: string;
  clientsCount: number;
  appointmentsCount: number;
};

function createBackupPayload(): BackupFile {
  return {
    app: 'Barber Reminder',
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    clients: listClients(),
    appointments: listAppointments(),
    settings: getAppSettings(),
  };
}

function assertBackupFile(value: unknown): asserts value is BackupFile {
  const backup = value as BackupFile;

  if (
    !backup ||
    backup.app !== 'Barber Reminder' ||
    backup.schemaVersion !== BACKUP_SCHEMA_VERSION ||
    !Array.isArray(backup.clients) ||
    !Array.isArray(backup.appointments) ||
    !backup.settings
  ) {
    throw new Error('Invalid backup file');
  }
}

function getBackupFromFile(fileUri: string) {
  const file = new File(fileUri);
  const content = file.textSync();
  const parsedContent = JSON.parse(content) as unknown;

  assertBackupFile(parsedContent);

  return parsedContent;
}

export async function exportBackupFile() {
  const backup = createBackupPayload();
  const exportedDate = new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .slice(0, 19);
  const file = new File(
    Paths.cache,
    `barber-reminder-backup-${exportedDate}.${BACKUP_EXTENSION}`
  );

  file.write(JSON.stringify(backup, null, 2));

  const canShare = await Sharing.isAvailableAsync();

  if (!canShare) {
    throw new Error('Sharing is not available');
  }

  await Sharing.shareAsync(file.uri, {
    mimeType: BACKUP_MIME_TYPE,
    dialogTitle: 'Exportar backup Barber Reminder',
  });
}

export async function pickBackupFile(): Promise<BackupPreview | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled) {
    return null;
  }

  const asset = result.assets[0];
  const backup = getBackupFromFile(asset.uri);

  return {
    fileUri: asset.uri,
    exportedAt: backup.exportedAt,
    clientsCount: backup.clients.length,
    appointmentsCount: backup.appointments.length,
  };
}

export function restoreBackupFile(fileUri: string) {
  const backup = getBackupFromFile(fileUri);

  clearAppointments();
  clearClients();

  backup.clients.forEach((client) => {
    restoreClient(client);
  });

  backup.appointments.forEach((appointment) => {
    restoreAppointment(appointment);
  });

  updateAppSettings(backup.settings);
}
