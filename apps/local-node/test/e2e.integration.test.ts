import { describe, it, expect } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { generateEd25519Keypair, exportEd25519PublicKeyRaw } from '@orqenix/transport-security';

const RUN = process.env.SKIP_E2E === '1' ? it.skip : it;
const NODE_BIN = process.execPath;
const BIN = join(__dirname, '..', 'bin', 'orqenix-node.mjs');

async function makeIdentityFiles(dir: string): Promise<{ scopeId: string }> {
  const kp = await generateEd25519Keypair();
  const pubRaw = await exportEd25519PublicKeyRaw(kp.publicKey);
  const seed = new Uint8Array(32).fill(11);
  await mkdir(join(dir, 'identity'), { recursive: true });
  const scopeId = `scp_b3_e2e_11`;
  await writeFile(join(dir, 'identity', 'scope.yaml'), `scope_id: ${scopeId}\npublic_key_b64: "${Buffer.from(pubRaw).toString('base64')}"\n`);
  await writeFile(join(dir, 'identity', 'private.pem'), `-----BEGIN ORQENIX ED25519 SEED-----\n${Buffer.from(seed).toString('base64')}\n-----END ORQENIX ED25519 SEED-----\n`);
  return { scopeId };
}

async function makeTransportsConfig(dir: string): Promise<void> {
  await mkdir(join(dir, 'mesh'), { recursive: true });
  await writeFile(join(dir, 'mesh', 'transports.yaml'), `
transports:
  - kind: http
    enabled: true
    listen: ["http://127.0.0.1:0"]
priority: ["http"]
circuit_breaker:
  failure_threshold: 3
  cooldown_ms: 30000
deadline_default_ms: 5000
`);
}

function spawnNode(dir: string): ChildProcess {
  const env = { ...process.env, NODE_OPTIONS: '--no-warnings' };
  const p = spawn(NODE_BIN, [BIN, 'start', '--config', dir], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  return p;
}

async function waitForLine(proc: ChildProcess, regex: RegExp, timeoutMs = 15_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const lines: string[] = [];
    const onData = (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      lines.push(text);
      const joined = lines.join('');
      const m = regex.exec(joined);
      if (m) {
        proc.stdout?.off('data', onData);
        resolve(m[0]);
      }
    };
    proc.stdout?.on('data', onData);
    const t = setTimeout(() => {
      proc.stdout?.off('data', onData);
      reject(new Error(`Timed out waiting for ${regex}. Captured: ${lines.join('').slice(0, 1000)}`));
    }, timeoutMs);
    proc.once('exit', (code) => {
      clearTimeout(t);
      reject(new Error(`Process exited with code ${code} before expected line`));
    });
  });
}

async function killProc(p: ChildProcess): Promise<void> {
  if (!p.killed) {
    p.kill('SIGINT');
    await new Promise<void>((resolve) => {
      const t = setTimeout(() => { if (!p.killed) p.kill('SIGKILL'); resolve(); }, 2000);
      p.once('exit', () => { clearTimeout(t); resolve(); });
    });
  }
}

describe('Phase 6 e2e', () => {
  RUN('starts a node, prints listening addresses, stops cleanly', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'orqenix-e2e-'));
    try {
      await makeIdentityFiles(dir);
      await makeTransportsConfig(dir);
      const proc = spawnNode(dir);
      try {
        await waitForLine(proc, /\[orqenix-node\] started/, 15_000);
        await waitForLine(proc, /listening on http http:\/\/[\d.]+:\d+/, 5_000);
      } finally {
        await killProc(proc);
      }
      expect(proc.exitCode === 0 || proc.signalCode === 'SIGINT').toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, 30_000);

  RUN('two nodes can both start independently', async () => {
    const dirA = await mkdtemp(join(tmpdir(), 'orqenix-e2e-a-'));
    const dirB = await mkdtemp(join(tmpdir(), 'orqenix-e2e-b-'));
    try {
      await makeIdentityFiles(dirA);
      await makeIdentityFiles(dirB);
      await makeTransportsConfig(dirA);
      await makeTransportsConfig(dirB);
      const procA = spawnNode(dirA);
      const procB = spawnNode(dirB);
      try {
        await Promise.all([
          waitForLine(procA, /\[orqenix-node\] started/, 15_000),
          waitForLine(procB, /\[orqenix-node\] started/, 15_000),
        ]);
      } finally {
        await Promise.all([killProc(procA), killProc(procB)]);
      }
    } finally {
      await rm(dirA, { recursive: true, force: true });
      await rm(dirB, { recursive: true, force: true });
    }
  }, 45_000);
});