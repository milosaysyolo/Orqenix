export function isValidSha(s: string): boolean {
  return /^[0-9a-f]{40}$/i.test(s);
}

export interface ShaBumpProposal {
  pluginName: string;
  oldSha: string;
  newSha: string;
  ref: string;
}

export function proposeBumps(
  current: Array<{ name: string; sha: string; ref: string }>,
  upstream: Map<string, string>
): ShaBumpProposal[] {
  const out: ShaBumpProposal[] = [];
  for (const c of current) {
    const newSha = upstream.get(c.ref);
    if (!newSha) continue;
    if (!isValidSha(newSha)) continue;
    if (newSha.toLowerCase() === c.sha.toLowerCase()) continue;
    out.push({
      pluginName: c.name,
      oldSha: c.sha,
      newSha,
      ref: c.ref,
    });
  }
  return out;
}
