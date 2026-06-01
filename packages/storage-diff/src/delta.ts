import { compress, decompress } from '@mongodb-js/zstd';
import { diff as myersDiff } from 'fast-myers-diff';
import { Buffer } from 'node:buffer';
import { ZstdError } from './contracts.js';

const OP_EQ = 0x01;
const OP_ADD = 0x02;
const OP_DEL = 0x03;
const OP_END = 0x00;
const ZSTD_LEVEL = 19;

function writeUvarint(out: number[], n: number): void {
  while (n >= 0x80) { out.push((n & 0x7f) | 0x80); n >>>= 7; }
  out.push(n & 0x7f);
}

function readUvarint(buf: Uint8Array, offset: number): { value: number; offset: number } {
  let value = 0;
  let shift = 0;
  let i = offset;
  while (true) {
    const b = buf[i]!;
    i++;
    value |= (b & 0x7f) << shift;
    if ((b & 0x80) === 0) return { value, offset: i };
    shift += 7;
  }
}

function buildOps(base: Uint8Array, target: Uint8Array): number[] {
  const baseStr = Array.from(base);
  const targetStr = Array.from(target);
  const out: number[] = [];
  let bi = 0;
  let ti = 0;
  for (const m of myersDiff(baseStr, targetStr)) {
    const s1 = m[0]!; const e1 = m[1]!; const s2 = m[2]!; const e2 = m[3]!;
    const eqLen = s1 - bi;
    if (eqLen > 0) { out.push(OP_EQ); writeUvarint(out, eqLen); bi += eqLen; ti += eqLen; }
    const delLen = e1 - s1;
    if (delLen > 0) { out.push(OP_DEL); writeUvarint(out, delLen); bi = e1; }
    const addLen = e2 - s2;
    if (addLen > 0) {
      out.push(OP_ADD);
      writeUvarint(out, addLen);
      for (let k = s2; k < e2; k++) out.push(targetStr[k]!);
      ti = e2;
    }
  }
  const tailEq = base.length - bi;
  if (tailEq > 0) { out.push(OP_EQ); writeUvarint(out, tailEq); }
  out.push(OP_END);
  return out;
}

export async function encodeDelta(base: Uint8Array, target: Uint8Array): Promise<Uint8Array> {
  const ops = Uint8Array.from(buildOps(base, target));
  try {
    return new Uint8Array(await compress(Buffer.from(ops), ZSTD_LEVEL));
  } catch (e) {
    throw new ZstdError('compress', e);
  }
}

export async function applyDelta(base: Uint8Array, delta: Uint8Array): Promise<Uint8Array> {
  let ops: Uint8Array;
  try {
    ops = new Uint8Array(await decompress(Buffer.from(delta)));
  } catch (e) {
    throw new ZstdError('decompress', e);
  }
  const out: number[] = [];
  let baseOffset = 0;
  let i = 0;
  while (i < ops.length) {
    const op = ops[i++];
    const op2 = op!;
    if (op2 === OP_END) break;
    const uv = readUvarint(ops, i);
    const n = uv.value;
    i = uv.offset;
    if (op2 === OP_EQ) {
      for (let k = 0; k < n; k++) out.push(base[baseOffset + k]!);
      baseOffset += n;
    } else if (op2 === OP_ADD) {
      for (let k = 0; k < n; k++) out.push(ops[i + k]!);
      i += n;
    } else if (op2 === OP_DEL) {
      baseOffset += n;
    } else {
      throw new Error(`unknown delta op: 0x${op2.toString(16)}`);
    }
  }
  return Uint8Array.from(out);
}

export async function encodeFull(target: Uint8Array): Promise<Uint8Array> {
  try { return new Uint8Array(await compress(Buffer.from(target), ZSTD_LEVEL)); }
  catch (e) { throw new ZstdError('compress', e); }
}

export async function decodeFull(payload: Uint8Array): Promise<Uint8Array> {
  try { return new Uint8Array(await decompress(Buffer.from(payload))); }
  catch (e) { throw new ZstdError('decompress', e); }
}
