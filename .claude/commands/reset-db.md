Drop all SQLite tables and re-run migrations to get a fresh empty database.
This is for development only — data cannot be recovered after this.

Steps:
1. Show me the current tables and their row counts
2. Ask me to type "yes" to confirm before doing anything destructive
3. Drop all tables in this order (to respect foreign key constraints):
   notification_log → intake_logs → inventory → schedules → medicines
4. Re-run the migration in src/db/migrations.ts to recreate all tables
5. Confirm by showing tables again with 0 rows

Example output after reset:
  medicines        0 rows
  schedules        0 rows
  intake_logs      0 rows
  inventory        0 rows
  notification_log 0 rows
