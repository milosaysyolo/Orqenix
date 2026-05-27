export interface Lockfile {
  version: number;
  generatedAt: number;
  pins: Record<string, { version: string; sha: string; source: string }>;
}

export function createLockfile(): Lockfile {
  return { version: 1, generatedAt: Date.now(), pins: {} };
}

export function addPin(
  lock: Lockfile,
  name: string,
  version: string,
  sha: string,
  source: string
): void {
  lock.pins[name] = { version, sha, source };
}

export function verifyPin(
  lock: Lockfile,
  name: string,
  expectedSha: string
): boolean {
  const pin = lock.pins[name];
  if (!pin) return false;
  return pin.sha === expectedSha;
}

export function diffLockfiles(
  oldLock: Lockfile,
  newLock: Lockfile
): { added: string[]; removed: string[]; changed: string[] } {
  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];
  for (const name of Object.keys(newLock.pins)) {
    if (!oldLock.pins[name]) added.push(name);
    else if (oldLock.pins[name]!.sha !== newLock.pins[name]!.sha)
      changed.push(name);
  }
  for (const name of Object.keys(oldLock.pins)) {
    if (!newLock.pins[name]) removed.push(name);
  }
  return { added, removed, changed };
}
