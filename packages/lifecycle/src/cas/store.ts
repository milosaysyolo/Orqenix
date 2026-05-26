import { createHash } from "node:crypto";
import { mkdir, writeFile, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

export class CAS {
  constructor(private readonly root: string) {}

  async put(content: Buffer): Promise<string> {
    const hash = createHash("sha256").update(content).digest("hex");
    const dir = join(this.root, hash.slice(0, 2));
    const file = join(dir, hash.slice(2));
    try {
      await stat(file);
    } catch {
      await mkdir(dir, { recursive: true });
      await writeFile(file, content);
    }
    return hash;
  }

  async get(hash: string): Promise<Buffer> {
    return readFile(join(this.root, hash.slice(0, 2), hash.slice(2)));
  }
}
