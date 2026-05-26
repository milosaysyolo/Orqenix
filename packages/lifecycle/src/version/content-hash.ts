import { createHash } from "node:crypto";

export async function contentHash(files: Map<string, Buffer>): Promise<string> {
  const sorted = [...files.entries()].sort(([a], [b]) => a.localeCompare(b));
  const h = createHash("sha256");
  for (const [path, buf] of sorted) {
    h.update(path);
    h.update("\0");
    h.update(buf);
    h.update("\0");
  }
  return "sha256:" + h.digest("hex");
}
