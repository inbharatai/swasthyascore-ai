import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard test: the repository we are modifying must be swasthyascore-ai, and the
 * forbidden UnoOne-Local-Agent repo must never be the origin. This catches a
 * wrong working directory before any change ships.
 */
describe("repository safety", () => {
  it("origin remote points to inbharatai/swasthyascore-ai", () => {
    const configPath = resolve(process.cwd(), ".git", "config");
    const config = readFileSync(configPath, "utf8");
    expect(config).toContain("inbharatai/swasthyascore-ai");
  });

  it("origin is never the forbidden UnoOne-Local-Agent repo", () => {
    const configPath = resolve(process.cwd(), ".git", "config");
    const config = readFileSync(configPath, "utf8");
    expect(config).not.toContain("UnoOne-Local-Agent");
  });
});