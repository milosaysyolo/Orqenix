import { mkdir, writeFile, readFile, readdir, access, rename } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { z } from 'zod';
import { SCOPE_ID_PATTERN } from '@orqenix/scope-identity';
import {
  type TokenId,
  TOKEN_ID_PATTERN,
  TokenRevokedError,
} from './contracts.js';

export const RevocationRecordSchema = z.object({
  schemaVersion: z.literal(1),
  jti: z.string().regex(TOKEN_ID_PATTERN),
  reason: z.string().min(1).max(512),
  revokedBy: z.string().regex(SCOPE_ID_PATTERN),
  revokedAt: z.string().datetime({ offset: true }),
}).strict();
export type RevocationRecord = z.infer<typeof RevocationRecordSchema>;

const REVOCATION_DIR = '.orqenix/revocations';

async function fileExists(p: string): Promise<boolean> {
  try { await access(p); return true; } catch { return false; }
}

export class RevocationStore {
  private readonly dir: string;

  constructor(rootDir: string) {
    this.dir = join(rootDir, REVOCATION_DIR);
  }

  private pathFor(jti: TokenId): string {
    if (!TOKEN_ID_PATTERN.test(jti)) throw new Error(`invalid jti: ${jti}`);
    return join(this.dir, `${jti.replace(':', '_')}.json`);
  }

  async revoke(jti: TokenId, reason: string, revokedBy: string): Promise<RevocationRecord> {
    if (!TOKEN_ID_PATTERN.test(jti)) throw new Error(`invalid jti: ${jti}`);
    const record: RevocationRecord = {
      schemaVersion: 1,
      jti,
      reason,
      revokedBy,
      revokedAt: new Date().toISOString(),
    };
    RevocationRecordSchema.parse(record);
    const path = this.pathFor(jti);
    await mkdir(dirname(path), { recursive: true });
    const tmp = `${path}.${Date.now()}.tmp`;
    await writeFile(tmp, JSON.stringify(record, null, 2) + '\n', { mode: 0o644 });
    await rename(tmp, path);
    return record;
  }

  async isRevoked(jti: TokenId): Promise<boolean> {
    return fileExists(this.pathFor(jti));
  }

  async getRevocation(jti: TokenId): Promise<RevocationRecord | null> {
    const path = this.pathFor(jti);
    if (!(await fileExists(path))) return null;
    const raw = await readFile(path, 'utf-8');
    return RevocationRecordSchema.parse(JSON.parse(raw));
  }

  async listRevocations(): Promise<RevocationRecord[]> {
    if (!(await fileExists(this.dir))) return [];
    const files = await readdir(this.dir);
    const records: RevocationRecord[] = [];
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      try {
        const raw = await readFile(join(this.dir, f), 'utf-8');
        records.push(RevocationRecordSchema.parse(JSON.parse(raw)));
      } catch {
        // skip malformed entries
      }
    }
    return records.sort((a, b) => a.revokedAt.localeCompare(b.revokedAt));
  }

  async requireNotRevoked(jti: TokenId): Promise<void> {
    if (await this.isRevoked(jti)) throw new TokenRevokedError(jti);
  }
}
