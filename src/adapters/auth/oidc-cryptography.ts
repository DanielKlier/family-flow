import { randomBytes } from "node:crypto";

import type { OidcTokenGenerator } from "../../ports/auth/oidc-transaction-store.js";

export class SecureOidcTokenGenerator implements OidcTokenGenerator {
  generate(): string {
    return randomBytes(32).toString("base64url");
  }
}
