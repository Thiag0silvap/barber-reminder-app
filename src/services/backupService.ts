import { Share } from 'react-native';

import { listAppointments } from '../database/appointmentsRepository';
import { listClients } from '../database/clientsRepository';
import { getAppSettings } from '../database/settingsRepository';

export async function exportBackup() {
  const backup = {
    app: 'Barber Reminder',
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    clients: listClients(),
    appointments: listAppointments(),
    settings: getAppSettings(),
  };

  const message = JSON.stringify(backup, null, 2);

  await Share.share({
    title: 'Backup Barber Reminder',
    message,
  });
}
