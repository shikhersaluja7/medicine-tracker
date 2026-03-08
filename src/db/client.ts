// src/db/client.ts — Opens the SQLite database connection.
// Every service file imports `db` from here to run queries.
//
// SQLite is a lightweight database that stores data in a single file
// on the device. Unlike a server database (Postgres, MySQL), it runs
// entirely on the phone — no internet connection needed.
//
// expo-sqlite v15 uses a synchronous API, meaning calls complete
// immediately (no async/await needed for most operations).

import { openDatabaseSync, type SQLiteDatabase } from "expo-sqlite";

// Open (or create) the database file named "medicine-tracker.db".
// On iOS: stored in the app's Documents directory
// On Android: stored in the app's internal storage
// The file persists between app launches — data is not lost when you close the app.
//
// Example path on device: .../Documents/SQLite/medicine-tracker.db
export const db: SQLiteDatabase = openDatabaseSync("medicine-tracker.db");
