// SPDX-License-Identifier: Apache-2.0
// @orqenix/memory-engine , ULID generator
//
// Universally Unique Lexicographically Sortable Identifier. Used for
// session_id + memory entry id. Time-sortable, monotonic per CR v8.0 Section 4.1.

const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford base32
const ENCODING_LEN = ENCODING.length;
const TIME_LEN = 10;
const RANDOM_LEN = 16;

let lastTime = 0;
let lastRandom: number[] = [];

/** Generates a ULID (time-sortable, 26 chars) */
export function ulid(seedTime?: number): string {
  const now = seedTime ?? Date.now();

  let timeChars: string;
  if (now === lastTime) {
    // Same millisecond: increment random for monotonicity
    lastRandom = incrementRandom(lastRandom);
    timeChars = encodeTime(now);
  } else {
    lastTime = now;
    lastRandom = randomChars();
    timeChars = encodeTime(now);
  }

  return timeChars + lastRandom.map((i) => ENCODING[i]).join("");
}

function encodeTime(now: number): string {
  let mod: number;
  let str = "";
  let t = now;
  for (let i = TIME_LEN - 1; i >= 0; i--) {
    mod = t % ENCODING_LEN;
    str = ENCODING[mod] + str;
    t = (t - mod) / ENCODING_LEN;
  }
  return str;
}

function randomChars(): number[] {
  const arr: number[] = [];
  const bytes = new Uint8Array(RANDOM_LEN);
  globalThis.crypto.getRandomValues(bytes);
  for (let i = 0; i < RANDOM_LEN; i++) {
    arr.push((bytes[i] as number) % ENCODING_LEN);
  }
  return arr;
}

function incrementRandom(arr: number[]): number[] {
  const out = [...arr];
  for (let i = RANDOM_LEN - 1; i >= 0; i--) {
    if (out[i] === ENCODING_LEN - 1) {
      out[i] = 0;
    } else {
      out[i] = (out[i] ?? 0) + 1;
      return out;
    }
  }
  // Overflow: regenerate
  return randomChars();
}
