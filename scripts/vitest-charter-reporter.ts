import type { Reporter, File, Task } from "vitest";

function countTasks(tasks: Task[]): { passed: number; failed: number; skipped: number } {
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  for (const t of tasks) {
    if (t.type === "suite" && t.tasks) {
      const sub = countTasks(t.tasks);
      passed += sub.passed;
      failed += sub.failed;
      skipped += sub.skipped;
    } else if (t.type === "test") {
      const state = t.result?.state;
      if (state === "pass") passed++;
      else if (state === "fail") failed++;
      else if (state === "skip") skipped++;
    }
  }
  return { passed, failed, skipped };
}

export default class CharterReporter implements Reporter {
  onFinished(files: File[] = []) {
    const all = files.flatMap((f) => f.tasks ?? []);
    const { passed, failed, skipped } = countTasks(all);
    console.log(`Tests: ${passed} passed, ${failed} failed, ${skipped} skipped`);
  }
}
