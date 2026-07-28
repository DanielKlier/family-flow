import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import postgres from "postgres";

export async function migrate(databaseUrl: string, migrationsDirectory = "drizzle"): Promise<void> {
  const sql = postgres(databaseUrl, { max: 1, onnotice: () => undefined });

  try {
    await sql`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`;

    const names = (await readdir(migrationsDirectory))
      .filter((name) => name.endsWith(".sql"))
      .sort();

    for (const name of names) {
      const [existing] = await sql<
        { name: string }[]
      >`select name from schema_migrations where name = ${name}`;
      if (existing !== undefined) {
        continue;
      }

      const statement = await readFile(join(migrationsDirectory, name), "utf8");

      await sql.begin(async (transaction) => {
        await transaction.unsafe(statement);
        await transaction`insert into schema_migrations (name) values (${name})`;
      });
    }
  } finally {
    await sql.end();
  }
}

if (process.argv[1]?.endsWith("migrate.js") || process.argv[1]?.endsWith("migrate.ts")) {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl === undefined || databaseUrl.trim() === "") {
    throw new Error("DATABASE_URL is required");
  }

  await migrate(databaseUrl);
}
