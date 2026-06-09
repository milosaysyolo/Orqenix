import { CANONICAL_EVENTS, validateLogEvent, type MeshEventName, type MeshLogEvent, type MeshLogLevel, type MeshStatus } from './schema.js';
import { containsLeak } from './redaction.js';
import type { ScopeId } from '@orqenix/mesh-transport-core';

export type LogSink = (event: MeshLogEvent, serialized: string) => void;

export interface MeshLoggerOptions {
  sink?: LogSink;
  level?: MeshLogLevel;
  now?: () => Date;
  strict?: boolean;
}

const LEVEL_RANK: Record<MeshLogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

export class MeshLogger {
  private readonly sink: LogSink;
  private readonly level: MeshLogLevel;
  private readonly now: () => Date;
  private readonly strict: boolean;

  constructor(opts: MeshLoggerOptions = {}) {
    this.sink = opts.sink ?? defaultSink;
    this.level = opts.level ?? 'info';
    this.now = opts.now ?? (() => new Date());
    this.strict = opts.strict ?? false;
  }

  emit(partial: Omit<MeshLogEvent, 'ts'> & { ts?: string }): void {
    if (LEVEL_RANK[partial.level] < LEVEL_RANK[this.level]) return;
    const event: MeshLogEvent = {
      ...partial,
      ts: partial.ts ?? this.now().toISOString(),
    };

    const errs = validateLogEvent(event);
    if (errs) {
      if (this.strict) throw new Error(`MeshLogger schema violation: ${errs.join('; ')}`);
      return;
    }

    let serialized: string;
    try {
      serialized = JSON.stringify(event);
    } catch {
      return;
    }
    if (containsLeak(serialized)) {
      try {
        this.sink(
          {
            ts: this.now().toISOString(),
            level: 'warn',
            event: 'rpc.denied' as MeshEventName,
            scopeId: event.scopeId,
            transport: event.transport,
            errorCode: 'E_LOG_REDACTION',
          },
          '{"event":"rpc.denied","errorCode":"E_LOG_REDACTION"}',
        );
      } catch { /* ignore */ }
      return;
    }
    try {
      this.sink(event, serialized);
    } catch { /* ignore */ }
  }

  rpcIn(args: { scopeId: ScopeId; transport: string; requestId: string; method: string }): void {
    this.emit({ level: 'info', event: 'rpc.in', ...args });
  }
  rpcOut(args: { scopeId: ScopeId; transport: string; requestId: string; method: string; durationMs: number; status: MeshStatus }): void {
    this.emit({ level: 'info', event: 'rpc.out', ...args });
  }
  rpcDenied(args: { scopeId: ScopeId; transport: string; requestId: string; method?: string; errorCode: string }): void {
    this.emit({ level: 'warn', event: 'rpc.denied', status: 'denied', ...args });
  }
}

function defaultSink(_evt: MeshLogEvent, serialized: string): void {
  console.log(serialized);
}

export function bufferSink(): { events: MeshLogEvent[]; lines: string[]; sink: LogSink } {
  const events: MeshLogEvent[] = [];
  const lines: string[] = [];
  return {
    events, lines,
    sink: (e, s) => { events.push(e); lines.push(s); },
  };
}
