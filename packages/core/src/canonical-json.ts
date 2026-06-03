export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export function canonicalJson(value: unknown): string {
  return stringify(value);
}

function stringify(value: unknown): string {
  if (value === null) return "null";
  switch (typeof value) {
    case "boolean":
      return value ? "true" : "false";
    case "number":
      return stringifyNumber(value);
    case "string":
      return stringifyString(value);
    case "object":
      if (Array.isArray(value)) return stringifyArray(value);
      return stringifyObject(value as Record<string, unknown>);
    default:
      throw new Error(`Cannot canonicalize value of type ${typeof value}`);
  }
}

function stringifyNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error(`Cannot canonicalize non-finite number: ${value}`);
  }
  return JSON.stringify(value);
}

function stringifyString(value: string): string {
  return JSON.stringify(value);
}

function stringifyArray(value: unknown[]): string {
  const items = value.map((item) => stringify(item));
  return `[${items.join(",")}]`;
}

function stringifyObject(value: Record<string, unknown>): string {
  const keys = Object.keys(value).sort();
  const pairs: string[] = [];
  for (const key of keys) {
    const v = value[key];
    if (v === undefined) continue;
    pairs.push(`${JSON.stringify(key)}:${stringify(v)}`);
  }
  return `{${pairs.join(",")}}`;
}

export function parseCanonicalJson(json: string): JsonValue {
  return JSON.parse(json);
}

export function isCanonical(json: string): boolean {
  try {
    const parsed = JSON.parse(json);
    return canonicalJson(parsed) === json;
  } catch {
    return false;
  }
}
