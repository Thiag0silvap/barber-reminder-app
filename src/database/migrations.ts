import { database } from "./connection";

export function runMigrations() {
    database.execSync(`
        CREATE TABLE IF NOT EXISTS clients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            last_visit TEXT NOT NULL,
            recurrence_days INTEGER NOT NULL,
            next_visit TEXT NOT NULL,
            notes TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    `);
}
