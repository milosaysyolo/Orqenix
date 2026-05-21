import { blake3 } from "@noble/hashes/blake3";
import { readFile } from "node:fs/promises";

/** BLAKE3 hex hash of a string. */
export function hashString(input: string, len = 16): string {
  const bytes = blake3(input, { dkLen: len });
  return Buffer.from(bytes).toString("hex");
}

/** BLAKE3 hex hash of file contents. */
export async function hashFile(path: string, len = 16): Promise<string> {
  const buf = await readFile(path);
  const bytes = blake3(buf, { dkLen: len });
  return Buffer.from(bytes).toString("hex");
}
