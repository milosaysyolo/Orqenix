export interface RegistryEntry {
  id: string;
  name: string;
  version: string;
  type: "skill" | "agent" | "team_bundle";
  state: "ACTIVE" | "STALE" | "TRASH" | "PURGED";
  createdAt: string;
  updatedAt: string;
}

export class Registry {
  static async open(dbPath: string): Promise<Registry> {
    return new Registry(dbPath);
  }

  constructor(dbPath: string) {
    void dbPath;
  }

  async add(_entry: Omit<RegistryEntry, "createdAt" | "updatedAt">): Promise<void> {
    return;
  }

  async get(_id: string): Promise<RegistryEntry | null> {
    return null;
  }

  async list(_type?: string): Promise<RegistryEntry[]> {
    return [];
  }

  async update(_id: string, _updates: Partial<RegistryEntry>): Promise<void> {
    return;
  }

  async remove(_id: string): Promise<void> {
    return;
  }

  async checkConflicts(_entry: RegistryEntry): Promise<RegistryEntry[]> {
    return [];
  }
}
