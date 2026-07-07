// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { PluginLifecycle } from "../src/lifecycle";
import { InMemoryPluginAuditWriter } from "../src/audit-kinds";
import { PluginInstallFailedError } from "../src/errors";

async function writePlugin(dir: string, name: string, kind = "skill"): Promise<string> {
  const pluginDir = join(dir, name.replace("@", "").replace("/", "-"));
  await mkdir(pluginDir, { recursive: true });
  const pkg = {
    name,
    version: "1.0.0",
    license: "Apache-2.0",
    main: "./plugin.js",
    orqenixPlugin: {
      manifestVersion: "1.0",
      kind,
      compatibility: { orqenix: ">=0.8.0" },
      permissions: ["scope.read"],
      external_agent_compat: ["claude-code"],
      tool: {
        name: "tool",
        description: "A tool",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
      },
    },
  };
  await writeFile(join(pluginDir, "package.json"), JSON.stringify(pkg));
  return pluginDir;
}

describe("PluginLifecycle", () => {
  let tmpDir: string;
  let audit: InMemoryPluginAuditWriter;
  let lifecycle: PluginLifecycle;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "orqenix-lifecycle-"));
    audit = new InMemoryPluginAuditWriter();
    lifecycle = new PluginLifecycle({ auditWriter: audit, actor: "test-user" });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("completes full lifecycle: install → configure → activate → deactivate → uninstall", async () => {
    const pluginDir = await writePlugin(tmpDir, "@a/skill");

    const installed = await lifecycle.install(pluginDir);
    expect(installed.state).toBe("installed");

    await lifecycle.configure("@a/skill");
    expect(lifecycle.getRegistry().get("@a/skill").state).toBe("configured");

    await lifecycle.activate("@a/skill");
    expect(lifecycle.getRegistry().get("@a/skill").state).toBe("active");

    await lifecycle.deactivate("@a/skill");
    expect(lifecycle.getRegistry().get("@a/skill").state).toBe("inactive");

    await lifecycle.uninstall("@a/skill");
    expect(lifecycle.getRegistry().find("@a/skill")).toBeNull();
  });

  it("audits each lifecycle transition", async () => {
    const pluginDir = await writePlugin(tmpDir, "@a/skill");
    await lifecycle.install(pluginDir);
    await lifecycle.configure("@a/skill");
    await lifecycle.activate("@a/skill");
    await lifecycle.deactivate("@a/skill");
    await lifecycle.uninstall("@a/skill");

    const kinds = audit.getEvents().map((e) => e.kind);
    expect(kinds).toContain("plugin.manifest_validated");
    expect(kinds).toContain("plugin.installed");
    expect(kinds).toContain("plugin.configured");
    expect(kinds).toContain("plugin.activated");
    expect(kinds).toContain("plugin.deactivated");
    expect(kinds).toContain("plugin.uninstalled");
  });

  it("throws PluginInstallFailedError for invalid plugin", async () => {
    const pluginDir = join(tmpDir, "bad");
    await mkdir(pluginDir, { recursive: true });
    await writeFile(
      join(pluginDir, "package.json"),
      JSON.stringify({ name: "bad", version: "1.0.0" }),
    );
    await expect(lifecycle.install(pluginDir)).rejects.toBeInstanceOf(PluginInstallFailedError);
  });

  it("uninstall is idempotent", async () => {
    await expect(lifecycle.uninstall("@nonexistent/x")).resolves.toBeUndefined();
  });

  it("uninstall deactivates an active plugin first", async () => {
    const pluginDir = await writePlugin(tmpDir, "@a/skill");
    await lifecycle.install(pluginDir);
    await lifecycle.activate("@a/skill");
    await lifecycle.uninstall("@a/skill");

    const kinds = audit.getEvents().map((e) => e.kind);
    const deactivateIdx = kinds.indexOf("plugin.deactivated");
    const uninstallIdx = kinds.indexOf("plugin.uninstalled");
    expect(deactivateIdx).toBeLessThan(uninstallIdx);
  });

  it("update flow re-activates if previously active", async () => {
    const pluginDir = await writePlugin(tmpDir, "@a/skill");
    await lifecycle.install(pluginDir);
    await lifecycle.activate("@a/skill");

    const updatedDir = await writePlugin(tmpDir, "@a/skill");
    const updated = await lifecycle.update("@a/skill", updatedDir);

    expect(updated.state).toBe("active");
    const kinds = audit.getEvents().map((e) => e.kind);
    expect(kinds).toContain("plugin.updated");
  });
});
