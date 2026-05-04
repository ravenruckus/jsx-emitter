import { describe, expect, it } from 'vitest';
import { getContextType, hasContext, hasGetContext, hasSetContext } from '../src/internal/context-detect';
import type { JsonComponent } from '../src/types';

const component = (overrides: Partial<JsonComponent> = {}): JsonComponent => ({
  '@type': 'jsx-emitter/component',
  name: 'C',
  imports: [],
  meta: {},
  inputs: [],
  state: {},
  context: { get: {}, set: {} },
  refs: {},
  hooks: { onMount: [], onEvent: [] },
  children: [],
  subComponents: [],
  ...overrides,
});

describe('hasGetContext', () => {
  it('returns false when context.get is empty', () => {
    expect(hasGetContext(component())).toBe(false);
  });

  it('returns true when context.get has entries', () => {
    const c = component({
      context: { get: { Theme: { name: 'Theme', path: 'theme' } }, set: {} },
    });
    expect(hasGetContext(c)).toBe(true);
  });
});

describe('hasSetContext', () => {
  it('returns false when context.set is empty', () => {
    expect(hasSetContext(component())).toBe(false);
  });

  it('returns true when context.set has entries', () => {
    const c = component({
      context: { get: {}, set: { Theme: { name: 'Theme' } } },
    });
    expect(hasSetContext(c)).toBe(true);
  });
});

describe('hasContext', () => {
  it('is true when either get or set is non-empty', () => {
    const cGet = component({
      context: { get: { A: { name: 'A', path: 'a' } }, set: {} },
    });
    const cSet = component({ context: { get: {}, set: { B: { name: 'B' } } } });
    expect(hasContext(cGet)).toBe(true);
    expect(hasContext(cSet)).toBe(true);
  });

  it('is false when both are empty', () => {
    expect(hasContext(component())).toBe(false);
  });
});

describe('getContextType', () => {
  it('reads useMetadata.contextTypes when present', () => {
    const c = component({
      meta: { useMetadata: { contextTypes: { Theme: 'reactive' } } },
    });
    expect(getContextType({ component: c, context: { name: 'Theme', path: 'theme' } })).toBe(
      'reactive',
    );
  });

  it('falls back to context.type when no useMetadata override', () => {
    const c = component();
    expect(
      getContextType({
        component: c,
        context: { name: 'Theme', path: 'theme', type: 'reactive' },
      }),
    ).toBe('reactive');
  });

  it('defaults to "normal" when neither field is set', () => {
    expect(
      getContextType({ component: component(), context: { name: 'Theme', path: 'theme' } }),
    ).toBe('normal');
  });
});
