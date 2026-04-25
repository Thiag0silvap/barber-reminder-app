import { Client } from '../types/Client';
import { database } from './connection';

type CreateClientDTO = {
    name: string;
    phone: string;
    lastVisit: string;
    recurrenceDays: number;
    nextVisit: string;
    notes?: string;
};

export function createClient(data: CreateClientDTO) {
    const statement = database.prepareSync(`
        INSERT INTO clients (
            name,
            phone,
            last_visit,
            recurrence_days,
            next_visit,
            notes
        ) VALUES (?, ?, ?, ?, ?, ?);
    `);

    try {
        statement.executeSync([
            data.name,
            data.phone,
            data.lastVisit,
            data.recurrenceDays,
            data.nextVisit,
            data.notes ?? null,
        ]);
    } finally {
        statement.finalizeSync();
    }
}

export function listClients(): Client[] {
    const rows = database.getAllSync(`
        SELECT 
            id,
            name,
            phone,
            last_visit as lastVisit,
            recurrence_days as recurrenceDays,
            next_visit as nextVisit,
            notes,
            created_at as createdAt
        FROM clients;
        ORDER BY name ASC;
    `);
    
     return rows as Client[];

    }