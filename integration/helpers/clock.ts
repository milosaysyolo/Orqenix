export interface MockClock {
  now(): number;
  advance(ms: number): void;
  set(t: number): void;
}

export function createClock(initial: number = Date.now()): MockClock {
  let t = initial;
  return {
    now: () => t,
    advance: (ms) => { t += ms; },
    set: (newT) => { t = newT; },
  };
}
