import { describe, it, expect } from 'vitest';
import { parseScopeYaml, serializeScopeYaml, verifyScopeYamlConsistency } from '../src/scope-yaml';
import { generateKeyPair, serializePublicKey } from '../src/keypair';
import { deriveScopeId } from '../src/scope-id';
import { InvalidScopeYamlError, KeyPairMismatchError, ScopeYamlCorruptError, type ScopeYaml } from '../src/contracts';

async function makeYaml(overrides: Partial<ScopeYaml> = {}): Promise<{ yaml: ScopeYaml; pub: Uint8Array }> {
  const { publicKey } = await generateKeyPair();
  const base: ScopeYaml = {
    schemaVersion: 1,
    scopeId: deriveScopeId(publicKey),
    name: 'my-scope',
    publicKey: serializePublicKey(publicKey),
    createdAt: new Date().toISOString(),
    parentScope: null,
    metadata: {},
  };
  return { yaml: { ...base, ...overrides }, pub: publicKey };
}

describe('scope-yaml', () => {
  it('round-trips through YAML', async () => {
    const { yaml } = await makeYaml();
    const text = serializeScopeYaml(yaml);
    const parsed = parseScopeYaml(text);
    expect(parsed).toEqual(yaml);
  });

  it('preserves canonical key order', async () => {
    const { yaml } = await makeYaml();
    const text = serializeScopeYaml(yaml);
    const order = ['schemaVersion', 'scopeId', 'name', 'publicKey', 'createdAt', 'parentScope', 'metadata'];
    const indices = order.map((k) => text.indexOf(`${k}:`));
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i]).toBeGreaterThan(indices[i - 1]);
    }
  });

  it('rejects non-kebab-case names', async () => {
    const { yaml } = await makeYaml({ name: 'MyScope' });
    expect(() => parseScopeYaml(serializeScopeYaml(yaml))).toThrow(InvalidScopeYamlError);
  });

  it('rejects unknown top-level fields', () => {
    const bad = `schemaVersion: 1
scopeId: scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
name: ok
publicKey: ${'A'.repeat(43)}=
createdAt: '2026-06-01T00:00:00Z'
parentScope: null
extraField: nope
`;
    expect(() => parseScopeYaml(bad)).toThrow(InvalidScopeYamlError);
  });

  it('verifyScopeYamlConsistency passes for matching pair', async () => {
    const { yaml, pub } = await makeYaml();
    expect(() => verifyScopeYamlConsistency(yaml, pub)).not.toThrow();
  });

  it('throws KeyPairMismatchError when publicKey differs', async () => {
    const { yaml } = await makeYaml();
    const other = await generateKeyPair();
    expect(() => verifyScopeYamlConsistency(yaml, other.publicKey)).toThrow(KeyPairMismatchError);
  });

  it('throws ScopeYamlCorruptError when scopeId does not derive from publicKey', async () => {
    const { pub } = await makeYaml();
    const tampered: ScopeYaml = {
      schemaVersion: 1,
      scopeId: 'scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' as any,
      name: 'x',
      publicKey: serializePublicKey(pub),
      createdAt: new Date().toISOString(),
      parentScope: null,
      metadata: {},
    };
    expect(() => verifyScopeYamlConsistency(tampered, pub)).toThrow(ScopeYamlCorruptError);
  });
});
