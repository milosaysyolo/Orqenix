// packages/mesh-transport-http/src/identity.ts
/**
 * Identity proof seam. Part 2 ships NO-OP implementations.
 * Agent note: Part 6 (gate G40) replaces these with real Ed25519 signing and verification.
 */
import type { ScopeId } from '@orqenix/mesh-transport-core';

export interface IdentityVerifier {
  verifyScopeSig(
    fromScope: ScopeId,
    requestId: string,
    toScope: ScopeId,
    sigB64u: string,
  ): Promise<boolean>;
}

export class NoopIdentityVerifier implements IdentityVerifier {
  async verifyScopeSig(): Promise<boolean> {
    return true;
  }
}

export type SignFn = (requestId: string, toScope: ScopeId) => Promise<string>;

export const NoopSigner: SignFn = async () => 'noop-signature-placeholder';

/** Always-false verifier for negative tests. */
export class AlwaysFalseIdentityVerifier implements IdentityVerifier {
  async verifyScopeSig(): Promise<boolean> {
    return false;
  }
}
