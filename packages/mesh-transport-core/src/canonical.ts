export function canonicalize<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (value instanceof Uint8Array) return value;
  if (Array.isArray(value)) {
    return value.map((v) => canonicalize(v)) as unknown as T;
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const sortedKeys = Object.keys(obj).sort();
    const out: Record<string, unknown> = {};
    for (const k of sortedKeys) {
      out[k] = canonicalize(obj[k]);
    }
    return out as unknown as T;
  }
  return value;
}

export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}