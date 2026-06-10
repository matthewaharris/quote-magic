// Run ad-hoc SQL against the Supabase database.
// Usage: node --env-file=.env.local scripts/db.mjs "select now()"
import pg from "pg";

const sql = process.argv[2];
if (!sql) {
  console.error("Usage: node --env-file=.env.local scripts/db.mjs \"<sql>\"");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  const result = await client.query(sql);
  console.log(JSON.stringify(result.rows, null, 2));
} finally {
  await client.end();
}
