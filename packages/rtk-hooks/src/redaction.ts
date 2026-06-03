export function redact(input: string, patterns: string[]): string {
  let out = input;
  for (const p of patterns) {
    try {
      const flags = p.startsWith('(?i)') ? 'gi' : 'g';
      const body = p.startsWith('(?i)') ? p.slice(4) : p;
      const rx = new RegExp(body, flags);
      out = out.replace(rx, '<REDACTED>');
    } catch { /* skip invalid pattern */ }
  }
  return out;
}
