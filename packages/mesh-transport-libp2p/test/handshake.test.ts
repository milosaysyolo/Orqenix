import { describe, it, expect } from 'vitest';
import { NoopIdentityVerifier, type IdentityVerifier } from '../src/handshake.js';

class AlwaysFalse implements IdentityVerifier {
  async verifyScopeSig(): Promise<boolean> { return false; }
}

describe('IdentityVerifier seam', () => {
  it('NoopIdentityVerifier accepts everything', async () => {
    const v = new NoopIdentityVerifier();
    expect(await v.verifyScopeSig()).toBe(true);
  });

  it('AlwaysFalse rejects everything (placeholder for Part 6 negative path)', async () => {
    const v = new AlwaysFalse();
    expect(await v.verifyScopeSig()).toBe(false);
  });
});
