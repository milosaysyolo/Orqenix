// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach } from "vitest";
import { RegistryResolverRegistry, type RegistryResolver } from "../src/registry-resolver";
import { buildDefaultResolvers } from "../src/resolvers/index";
import { LocalFileResolver } from "../src/resolvers/local-file";
import { OrqenixOfficialResolver } from "../src/resolvers/orqenix-official";
import { NpmRegistryResolver } from "../src/resolvers/npm";

describe("RegistryResolverRegistry", () => {
  let registry: RegistryResolverRegistry;

  beforeEach(() => {
    registry = buildDefaultResolvers();
  });

  it("builds 6 default resolvers", () => {
    expect(registry.listAll()).toHaveLength(6);
    expect(registry.listAll().sort()).toEqual([
      "enterprise",
      "github",
      "local-file",
      "npm",
      "orqenix-official",
      "private-git",
    ]);
  });

  it("orqenix-official + npm + local-file enabled by default", () => {
    const enabled = registry.listEnabled().sort();
    expect(enabled).toContain("orqenix-official");
    expect(enabled).toContain("npm");
    expect(enabled).toContain("local-file");
  });

  it("github + private-git + enterprise disabled by default", () => {
    const enabled = registry.listEnabled();
    expect(enabled).not.toContain("github");
    expect(enabled).not.toContain("private-git");
    expect(enabled).not.toContain("enterprise");
  });

  it("getResolver returns the right resolver", () => {
    const r = registry.getResolver("npm");
    expect(r.id).toBe("npm");
    expect(r.name).toBe("npm Registry");
  });

  it("throws for unregistered source", () => {
    const empty = new RegistryResolverRegistry();
    expect(() => empty.getResolver("npm")).toThrow(/No resolver registered/);
  });

  it("setEnabled toggles a resolver", () => {
    registry.setEnabled("github", true);
    expect(registry.listEnabled()).toContain("github");
    registry.setEnabled("github", false);
    expect(registry.listEnabled()).not.toContain("github");
  });

  it("register adds a custom resolver", () => {
    const custom: RegistryResolver = {
      id: "enterprise",
      name: "Custom",
      enabled: true,
      async search() {
        return [];
      },
      async fetch() {
        throw new Error("not implemented");
      },
      async download() {
        throw new Error("not implemented");
      },
    };
    registry.register(custom);
    expect(registry.getResolver("enterprise").name).toBe("Custom");
  });

  it("LocalFileResolver returns empty for nonexistent dir", async () => {
    const resolver = new LocalFileResolver({ pluginsDir: "/nonexistent/path" });
    const results = await resolver.search("anything");
    expect(results).toEqual([]);
  });

  it("OrqenixOfficialResolver marks results as verified", async () => {
    const mockFetch = (async () =>
      new Response(
        JSON.stringify({
          plugins: [
            {
              name: "@example/skill",
              version: "1.0.0",
              description: "x",
              kind: "skill",
              license: "Apache-2.0",
              external_agent_compat: [],
              publisher: "orqenix",
              source: "orqenix-official",
              verified: false,
            },
          ],
        }),
        { status: 200 },
      )) as typeof globalThis.fetch;

    const resolver = new OrqenixOfficialResolver({ fetchImpl: mockFetch });
    const results = await resolver.search("skill");
    expect(results).toHaveLength(1);
    expect(results[0]?.verified).toBe(true); // official registry marks verified
  });

  it("NpmRegistryResolver filters to orqenix-tagged packages", async () => {
    const mockFetch = (async () =>
      new Response(
        JSON.stringify({
          objects: [
            { package: { name: "@a/orq", version: "1.0.0", keywords: ["orqenix-plugin"] } },
            { package: { name: "random-pkg", version: "1.0.0", keywords: ["other"] } },
          ],
        }),
        { status: 200 },
      )) as typeof globalThis.fetch;

    const resolver = new NpmRegistryResolver({ fetchImpl: mockFetch });
    const results = await resolver.search("test");
    expect(results).toHaveLength(1);
    expect(results[0]?.name).toBe("@a/orq");
    expect(results[0]?.verified).toBe(false); // npm unverified
  });

  it("search failure returns empty (no throw)", async () => {
    const failFetch = (async () => {
      throw new Error("network error");
    }) as typeof globalThis.fetch;
    const resolver = new OrqenixOfficialResolver({ fetchImpl: failFetch });
    const results = await resolver.search("x");
    expect(results).toEqual([]);
  });
});
