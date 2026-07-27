import { describe, it, expect } from 'vitest';
import { Button, Card, Badge, Input, cn, tokens } from '../src/index';
describe('@orqenix/ui-primitives', () => {
  it('exports Button', () => { expect(Button).toBeDefined(); });
  it('exports Card', () => { expect(Card).toBeDefined(); });
  it('exports Badge', () => { expect(Badge).toBeDefined(); });
  it('exports Input', () => { expect(Input).toBeDefined(); });
  it('exports cn utility', () => {
    expect(cn).toBeDefined();
    expect(cn('a', 'b')).toBe('a b');
  });
  it('exports tokens', () => {
    expect(tokens).toBeDefined();
    expect(tokens.colors).toBeDefined();
  });
});
