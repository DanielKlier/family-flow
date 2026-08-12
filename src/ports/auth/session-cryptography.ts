export interface SessionTokenGenerator {
  generate(): string;
  generateId(): string;
}

export interface SessionTokenHasher {
  hash(token: string): string;
}
