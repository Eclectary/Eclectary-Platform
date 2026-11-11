import { describe, expect, it } from "vitest";

import { resolveApiBaseUrl } from "./api";

describe("resolveApiBaseUrl", () => {
  it("uses the local Rails API when no development URL is configured", () => {
    expect(resolveApiBaseUrl(undefined, false)).toBe("http://localhost:3000/api/v1");
  });

  it("requires an explicit API URL in production", () => {
    expect(() => resolveApiBaseUrl(undefined, true)).toThrow(
      "VITE_API_URL must be configured for production builds",
    );
  });

  it("accepts an HTTPS production API URL and removes trailing slashes", () => {
    expect(resolveApiBaseUrl("https://api.example.com/api/v1/", true)).toBe(
      "https://api.example.com/api/v1",
    );
  });

  it("rejects an insecure production API URL", () => {
    expect(() => resolveApiBaseUrl("http://api.example.com/api/v1", true)).toThrow(
      "VITE_API_URL must use HTTPS for production builds",
    );
  });

  it.each([
    "not a URL",
    "ftp://api.example.com/api/v1",
    "https://user:password@api.example.com/api/v1",
    "https://api.example.com/api/v1?source=test",
    "https://api.example.com/api/v1#fragment",
  ])("rejects an invalid API URL: %s", (configuredUrl) => {
    expect(() => resolveApiBaseUrl(configuredUrl, true)).toThrow();
  });
});
