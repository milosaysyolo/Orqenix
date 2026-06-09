// packages/mesh-transport-core/test/state-machine.test.ts
import { describe, it, expect } from 'vitest';
import { TransportLifecycle, type TransportState } from '../src/state-machine.js';
import { IllegalStateError } from '../src/errors.js';

const ALL: TransportState[] = ['Created', 'Starting', 'Running', 'Stopping', 'Stopped', 'Failed'];

function driveTo(state: TransportState): TransportLifecycle {
  const lc = new TransportLifecycle();
  if (state === 'Starting') lc.transition('Starting');
  else if (state === 'Running') { lc.transition('Starting'); lc.transition('Running'); }
  else if (state === 'Stopping') { lc.transition('Starting'); lc.transition('Running'); lc.transition('Stopping'); }
  else if (state === 'Stopped') { lc.transition('Starting'); lc.transition('Running'); lc.transition('Stopping'); lc.transition('Stopped'); }
  else if (state === 'Failed') { lc.transition('Starting'); lc.transition('Failed'); }
  return lc;
}

describe('TransportLifecycle', () => {
  it('starts in Created', () => {
    const lc = new TransportLifecycle();
    expect(lc.state).toBe('Created');
  });

  it('allows Created -> Starting -> Running -> Stopping -> Stopped', () => {
    const lc = new TransportLifecycle();
    lc.transition('Starting');
    lc.transition('Running');
    lc.transition('Stopping');
    lc.transition('Stopped');
    expect(lc.state).toBe('Stopped');
  });

  it('throws on every illegal cell', () => {
    const legal: Record<TransportState, TransportState[]> = {
      Created: ['Starting', 'Stopped'],
      Starting: ['Running', 'Failed', 'Stopping'],
      Running: ['Stopping', 'Failed'],
      Stopping: ['Stopped'],
      Stopped: ['Starting'],
      Failed: ['Stopping'],
    };
    for (const from of ALL) {
      for (const to of ALL) {
        if (legal[from].includes(to)) continue;
        const lc = new TransportLifecycle();
        // Drive to `from`
        try {
          if (from === 'Starting') lc.transition('Starting');
          else if (from === 'Running') { lc.transition('Starting'); lc.transition('Running'); }
          else if (from === 'Stopping') { lc.transition('Starting'); lc.transition('Running'); lc.transition('Stopping'); }
          else if (from === 'Stopped') { lc.transition('Starting'); lc.transition('Running'); lc.transition('Stopping'); lc.transition('Stopped'); }
          else if (from === 'Failed') { lc.transition('Starting'); lc.transition('Failed'); }
        } catch { /* unreachable for legal paths above */ }
        expect(() => lc.transition(to)).toThrow(IllegalStateError);
      }
    }
  });

  it('assertCanSend throws unless Running', () => {
    const lc = new TransportLifecycle();
    expect(() => lc.assertCanSend()).toThrow(IllegalStateError);
    lc.transition('Starting');
    lc.transition('Running');
    expect(() => lc.assertCanSend()).not.toThrow();
  });

  it('assertCanStart is idempotent on Running', () => {
    const lc = new TransportLifecycle();
    lc.transition('Starting');
    lc.transition('Running');
    expect(lc.assertCanStart()).toBe(false);
  });

  it('assertCanStart throws in Stopping and Failed states', () => {
    expect(() => driveTo('Stopping').assertCanStart()).toThrow(IllegalStateError);
    expect(() => driveTo('Failed').assertCanStart()).toThrow(IllegalStateError);
  });

  it('assertCanRegisterHandler throws in Stopping state', () => {
    const lc = driveTo('Stopping');
    expect(() => lc.assertCanRegisterHandler()).toThrow(IllegalStateError);
  });

  it('assertCanRegisterHandler does not throw in Running state', () => {
    const lc = driveTo('Running');
    expect(() => lc.assertCanRegisterHandler()).not.toThrow();
  });
});
