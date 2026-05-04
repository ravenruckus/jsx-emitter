import { describe, expect, it } from 'vitest';
import { createSingleBinding } from '../src/internal/bindings';
import { createNode } from '../src/internal/create-node';
import { checkIfIsClientComponent } from '../src/internal/rsc-detect';
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

describe('checkIfIsClientComponent', () => {
  it('is true when onMount hook is non-empty', () => {
    expect(
      checkIfIsClientComponent(
        component({ hooks: { onMount: [{ code: 'doX()' }], onEvent: [] } }),
      ),
    ).toBe(true);
  });

  it('is true when onUnMount has code', () => {
    expect(
      checkIfIsClientComponent(
        component({ hooks: { onMount: [], onEvent: [], onUnMount: { code: 'cleanup()' } } }),
      ),
    ).toBe(true);
  });

  it('is true when onUpdate is non-empty', () => {
    expect(
      checkIfIsClientComponent(
        component({ hooks: { onMount: [], onEvent: [], onUpdate: [{ code: 'tick()' }] } }),
      ),
    ).toBe(true);
  });

  it('is true when refs is non-empty', () => {
    expect(checkIfIsClientComponent(component({ refs: { r: { argument: '' } } }))).toBe(true);
  });

  it('is true when context.set has entries', () => {
    expect(
      checkIfIsClientComponent(
        component({ context: { get: {}, set: { Theme: { name: 'Theme' } } } }),
      ),
    ).toBe(true);
  });

  it('is true when context.get has entries', () => {
    expect(
      checkIfIsClientComponent(
        component({ context: { get: { Theme: { name: 'Theme', path: 't' } }, set: {} } }),
      ),
    ).toBe(true);
  });

  it('is true when state has a "property" entry (reactive state)', () => {
    expect(
      checkIfIsClientComponent(
        component({ state: { count: { code: '0', type: 'property' } } }),
      ),
    ).toBe(true);
  });

  it('is true when a non-component DOM node has an event binding', () => {
    const tree = createNode({
      name: 'button',
      bindings: { onClick: createSingleBinding({ code: 'go()' }) },
    });
    expect(checkIfIsClientComponent(component({ children: [tree] }))).toBe(true);
  });

  it('is false when only a child component name (Capitalized) has an event binding', () => {
    // Capitalized names are user components — handlers there don't count as DOM listeners.
    const tree = createNode({
      name: 'MyButton',
      bindings: { onClick: createSingleBinding({ code: 'go()' }) },
    });
    expect(checkIfIsClientComponent(component({ children: [tree] }))).toBe(false);
  });

  it('is false for a leaf static component', () => {
    expect(checkIfIsClientComponent(component())).toBe(false);
  });
});
