import { describe, it, expect } from 'vitest';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startLocalNode } from '../src/node.js';
import { loadTransportsConfig } from '../src/config.js';
import { AddressBook } from '../src/address-book.js';
import { loadLocalIdentity } from '../src/identity-loader.js';
import { exportEd25519PublicKeyRaw, generateEd25519Keypair } from '@orqenix/transport-security';
import type { MeshRequest, MeshResponse, TransportCtx } from '@orqenix/mesh-transport-core';

async function writeIdentity(dir: string): Promise<void> {
  const kp = await generateEd25519Keypair();
  const pubRaw = await exportEd25519PublicKeyRaw(kp.publicKey);
  const seed = new Uint8Array(32).fill(11);
  await mkdir(join(dir, 'identity'), { recursive: true });
  await writeFile(join(dir, 'identity', 'scope.yaml'), `scope_id: scp_b3_node_test\npublic_key_b64: "${Buffer.from(pubRaw).toString('base64')}"\n`);
  await writeFile(
    join(dir, 'identity', 'private.pem'),
    `-----BEGIN ORQENIX ED25519 SEED-----\n${Buffer.from(seed).toString('base64')}\n-----END ORQENIX ED25519 SEED-----\n`,
  );
}

async function writeMesh(dir: string): Promise<void> {
  await mkdir(join(dir, 'mesh'), { recursive: true });
  await writeFile(join(dir, 'mesh', 'transports.yaml'), `
transports:
  - kind: http
    enabled: true
    listen: ["http://127.0.0.1:0"]
priority:
  - http
circuit_breaker:
  failure_threshold: 3
  cooldown_ms: 30000
deadline_default_ms: 5000
`);
}

describe('startLocalNode', () => {
  it('starts the node, exposes status, and stops cleanly (HTTP only)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'orqenix-node-'));
    try {
      await writeIdentity(dir);
      await writeMesh(dir);

      const config = await loadTransportsConfig(join(dir, 'mesh', 'transports.yaml'));
      const identity = await loadLocalIdentity(join(dir, 'identity', 'scope.yaml'), join(dir, 'identity', 'private.pem'));
      const addressBook = new AddressBook();
      const handler = async (req: MeshRequest, _ctx: TransportCtx): Promise<MeshResponse> => ({ id: req.id, status: 'ok' });

      const rt = await startLocalNode({ identity, config, addressBook, handler });
      const status = rt.status();
      expect(status.scopeId).toBe('scp_b3_node_test');
      expect(status.transports.some((t) => t.kind === 'http')).toBe(true);
      await rt.stop();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
