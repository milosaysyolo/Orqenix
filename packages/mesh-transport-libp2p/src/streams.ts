import { pipe } from 'it-pipe';
import * as lp from 'it-length-prefixed';
import {
  decodeResponse,
  encodeRequest,
  encodeResponse,
  decodeRequest,
  type MeshRequest,
  type MeshResponse,
} from '@orqenix/mesh-transport-core';
import type { Stream } from '@libp2p/interface';

export async function sendRequestOverStream(stream: Stream, req: MeshRequest): Promise<MeshResponse> {
  const body = encodeRequest(req);
  let resp: MeshResponse | undefined;

  await pipe(
    [body],
    lp.encode,
    stream,
    lp.decode,
    async function consume(source: any) {
      for await (const chunk of source) {
        resp = decodeResponse(chunk.subarray());
        break;
      }
    },
  );

  if (!resp) throw new Error('stream: no response from peer');
  return resp;
}

export async function handleRequestStream(
  stream: Stream,
  handler: (req: MeshRequest) => Promise<MeshResponse>,
): Promise<void> {
  let req: MeshRequest | undefined;

  await pipe(
    stream,
    lp.decode,
    async function consume(source: any) {
      for await (const chunk of source) {
        req = decodeRequest(chunk.subarray());
        break;
      }
    },
  );

  if (!req) return;

  const resp = await handler(req);
  await pipe([encodeResponse(resp)], lp.encode, stream);
}
