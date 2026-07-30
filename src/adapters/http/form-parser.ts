import type { FastifyInstance } from "fastify";

export type ParsedMultipartForm = Record<string, string | Buffer | undefined>;

export function registerFormParser(server: FastifyInstance): void {
  server.addContentTypeParser(
    "application/x-www-form-urlencoded",
    { parseAs: "string" },
    (_request, body, done) => {
      done(null, Object.fromEntries(new URLSearchParams(body.toString())));
    },
  );
  server.addContentTypeParser(
    /^multipart\/form-data(;.*)?$/,
    { parseAs: "buffer" },
    (request, body, done) => {
      try {
        if (!Buffer.isBuffer(body)) {
          throw new Error("Multipart body must be a buffer");
        }

        done(null, parseMultipartForm(body, readBoundary(request.headers["content-type"])));
      } catch (error) {
        done(error as Error);
      }
    },
  );
}

function readBoundary(contentType: string | string[] | undefined): string {
  if (typeof contentType !== "string") {
    throw new Error("Multipart content type is required");
  }

  const boundary = /boundary=([^;]+)/.exec(contentType)?.[1];
  if (boundary === undefined || boundary.trim() === "") {
    throw new Error("Multipart boundary is required");
  }

  return boundary.trim().replace(/^"|"$/g, "");
}

function parseMultipartForm(body: Buffer, boundary: string): ParsedMultipartForm {
  const result: ParsedMultipartForm = {};
  const delimiter = `--${boundary}`;
  const parts = body.toString("binary").split(delimiter).slice(1, -1);

  for (const part of parts) {
    const normalizedPart = part.replace(/^\r\n/, "").replace(/\r\n$/, "");
    const separatorIndex = normalizedPart.indexOf("\r\n\r\n");
    if (separatorIndex === -1) {
      continue;
    }

    const rawHeaders = normalizedPart.slice(0, separatorIndex);
    const rawValue = normalizedPart.slice(separatorIndex + 4);
    const disposition = rawHeaders
      .split("\r\n")
      .find((header) => header.toLowerCase().startsWith("content-disposition:"));
    const name = disposition === undefined ? undefined : /name="([^"]+)"/.exec(disposition)?.[1];
    if (name === undefined) {
      continue;
    }

    const isFile = /filename="[^"]*"/.test(disposition ?? "");
    result[name] = isFile
      ? Buffer.from(rawValue, "binary")
      : Buffer.from(rawValue, "binary").toString("utf8");
  }

  return result;
}
