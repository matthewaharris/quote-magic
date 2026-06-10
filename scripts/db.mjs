// Run ad-hoc SQL against the Supabase database.
// Usage: node --env-file=.env.local scripts/db.mjs "select now()"
//        node --env-file=.env.local scripts/db.mjs --file path/to/migration.sql
import { readFileSync } from "node:fs";
import pg from "pg";

const sql =
  process.argv[2] === "--file"
    ? readFileSync(process.argv[3], "utf8")
    : process.argv[2];
if (!sql) {
  console.error("Usage: node --env-file=.env.local scripts/db.mjs \"<sql>\" | --file <path>");
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
