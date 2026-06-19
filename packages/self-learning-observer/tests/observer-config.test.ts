// SPDX-License-Identifier: Apache-2.0
// @orqenix/self-learning-observer , Per-scope config testsimport { describe, it, expect } from 'vitest';
import { DEFAULT_OBSERVER_CONFIG, type ObserverConfig } from '../src/types';
describe('ObserverConfig defaults', () => {  it('has sensible defaults', () => {    expect(DEFAULT_OBSERVER_CONFIG.enabled).toBe(true);    expect(DEFAULT_OBSERVER_CONFIG.piiFilterEnabled).toBe(true);    expect(DEFAULT_OBSERVER_CONFIG.sampleRate).toBe(1.0);    expect(DEFAULT_OBSERVER_CONFIG.notifyOnFirstLaunch).toBe(true);  });});