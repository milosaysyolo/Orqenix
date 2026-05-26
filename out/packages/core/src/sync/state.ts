import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { projectOrqenixDir } from "../util/paths.js";

export interface AgentSyncRecord {
  source: string;
  output: string;
  sourceHash: string;
  outputHash: string;
  team: string;
  teamVersion: string;
}

export interface SyncStateFile {
  version: "1.0";
  lastSync: string;
  agents: Record<string, AgentSyncRecord>;
}

export class SyncState {
  private state: SyncStateFile;
  constructor(private readonly path: string) {
    this.state = { version: "1.0", lastSync: "", agents: {} };
  }

  static forProject(projectRoot: string): SyncState {
    return new SyncState(join(projectOrqenixDir(projectRoot), "sync", "agents.json"));
  }

  async load(): Promise<void> {
    if (!existsSync(this.path)) return;
    const raw = await readFile(this.path, "utf-8");
    try {
      this.state = JSON.parse(raw) as SyncStateFile;
    } catch {
      // corrupt; start fresh
    }
  }

  async save(): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    this.state.lastSync = new Date().toISOString();
    await writeFile(this.path, JSON.stringify(this.state, null, 2), "utf-8");
  }

  get(agentName: string): AgentSyncRecord | undefined {
    return this.state.agents[agentName];
  }

  set(agentName: string, record: AgentSyncRecord): void {
    this.state.agents[agentName] = record;
  }

  remove(agentName: string): void {
    delete this.state.agents[agentName];
  }

  all(): Record<string, AgentSyncRecord> {
    return this.state.agents;
  }
}
