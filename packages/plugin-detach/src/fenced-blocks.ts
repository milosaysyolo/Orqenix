const FENCE_START = "<!-- orqenix:start -->";
const FENCE_END = "<!-- orqenix:end -->";

export function wrapFenced(content: string): string {
  return `${FENCE_START}\n${content}\n${FENCE_END}`;
}

export function extractFenced(source: string): string | null {
  const start = source.indexOf(FENCE_START);
  const end = source.indexOf(FENCE_END);
  if (start === -1 || end === -1 || end < start) return null;
  return source.slice(start + FENCE_START.length, end).trim();
}

export function removeFenced(source: string): string {
  const start = source.indexOf(FENCE_START);
  const end = source.indexOf(FENCE_END);
  if (start === -1 || end === -1) return source;
  return (
    source.slice(0, start).replace(/\n+$/, "") +
    "\n" +
    source.slice(end + FENCE_END.length).replace(/^\n+/, "")
  );
}

export function replaceFenced(source: string, replacement: string): string {
  const start = source.indexOf(FENCE_START);
  const end = source.indexOf(FENCE_END);
  if (start === -1 || end === -1) {
    return source + "\n" + wrapFenced(replacement) + "\n";
  }
  return (
    source.slice(0, start) +
    wrapFenced(replacement) +
    source.slice(end + FENCE_END.length)
  );
}
