import { createHash, randomBytes, randomUUID } from "node:crypto";

import type {
  SessionTokenGenerator,
  SessionTokenHasher,
} from "../../ports/auth/session-cryptography.js";

export class SecureSessionTokenGenerator implements SessionTokenGenerator {
  generate(): string {
    return randomBytes(32).toString("base64url");
  }

  generateId(): string {
    return randomUUID();
  }
}

export class Sha256SessionTokenHasher implements SessionTokenHasher {
  hash(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }
}
