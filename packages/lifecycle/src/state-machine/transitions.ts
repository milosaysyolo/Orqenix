export type State = "ACTIVE" | "STALE" | "TRASH" | "PURGED";

const valid: Record<State, State[]> = {
  ACTIVE: ["STALE"],
  STALE: ["ACTIVE", "TRASH"],
  TRASH: ["ACTIVE", "PURGED"],
  PURGED: [],
};

export function canTransition(from: State, to: State): boolean {
  return valid[from].includes(to);
}

export function transition(from: State, to: State): State {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid lifecycle transition: ${from} -> ${to}`);
  }
  return to;
}
