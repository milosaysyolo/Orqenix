export interface CpuMeasurement {
  elapsedMs: number;
  cpuMs: number;
  percent: number;
}

export class CpuThrottle {
  private startTime = process.hrtime.bigint();
  private startUsage = process.cpuUsage();

  constructor(
    public readonly targetPercent: number,
    public readonly measureWindowMs: number = 500,
  ) {
    if (targetPercent <= 0 || targetPercent > 100)
      throw new Error(`invalid targetPercent: ${targetPercent}`);
  }

  reset(): void {
    this.startTime = process.hrtime.bigint();
    this.startUsage = process.cpuUsage();
  }

  measure(): CpuMeasurement {
    const now = process.hrtime.bigint();
    const elapsedMs = Number(now - this.startTime) / 1_000_000;
    const usage = process.cpuUsage(this.startUsage);
    const cpuMs = (usage.user + usage.system) / 1000;
    const percent = elapsedMs > 0 ? (cpuMs / elapsedMs) * 100 : 0;
    return { elapsedMs, cpuMs, percent };
  }

  async checkAndSleep(): Promise<number> {
    const m = this.measure();
    if (m.percent <= this.targetPercent || m.elapsedMs < this.measureWindowMs) {
      return 0;
    }
    const overshoot = m.percent / this.targetPercent - 1;
    const sleepMs = Math.min(Math.max(Math.round(m.cpuMs * overshoot), 1), 5_000);
    await new Promise((res) => setTimeout(res, sleepMs));
    this.reset();
    return sleepMs;
  }
}

export async function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}
