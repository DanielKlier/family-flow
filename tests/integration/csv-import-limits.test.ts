import { describe, expect, it } from "vitest";

import { buildServer } from "../../src/app/server.js";

function multipartAtSize(size: number): { body: Buffer; contentType: string } {
  const boundary = "family-flow-limit";
  const prefix = `--${boundary}\r\nContent-Disposition: form-data; name="padding"\r\n\r\n`;
  const suffix = `\r\n--${boundary}--\r\n`;
  const body = Buffer.from(
    `${prefix}${"x".repeat(size - Buffer.byteLength(prefix + suffix))}${suffix}`,
  );
  return { body, contentType: `multipart/form-data; boundary=${boundary}` };
}

describe("CSV multipart limit", () => {
  it("E2E-FF-CSV-006-01: accepts exactly 6 MiB and rejects the next byte", async () => {
    const server = buildServer();
    const exact = multipartAtSize(6 * 1024 * 1024);
    const overflow = multipartAtSize(6 * 1024 * 1024 + 1);
    const accepted = await server.inject({
      method: "POST",
      url: "/imports/csv/preview",
      headers: { "content-type": exact.contentType },
      payload: exact.body,
    });
    const rejected = await server.inject({
      method: "POST",
      url: "/imports/csv/preview",
      headers: { "content-type": overflow.contentType },
      payload: overflow.body,
    });
    expect(accepted.statusCode).not.toBe(413);
    expect(rejected.statusCode).toBe(413);
    await server.close();
  });
});
