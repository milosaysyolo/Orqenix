// SPDX-License-Identifier: Apache-2.0
// ============================================================================
// ACTIVITY ENGINE — synthetic event generator that drives the live UI.
//
// Upgraded from the original:
//  - Emits CORRELATED chains (session.started → query stages → subagent.spawned
//    → agent.message → subagent.returned) so agent-network pulses are
//    directional/targeted, not random.
//  - Honors ORQENIX_ACTIVITY: "off" disables it, "rich" emits the fuller chain,
//    anything else (default) emits the lighter 6-stage cycle.
// ============================================================================

import { eventBus } from './event-bus';

const STAGES = ['recall', 'distill', 'sign', 'rerank', 'inject', 'send'] as const;

const PROMPTS: readonly string[] = [
  'how does our JWT refresh flow handle rotation?',
  'where do we store refresh tokens and why?',
  'what changed in the billing decision last week?',
  'summarize the auth module test failures',
  'which middleware validates capability tokens?',
];

const SUBAGENTS: readonly string[] = ['researcher', 'coder', 'tester', 'planner'];

function metric(stage: string): string {
  switch (stage) {
    case 'recall': return `${640 + Math.floor(Math.random() * 200)} cand · ${220 + Math.floor(Math.random() * 80)}ms`;
    case 'distill': return `${1100 + Math.floor(Math.random() * 300)}→${110 + Math.floor(Math.random() * 40)} tok`;
    case 'sign': return `Ed25519 · ${6 + Math.floor(Math.random() * 4)}`;
    case 'rerank': return `top 0.${88 + Math.floor(Math.random() * 11)}`;
    case 'inject': return `${3800 + Math.floor(Math.random() * 600)}/8192`;
    case 'send': return 'opus · stream';
    default: return '—';
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __orqenixActivity: { timer: ReturnType<typeof setInterval>; refs: number } | undefined;
}

export function startActivity(): () => void {
  const mode = process.env.ORQENIX_ACTIVITY;
  if (mode === 'off') return () => {};

  if (globalThis.__orqenixActivity) {
    globalThis.__orqenixActivity.refs += 1;
    return makeStop();
  }

  const rich = mode === 'rich';
  let stageIdx = 0;
  let rid = '#' + Math.floor(1000 + Math.random() * 9000);
  let prompt = PROMPTS[0]!;
  let tick = 0;
  let sessionCid: string | undefined;
  const spawned: string[] = [];

  eventBus.emit({ kind: 'runtime.ready', payload: { mode: rich ? 'rich' : 'lite' } });

  const timer = setInterval(() => {
    const baseTs = new Date().toISOString();

    if (stageIdx === 0) {
      rid = '#' + Math.floor(1000 + Math.random() * 9000);
      prompt = PROMPTS[tick % PROMPTS.length]!;
      tick++;
      sessionCid = `sess_${rid}`;
      spawned.length = 0;
      eventBus.emit({
        kind: 'session.started', correlationId: sessionCid, actor: 'lead',
        payload: { rid, prompt, lead: 'claude-code' },
        ts: baseTs,
      });
    }

    const stage = STAGES[stageIdx]!;
    const sid = sessionCid ?? `sess_${rid}`;
    const stageEvt = eventBus.emit({
      kind: 'query.stage', correlationId: sid, actor: 'lead',
      payload: { stage, metric: metric(stage), prompt, rid },
      ts: baseTs,
    });

    if (rich) {
      // Spawn subagents mid-pipeline and send them messages.
      if ((stage === 'recall' || stage === 'rerank') && spawned.length < SUBAGENTS.length) {
        const name = SUBAGENTS[spawned.length % SUBAGENTS.length]!;
        spawned.push(name);
        const sub = `sub_${name}`;
        eventBus.emit({
          kind: 'subagent.spawned', correlationId: sid, parentId: stageEvt.id, actor: name,
          payload: { agent: name, sub, role: name },
        });
      }
      if (stage === 'inject' || stage === 'send') {
        const target = spawned[Math.floor(Math.random() * Math.max(1, spawned.length))];
        if (target) {
          eventBus.emit({
            kind: 'agent.message', correlationId: sid, parentId: stageEvt.id, actor: target,
            payload: { agent: target, to: 'lead', step: tick, snippet: 'analyzing recall set' },
          });
        }
      }
      if (stage === 'send' && spawned.length > 0) {
        const ret = spawned[0]!;
        eventBus.emit({
          kind: 'subagent.returned', correlationId: sid, parentId: stageEvt.id, actor: ret,
          payload: { agent: ret, ok: true, tokens: 120 + Math.floor(Math.random() * 80) },
        });
      }
    } else {
      // Lite mode: a single agent.message on even stages, no targeting.
      if (stageIdx % 2 === 0) {
        eventBus.emit({
          kind: 'agent.message', correlationId: sid, parentId: stageEvt.id, actor: 'claude-code',
          payload: { agent: 'claude-code', step: tick },
        });
      }
    }

    stageIdx = (stageIdx + 1) % STAGES.length;
    if (stageIdx === 0) {
      eventBus.emit({
        kind: 'session.ended', correlationId: sid, actor: 'lead',
        payload: { rid, ok: true },
      });
    }
  }, rich ? 700 : 600);

  globalThis.__orqenixActivity = { timer, refs: 1 };
  return makeStop();
}

function makeStop(): () => void {
  return () => {
    const a = globalThis.__orqenixActivity;
    if (!a) return;
    a.refs -= 1;
    if (a.refs <= 0) {
      clearInterval(a.timer);
      globalThis.__orqenixActivity = undefined;
    }
  };
}
