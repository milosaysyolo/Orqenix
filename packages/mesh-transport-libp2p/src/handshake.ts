import { pipe } from 'it-pipe';
import * as lp from 'it-length-prefixed';
import { Packr, Unpackr } from 'msgpackr';
import type { Stream } from '@libp2p/interface';
import type { ScopeId } from '@orqenix/mesh-transport-core';

const packr = new Packr({ useRecords: false });
const unpackr = new Unpackr({ useRecords: false });

export interface CapabilityHandshakeMessage {
  capability: string;
  fromScope: string;
  toScope: string;
  sig: string;
}

export interface IdentityVerifier {
  verifyScopeSig(
    fromScope: ScopeId,
    nonce: string,
    toScope: ScopeId,
    sigB64u: string,
  ): Promise<boolean>;
}

export class NoopIdentityVerifier implements IdentityVerifier {
  async verifyScopeSig(): Promise<boolean> {
    return true;
  }
}

export type SignFn = (nonce: string, toScope: ScopeId) => Promise<string>;
export const NoopSigner: SignFn = async () => 'noop-signature-placeholder';

export async function performInitiatorHandshake(
  stream: Stream,
  msg: CapabilityHandshakeMessage,
): Promise<CapabilityHandshakeMessage> {
  const out = packr.pack(msg);

  let received: CapabilityHandshakeMessage | undefined;

  await pipe(
    [out],
    lp.encode,
    stream,
    lp.decode,
    async function consume(source: any) {
      for await (const chunk of source) {
        received = unpackr.unpack(chunk.subarray()) as CapabilityHandshakeMessage;
        break;
      }
    },
  );

  if (!received) throw new Error('handshake: peer did not send capability');
  return received;
}

export async function performResponderHandshake(
  stream: Stream,
  ourMsg: CapabilityHandshakeMessage,
  verifier: IdentityVerifier,
): Promise<{ accepted: boolean; peer?: CapabilityHandshakeMessage }> {
  let peer: CapabilityHandshakeMessage | undefined;

  await pipe(
    stream,
    lp.decode,
    async function consume(source: any) {
      for await (const chunk of source) {
        peer = unpackr.unpack(chunk.subarray()) as CapabilityHandshakeMessage;
        break;
      }
    },
  );

  if (!peer) return { accepted: false };

  const ok = await verifier.verifyScopeSig(
    peer.fromScope as ScopeId,
    peer.capability,
    peer.toScope as ScopeId,
    peer.sig,
  );

  await pipe([packr.pack(ourMsg)], lp.encode, stream);

  return { accepted: ok, peer };
}
