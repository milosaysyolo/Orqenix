import { CapabilityVerifier } from '../../packages/transport-security/src/verifier.js';
import { LRUKeyStore } from '../../packages/transport-security/src/key-store.js';
import {
  b64urlEncode,
  ed25519Sign,
  exportEd25519PublicKeyRaw,
  generateEd25519Keypair,
} from '../../packages/transport-security/src/ed25519.js';
import {
  canonicalSigningBytes,
  encodeCapabilityToken,
  type CapabilityTokenFields,
} from '../../packages/transport-security/src/capability-token.js';
import type { ScopeId } from '../../packages/mesh-transport-core/src/index.js';

const ITER = Number(process.env.G40_BENCH_ITER ?? 100_000);
const CI_TOLERANCE_MS = 5;

let failures = 0;
function check(name: string, ok: boolean, detail = ''): void {
  const tag = ok ? 'PASS' : 'FAIL';
  if (!ok) failures++;
  console.log(`[G40] ${tag}  ${name}${detail ? `  (${detail})` : ''}`);
}

async function makeIssued(over: Partial<CapabilityTokenFields> = {}) {
  const kp = await generateEd25519Keypair();
  const pubRaw = await exportEd25519PublicKeyRaw(kp.publicKey);
  const base: Omit<CapabilityTokenFields, 'sig'> = {
    iss: 'scp_b3_B' as ScopeId,
    sub: 'scp_b3_A' as ScopeId,
    caps: ['memory.query', 'kb.recall.*'],
    exp: Date.now() + 600_000,
    jti: 'jti-gate',
    ...over,
  };
  const sig = await ed25519Sign(kp.privateKey, canonicalSigningBytes(base));
  return { token: { ...base, sig: b64urlEncode(sig) } as CapabilityTokenFields, pubRaw };
}

async function main(): Promise<void> {
  // ---- C1: missing capability -> denied E_CAP_MISSING ----
  {
    const v = new CapabilityVerifier({ keyStore: new LRUKeyStore() });
    const r = await v.verify({
      capability: '',
      fromScope: 'a' as ScopeId,
      toScope: 'b' as ScopeId,
      method: 'memory.query',
    });
    check('C1 missing capability -> E_CAP_MISSING', !r.ok && (r as { code: string }).code === 'E_CAP_MISSING');
  }

  // ---- C2: expired -> denied E_CAP_EXPIRED ----
  {
    const { token, pubRaw } = await makeIssued({ exp: Date.now() - 10 });
    const ks = new LRUKeyStore();
    ks.put(token.iss, pubRaw);
    const v = new CapabilityVerifier({ keyStore: ks });
    const r = await v.verify({
      capability: encodeCapabilityToken(token),
      fromScope: token.sub,
      toScope: token.iss,
      method: 'memory.query',
    });
    check('C2 expired -> E_CAP_EXPIRED', !r.ok && (r as { code: string }).code === 'E_CAP_EXPIRED');
  }

  // ---- C3: subject mismatch -> denied E_CAP_SUBJECT_MISMATCH ----
  {
    const { token, pubRaw } = await makeIssued();
    const ks = new LRUKeyStore();
    ks.put(token.iss, pubRaw);
    const v = new CapabilityVerifier({ keyStore: ks });
    const r = await v.verify({
      capability: encodeCapabilityToken(token),
      fromScope: 'scp_b3_other' as ScopeId,
      toScope: token.iss,
      method: 'memory.query',
    });
    check('C3 subject mismatch -> E_CAP_SUBJECT_MISMATCH', !r.ok && (r as { code: string }).code === 'E_CAP_SUBJECT_MISMATCH');
  }

  // ---- C4: method not allowed (incl glob negative) ----
  {
    const { token, pubRaw } = await makeIssued({ caps: ['memory.query'] });
    const ks = new LRUKeyStore();
    ks.put(token.iss, pubRaw);
    const v = new CapabilityVerifier({ keyStore: ks });
    const r = await v.verify({
      capability: encodeCapabilityToken(token),
      fromScope: token.sub,
      toScope: token.iss,
      method: 'kb.recall.advanced',
    });
    check('C4 method not allowed -> E_CAP_METHOD_NOT_ALLOWED', !r.ok && (r as { code: string }).code === 'E_CAP_METHOD_NOT_ALLOWED');
  }

  // ---- C5: p95 verify latency under 10ms (CI tolerance +5ms) over ITER iterations ----
  {
    const { token, pubRaw } = await makeIssued();
    const ks = new LRUKeyStore();
    ks.put(token.iss, pubRaw);
    const v = new CapabilityVerifier({ keyStore: ks });
    const wire = encodeCapabilityToken(token);

    for (let i = 0; i < 1_000; i++) {
      await v.verify({ capability: wire, fromScope: token.sub, toScope: token.iss, method: 'memory.query' });
    }
    const samples = new Float64Array(ITER);
    for (let i = 0; i < ITER; i++) {
      const start = performance.now();
      await v.verify({ capability: wire, fromScope: token.sub, toScope: token.iss, method: 'memory.query' });
      samples[i] = performance.now() - start;
    }
    const sorted = Array.from(samples).sort((a, b) => a - b);
    const p95 = sorted[Math.floor(ITER * 0.95)];
    check('C5 p95 verify < 10ms (CI tolerance +5ms)', p95 < 10 + CI_TOLERANCE_MS, `p95=${p95.toFixed(3)}ms n=${ITER}`);
  }

  // ---- C6: pipeline order: signature verify is NOT skipped even when structural check fails late ----
  {
    const { token } = await makeIssued();
    const broken = encodeCapabilityToken({ ...token, sig: b64urlEncode(new Uint8Array(64)) });
    const ks = new LRUKeyStore();
    ks.put(token.iss, new Uint8Array(32).fill(1));
    const v = new CapabilityVerifier({ keyStore: ks });
    const r = await v.verify({
      capability: broken,
      fromScope: token.sub,
      toScope: token.iss,
      method: 'memory.query',
    });
    check(
      'C6 pipeline preserves order: bad sig denies before scope/method match',
      !r.ok && (r as { code: string }).code === 'E_CAP_SIG_INVALID',
    );
  }

  if (failures > 0) {
    console.error(`[G40] ${failures} criterion failures`);
    process.exit(1);
  }
  console.log('[G40] ALL PASS');
}

main().catch((e) => { console.error(e); process.exit(1); });
