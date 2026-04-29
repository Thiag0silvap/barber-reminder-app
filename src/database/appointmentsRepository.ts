import { Appointment } from '../types/Appointment';
import { database } from './connection';

export function createAppointment(appointment: Appointment) {
  database.runSync(
    `
    INSERT INTO appointments (client_id, visit_date)
    VALUES (?, ?)
    `,
    [appointment.clientId, appointment.visitDate]
  );
}

export function getAppointmentsByClient(clientId: number): Appointment[] {
  return database.getAllSync(
    `
    SELECT
      id,
      client_id as clientId,
      visit_date as visitDate,
      created_at as createdAt
    FROM appointments
    WHERE client_id = ?
    ORDER BY visit_date DESC
    `,
    [clientId]
  ) as Appointment[];
}