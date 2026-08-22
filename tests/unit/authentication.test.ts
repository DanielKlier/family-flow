import { describe, expect, it } from "vitest";

import { InMemoryOidcTransactionStore } from "../../src/adapters/db/in-memory-oidc-transaction-store.js";
import { OidcTransactionService } from "../../src/core/auth/oidc-transaction-service.js";
import type { Clock } from "../../src/ports/clock/clock.js";

class ControlledClock implements Clock {
  constructor(private current: Date) {}

  now(): Date {
    return new Date(this.current);
  }

  set(current: Date): void {
    this.current = current;
  }
}

describe("OIDC authorization transactions", () => {
  it("UNIT-FF-AUTH-002-01 creates an opaque, safe-return transaction and consumes it exactly once before exclusive expiry", async () => {
    const createdAt = new Date("2025-01-01T00:00:00.000Z");
    const clock = new ControlledClock(createdAt);
    const service = new OidcTransactionService(new InMemoryOidcTransactionStore(), clock, {
      generate: viSequence(["state-opaque-value", "nonce-opaque-value"]),
    });

    await expect(service.create("/transactions?month=2025-01")).resolves.toEqual({
      state: "state-opaque-value",
      nonce: "nonce-opaque-value",
    });

    clock.set(new Date("2025-01-01T00:09:59.999Z"));
    await expect(service.consume("state-opaque-value")).resolves.toEqual({
      state: "state-opaque-value",
      nonce: "nonce-opaque-value",
      returnTo: "/transactions?month=2025-01",
      createdAt,
      expiresAt: new Date("2025-01-01T00:10:00.000Z"),
    });
    await expect(service.consume("state-opaque-value")).resolves.toBeNull();
    await expect(service.consume("missing-state")).resolves.toBeNull();

    const unsafeReturnService = new OidcTransactionService(
      new InMemoryOidcTransactionStore(),
      clock,
      { generate: viSequence(["unsafe-state", "unsafe-nonce"]) },
    );
    clock.set(createdAt);
    await unsafeReturnService.create("https://attacker.example.invalid/return");
    await expect(unsafeReturnService.consume("unsafe-state")).resolves.toMatchObject({
      returnTo: "/",
    });

    const expiryService = new OidcTransactionService(new InMemoryOidcTransactionStore(), clock, {
      generate: viSequence(["expires-state", "expires-nonce"]),
    });
    await expiryService.create("/income");
    clock.set(new Date("2025-01-01T00:10:00.000Z"));
    await expect(expiryService.consume("expires-state")).resolves.toBeNull();
    clock.set(new Date("2025-01-01T00:10:00.001Z"));
    await expect(expiryService.consume("expires-state")).resolves.toBeNull();
  });
});

function viSequence(values: string[]): () => string {
  let index = 0;
  return () => values[index++] ?? "unexpected-opaque-value";
}
