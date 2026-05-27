import { describe, it, expect } from "vitest";
import { PluginEntry, Marketplace } from "../index.js";

describe("marketplace-client behavior tests", () => {
  it("PluginEntry schema validates good entries", () => {
    const goodEntry = {
      name: "good-plugin",
      version: "1.0.0",
      source: "https://example.com/plugin.tgz",
      author: { name: "test" },
    };
    const result = PluginEntry.safeParse(goodEntry);
    expect(result.success).toBe(true);
  });

  it("PluginEntry schema rejects bad entries", () => {
    const badEntry = {
      name: "bad-plugin",
    };
    const result = PluginEntry.safeParse(badEntry);
    expect(result.success).toBe(false);
  });

  it("Marketplace schema validates good marketplace", () => {
    const goodMarketplace = {
      schemaVersion: "1.0" as const,
      name: "test-marketplace",
      owner: { name: "test", signing_key_fingerprint: "abc123" },
      tier: "community" as const,
      plugins: [
        {
          name: "plugin1",
          version: "1.0.0",
          source: "https://example.com/plugin.tgz",
          author: { name: "test" },
        },
      ],
    };
    const result = Marketplace.safeParse(goodMarketplace);
    expect(result.success).toBe(true);
  });

  it("Marketplace schema rejects bad marketplace", () => {
    const badMarketplace = {
      schemaVersion: "2.0",
      name: "test-marketplace",
    };
    const result = Marketplace.safeParse(badMarketplace);
    expect(result.success).toBe(false);
  });

  it("PluginEntry accepts optional fields", () => {
    const entryWithOptionals = {
      name: "plugin-with-opts",
      version: "1.0.0",
      source: "https://example.com/plugin.tgz",
      author: { name: "test" },
      category: "utility",
      homepage: "https://example.com",
    };
    const result = PluginEntry.safeParse(entryWithOptionals);
    expect(result.success).toBe(true);
  });

  it("PluginEntry accepts signature field", () => {
    const entryWithSig = {
      name: "signed-plugin",
      version: "1.0.0",
      source: "https://example.com/plugin.tgz",
      author: { name: "test" },
      signature: {
        sig: "base64encodedstring",
        signed_at: new Date().toISOString(),
      },
    };
    const result = PluginEntry.safeParse(entryWithSig);
    expect(result.success).toBe(true);
  });
});
