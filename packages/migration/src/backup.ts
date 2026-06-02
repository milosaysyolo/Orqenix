// SPDX-License-Identifier: Apache-2.0
// @bc CS-026 Backup
// @gate G24.1

import { copyFile, mkdir, stat, readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { hashBytes } from '@orqenix/storage-diff';
import { BackupMissingError } from './contracts.js';

export interface BackupMetadata {
  schemaVersion: 1;
  sourcePath: string;
  backupPath: string;
  contentHash: string;
  sizeBytes: number;
  createdAt: string;
}

export async function backupDatabase(sourcePath: string, backupDir: string): Promise<BackupMetadata> {
  await mkdir(backupDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = join(backupDir, `phase-4.${ts}.sqlite.bak`);
  await copyFile(sourcePath, backupPath);

  const bytes = await readFile(backupPath);
  const contentHash = hashBytes(new Uint8Array(bytes));
  const s = await stat(backupPath);
  const metadata: BackupMetadata = {
    schemaVersion: 1, sourcePath, backupPath, contentHash,
    sizeBytes: s.size, createdAt: new Date().toISOString(),
  };
  await writeFile(`${backupPath}.meta.json`, JSON.stringify(metadata, null, 2));
  return metadata;
}

export async function restoreFromBackup(backupPath: string, targetPath: string): Promise<void> {
  try { await stat(backupPath); }
  catch { throw new BackupMissingError(backupPath); }
  await mkdir(dirname(targetPath), { recursive: true });
  await copyFile(backupPath, targetPath);
}

export async function verifyBackup(backupPath: string): Promise<boolean> {
  try {
    const metaRaw = await readFile(`${backupPath}.meta.json`, 'utf-8');
    const meta = JSON.parse(metaRaw) as BackupMetadata;
    const bytes = await readFile(backupPath);
    const computed = hashBytes(new Uint8Array(bytes));
    return computed === meta.contentHash;
  } catch { return false; }
}
