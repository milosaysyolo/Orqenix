import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { createWorkspace, type WorkspaceContext } from "../helpers/workspace.js";

let ws: WorkspaceContext;
let teamSourceDir: string;

const TEAM_JSON = {
  name: "test-team",
  version: "1.0.0",
  namingPrefix: "test-team",
  teamLead: { role: "main", file: "agents/main.md" },
  agents: { core: [{ role: "main", file: "agents/main.md" }], optional: [] },
  syncTargets: { opencode: { enabled: true, outputDir: ".opencode/agents" } },
};

beforeAll(async () => {
  ws = await createWorkspace();
  await ws.cli(["init", "--yes"]);
  teamSourceDir = join(ws.dir, "team-source");
  await mkdir(join(teamSourceDir, "agents"), { recursive: true });
  await writeFile(join(teamSourceDir, "agents", "main.md"), "# Test Agent\nActs as a test assistant.");
  await writeFile(join(teamSourceDir, "team.json"), JSON.stringify(TEAM_JSON));
  // Install team for subsequent tests
  await ws.cli(["team", "install", "--force", teamSourceDir]);
});

afterAll(async () => { await ws.cleanup(); });

describe("E2E 05 marketplace install flow", () => {
  it("team validate succeeds on installed team", async () => {
    const r = await ws.cli(["team", "validate", "test-team"]);
    expect(r.exitCode).toBe(0);
  });


});
