Show me the current SQLite database schema.

Query sqlite_master to list all tables and their CREATE statements:
  SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name;

Format the output as readable SQL with each table on its own block.
Also show a summary of row counts per table:
  SELECT 'medicines', COUNT(*) FROM medicines;
  (repeat for all tables)

Example output:
  TABLE: medicines
  CREATE TABLE medicines (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    ...
  )
  Row count: 3

  TABLE: schedules
  ...
