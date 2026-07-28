import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema.js";

export function createPostgresConnection(databaseUrl: string) {
  const client = postgres(databaseUrl, { max: 5 });
  const db = drizzle(client, { schema });

  return { client, db };
}

export type PostgresDatabase = ReturnType<typeof createPostgresConnection>["db"];
