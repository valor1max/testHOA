import pg from 'pg';

// Reused across warm Lambda invocations. Keep max small: Lambda runs one request per container.
let pool;
export function db() {
  if (!pool) {
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 2,
      ssl: process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false },
    });
  }
  return pool;
}
