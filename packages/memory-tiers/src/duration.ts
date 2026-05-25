export function parseDuration(d: string | null): number | null {
  if (d === null) return null;
  const m = d.match(/^(\d+)([smhdw])$/);
  if (!m) throw new Error(`Invalid duration: ${d}`);
  const n = Number(m[1]);
  const unit = m[2];
  const mult: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
  };
  return n * mult[unit]!;
}
