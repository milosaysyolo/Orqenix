import { EventEmitter } from 'node:events';
import { CpuThrottle, sleep } from './throttle.js';
import type { HeuristicDistiller } from './distiller.js';
import type { DistillationStats } from './contracts.js';

export type WorkerStatus = 'idle' | 'running' | 'stopping' | 'stopped';

export interface WorkerOptions {
  distiller: HeuristicDistiller;
  cpuLimitPercent?: number;
  measureWindowMs?: number;
  idleSleepMs?: number;
  idleStopRuns?: number;
}

export class DistillerWorker extends EventEmitter {
  status: WorkerStatus = 'idle';
  private readonly distiller: HeuristicDistiller;
  private readonly throttle: CpuThrottle;
  private readonly idleSleepMs: number;
  private readonly idleStopRuns: number;
  private stopRequested = false;

  constructor(opts: WorkerOptions) {
    super();
    this.distiller = opts.distiller;
    this.throttle = new CpuThrottle(opts.cpuLimitPercent ?? 20, opts.measureWindowMs ?? 500);
    this.idleSleepMs = opts.idleSleepMs ?? 250;
    this.idleStopRuns = opts.idleStopRuns ?? 3;
  }

  runOnce(): DistillationStats {
    return this.distiller.distillBatch();
  }

  async start(): Promise<void> {
    if (this.status === 'running') return;
    this.status = 'running';
    this.stopRequested = false;
    this.throttle.reset();
    let consecutiveIdle = 0;

    while (!this.stopRequested) {
      let stats: DistillationStats;
      try {
        stats = this.distiller.distillBatch();
      } catch (e) {
        this.emit('error', e);
        this.status = 'stopped';
        return;
      }
      this.emit('batch', stats);

      if (stats.entriesScanned === 0) {
        consecutiveIdle++;
        this.emit('idle', { consecutiveIdle });
        if (consecutiveIdle >= this.idleStopRuns) break;
        await sleep(this.idleSleepMs);
        continue;
      }
      consecutiveIdle = 0;
      const slept = await this.throttle.checkAndSleep();
      if (slept > 0) stats.throttleSleepMs = slept;
    }

    this.status = 'stopped';
  }

  stop(): void {
    if (this.status === 'running') {
      this.status = 'stopping';
      this.stopRequested = true;
    }
  }
}
