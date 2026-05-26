const FENCE_START_RE = /^# >>> orqenix managed \(do not edit\) >>>$/m;

export function applyFencedBlock(original: string, payload: string): string {
  const start = `# >>> orqenix managed (do not edit) >>>`;
  const end = `# <<< orqenix managed <<<`;
  const block = `${start}\n${payload}\n${end}`;
  if (FENCE_START_RE.test(original)) {
    return original.replace(
      /# >>> orqenix managed \(do not edit\) >>>[\s\S]*?# <<< orqenix managed <<</,
      block,
    );
  }
  return original.trimEnd() + "\n\n" + block + "\n";
}

export function removeFencedBlock(content: string): string {
  return content.replace(
    /# >>> orqenix managed \(do not edit\) >>>[\s\S]*?# <<< orqenix managed <<<\n?/,
    "",
  );
}
