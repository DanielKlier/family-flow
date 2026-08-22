import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { DrizzleScenarioRepository } from "../../src/adapters/db/drizzle-scenario-repository.js";
import { migrate } from "../../src/adapters/db/migrate.js";
import { createPostgresConnection } from "../../src/adapters/db/postgres.js";
import { scenarioAdjustments, scenarios } from "../../src/adapters/db/schema.js";
import { createScenario, createScenarioAdjustment } from "../../src/core/scenarios/scenario.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const scenario = createScenario({
  id: "scenario-drizzle-parental-leave",
  name: "Parental leave",
  startMonth: "2026-08",
  endMonth: "2028-01",
  startingBufferCents: 100_000,
  baseIncomeCents: 300_000,
  baseline: { mode: "historical", windowLength: 3, expenseCents: 30_000 },
});
const adjustment = createScenarioAdjustment({
  id: "scenario-drizzle-benefit",
  scenarioId: scenario.id,
  name: "Parental benefit",
  type: "income",
  deltaCents: 120_000,
  startMonth: "2026-08",
  endMonth: "2026-12",
});

describe("Drizzle scenario repository", () => {
  it.runIf(testDatabaseUrl !== undefined)(
    "INT-FF-SCN-001-01 persists canonical snapshots and ordered adjustments",
    async () => {
      if (testDatabaseUrl === undefined) throw new Error("TEST_DATABASE_URL is required");
      await migrate(testDatabaseUrl);
      const connection = createPostgresConnection(testDatabaseUrl);
      const repository = new DrizzleScenarioRepository(connection.db);
      try {
        await repository.save(scenario, [adjustment]);
        await expect(repository.get(scenario.id)).resolves.toEqual({
          scenario,
          adjustments: [adjustment],
        });
        await expect(repository.list()).resolves.toContainEqual({
          scenario,
          adjustments: [adjustment],
        });

        const concurrent = [
          createScenarioAdjustment({ ...adjustment, id: "scenario-concurrent-a" }),
          createScenarioAdjustment({ ...adjustment, id: "scenario-concurrent-b" }),
        ];
        await Promise.all(concurrent.map((item) => repository.addAdjustment(item)));
        await expect(repository.get(scenario.id)).resolves.toMatchObject({
          adjustments: [adjustment, ...concurrent].sort((left, right) =>
            left.id.localeCompare(right.id),
          ),
        });

        const conflicting = [
          createScenarioAdjustment({
            ...adjustment,
            id: "scenario-conflicting-a",
            deltaCents: -400_000,
          }),
          createScenarioAdjustment({
            ...adjustment,
            id: "scenario-conflicting-b",
            deltaCents: -400_000,
          }),
        ];
        const outcomes = await Promise.allSettled(
          conflicting.map((item) => repository.addAdjustment(item)),
        );
        expect(outcomes.map(({ status }) => status).sort()).toEqual(["fulfilled", "rejected"]);
        const persisted = await repository.get(scenario.id);
        expect(
          persisted?.adjustments.filter(({ id }) => id.startsWith("scenario-conflicting")),
        ).toHaveLength(1);
      } finally {
        await connection.db
          .delete(scenarioAdjustments)
          .where(eq(scenarioAdjustments.scenarioId, scenario.id));
        await connection.db.delete(scenarios).where(eq(scenarios.id, scenario.id));
        await connection.client.end();
      }
    },
  );

  it.runIf(testDatabaseUrl !== undefined)(
    "INT-FF-SCN-001-02 preserves a snapshot on ordinary updates and replaces it only explicitly",
    async () => {
      if (testDatabaseUrl === undefined) throw new Error("TEST_DATABASE_URL is required");
      await migrate(testDatabaseUrl);
      const connection = createPostgresConnection(testDatabaseUrl);
      const repository = new DrizzleScenarioRepository(connection.db);
      try {
        await repository.save(scenario, []);
        await repository.save({ ...scenario, name: "Renamed", startingBufferCents: 200_000 }, []);
        await expect(repository.get(scenario.id)).resolves.toMatchObject({
          scenario: { name: "Renamed", baseline: scenario.baseline },
        });
        const replacement = { mode: "manual" as const, expenseCents: 90_000 };
        await repository.save({ ...scenario, baseline: replacement }, []);
        await expect(repository.get(scenario.id)).resolves.toMatchObject({
          scenario: { baseline: replacement },
        });
      } finally {
        await connection.db
          .delete(scenarioAdjustments)
          .where(eq(scenarioAdjustments.scenarioId, scenario.id));
        await connection.db.delete(scenarios).where(eq(scenarios.id, scenario.id));
        await connection.client.end();
      }
    },
  );
});
