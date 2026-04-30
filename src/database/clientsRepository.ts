import { Client } from '../types/Client';
import { database } from './connection';

type CreateClientDTO = {
  name: string;
  phone: string;
  lastVisit?: string | null;
  recurrenceDays?: number | null;
  nextVisit?: string | null;
  notes?: string;
};

export function createClient(data: CreateClientDTO): number {
  const result = database.runSync(
    `
    INSERT INTO clients (
      name,
      phone,
      last_visit,
      recurrence_days,
      next_visit,
      notes
    ) VALUES (?, ?, ?, ?, ?, ?);
    `,
    [
      data.name,
      data.phone,
      data.lastVisit ?? null,
      data.recurrenceDays ?? null,
      data.nextVisit ?? null,
      data.notes ?? null,
    ]
  );

  return result.lastInsertRowId;
}

export function listClients(): Client[] {
  return database.getAllSync(
    `
    SELECT
      id,
      name,
      phone,
      last_visit as lastVisit,
      recurrence_days as recurrenceDays,
      next_visit as nextVisit,
      notes,
      created_at as createdAt
    FROM clients
    ORDER BY name ASC;
    `
  ) as Client[];
}

export function listClientsForToday(): Client[] {
  const today = new Date().toISOString().split('T')[0];

  return database.getAllSync(
    `
    SELECT
      id,
      name,
      phone,
      last_visit as lastVisit,
      recurrence_days as recurrenceDays,
      next_visit as nextVisit,
      notes,
      created_at as createdAt
    FROM clients
    WHERE next_visit IS NOT NULL
      AND next_visit <= ?
    ORDER BY next_visit ASC;
    `,
    [today]
  ) as Client[];
}

export function updateClientVisit(
  clientId: number,
  lastVisit: string,
  recurrenceDays: number | null,
  nextVisit: string | null
) {
  database.runSync(
    `
    UPDATE clients
    SET
      last_visit = ?,
      recurrence_days = ?,
      next_visit = ?
    WHERE id = ?;
    `,
    [lastVisit, recurrenceDays, nextVisit, clientId]
  );
}

export function deleteClient(clientId: number) {
  database.runSync(
    `
    DELETE FROM clients
    WHERE id = ?;
    `,
    [clientId]
  );
}
