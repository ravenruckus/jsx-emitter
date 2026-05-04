import { describe, expect, it } from 'vitest';
import { componentToReact } from '../src/generator';
import { createSingleBinding } from '../src/internal/bindings';
import { createNode } from '../src/internal/create-node';
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

const compile = (
  c: JsonComponent,
  opts: Parameters<typeof componentToReact>[0] = {},
) => componentToReact({ prettier: false, ...opts })({ component: c });

describe('componentToReact — entry shape', () => {
  it('returns a transpiler function', () => {
    expect(typeof componentToReact()).toBe('function');
  });

  it('emits a default React import for a trivial component', () => {
    const out = compile(
      component({ name: 'Hello', children: [createNode({ name: 'div' })] }),
    );
    expect(out).toContain("import * as React from 'react'");
  });

  it('emits a function declaration with the component name', () => {
    const out = compile(
      component({ name: 'Hello', children: [createNode({ name: 'div' })] }),
    );
    expect(out).toContain('function Hello(');
  });

  it('emits a default export for the component', () => {
    const out = compile(
      component({ name: 'Hello', children: [createNode({ name: 'div' })] }),
    );
    expect(out).toContain('export default Hello;');
  });

  it('falls back to MyComponent when no name is set', () => {
    const out = compile(component({ name: '', children: [createNode({ name: 'div' })] }));
    expect(out).toContain('function MyComponent(');
    expect(out).toContain('export default MyComponent;');
  });
});

describe('componentToReact — useState wiring', () => {
  it('emits useState() for property-typed state and registers the import', () => {
    const out = compile(
      component({
        name: 'Counter',
        state: { count: { code: '0', type: 'property' } },
        children: [createNode({ name: 'div' })],
      }),
    );
    expect(out).toContain('useState');
    expect(out).toContain('const [count, setCount]');
    expect(out).toMatch(/from\s+['"]react['"]/);
  });

  it('does not emit useState when stateType is variables', () => {
    const out = compile(
      component({
        name: 'C',
        state: { x: { code: '1', type: 'property' } },
        children: [createNode({ name: 'div' })],
      }),
      { stateType: 'variables' },
    );
    expect(out).not.toContain('useState');
    expect(out).toMatch(/const\s+x\s*=\s*1/);
  });
});

describe('componentToReact — forwardRef', () => {
  it('wraps the component in forwardRef when meta.useMetadata.forwardRef is set', () => {
    const out = compile(
      component({
        name: 'Boxed',
        meta: { useMetadata: { forwardRef: 'fr' } },
        children: [createNode({ name: 'div' })],
      }),
    );
    expect(out).toContain('forwardRef');
    expect(out).toMatch(/const Boxed = forwardRef\b/);
  });

  it('does not import forwardRef when no ref is being forwarded', () => {
    const out = compile(component({ name: 'C', children: [createNode({ name: 'div' })] }));
    expect(out).not.toMatch(/import\s*\{[^}]*forwardRef[^}]*\}\s*from\s*['"]react['"]/);
  });
});

describe('componentToReact — RSC use-client directive', () => {
  it('adds "use client" when the component has client-only behavior (state)', () => {
    const out = compile(
      component({
        name: 'C',
        state: { x: { code: '0', type: 'property' } },
        children: [createNode({ name: 'div' })],
      }),
    );
    expect(out).toContain("'use client'");
  });

  it('omits "use client" for a static component with no client-only behavior', () => {
    const out = compile(component({ name: 'C', children: [createNode({ name: 'div' })] }));
    expect(out).not.toContain("'use client'");
  });

  it('omits "use client" when type is native', () => {
    const out = compile(
      component({
        name: 'C',
        state: { x: { code: '0', type: 'property' } },
        children: [createNode({ name: 'div' })],
      }),
      { stylesType: 'react-native', type: 'native' },
    );
    expect(out).not.toContain("'use client'");
  });

  it('omits "use client" when addUseClientDirectiveIfNeeded is false', () => {
    const out = compile(
      component({
        name: 'C',
        state: { x: { code: '0', type: 'property' } },
        children: [createNode({ name: 'div' })],
      }),
      { addUseClientDirectiveIfNeeded: false },
    );
    expect(out).not.toContain("'use client'");
  });
});

describe('componentToReact — useEffect wiring', () => {
  it('emits useEffect for onMount and registers the import', () => {
    const out = compile(
      component({
        name: 'C',
        hooks: { onMount: [{ code: 'console.log("hi")' }], onEvent: [] },
        children: [createNode({ name: 'div' })],
      }),
    );
    expect(out).toContain('useEffect');
    expect(out).toMatch(/import\s*\{[^}]*useEffect[^}]*\}\s*from\s*['"]react['"]/);
  });
});

describe('componentToReact — option-stripping regression guards', () => {
  it('never emits mobx-flavored helpers', () => {
    const out = compile(
      component({
        name: 'C',
        state: { x: { code: '0', type: 'property' } },
        children: [createNode({ name: 'div' })],
      }),
    );
    expect(out).not.toMatch(/useLocalProxy|useLocalObservable|useMutable|observer\(|useBuilderState/);
  });

  it('never emits styled-components or emotion imports', () => {
    const out = compile(
      component({
        name: 'C',
        children: [
          createNode({
            name: 'div',
            bindings: { css: createSingleBinding({ code: '{ color: "red" }' }) },
          }),
        ],
      }),
    );
    expect(out).not.toContain("from 'styled-components'");
    expect(out).not.toContain("@emotion/react");
  });

  it('never emits preact/hooks import path', () => {
    const out = compile(
      component({
        name: 'C',
        state: { x: { code: '0', type: 'property' } },
        children: [createNode({ name: 'div' })],
      }),
    );
    expect(out).not.toContain('preact/hooks');
  });
});

describe('componentToReact — subcomponents', () => {
  it('emits subcomponent code after the main component, joined by blank lines', () => {
    const sub = component({
      name: 'Sub',
      children: [createNode({ name: 'span' })],
    });
    const main = component({
      name: 'Main',
      children: [createNode({ name: 'div' })],
      subComponents: [sub],
    });
    const out = compile(main);
    expect(out).toContain('function Main(');
    expect(out).toContain('function Sub(');
    // Sub is not exported as default — it's a sub-component.
    expect(out).toContain('export default Main;');
    const subDefaultExports = (out.match(/export default Sub/g) ?? []).length;
    expect(subDefaultExports).toBe(0);
  });
});

describe('componentToReact — react-native', () => {
  it('imports from "react-native" for native components and uses Text wrapper', () => {
    const txt = createNode({ name: 'span', properties: { _text: 'hi' } });
    const out = compile(
      component({ name: 'C', children: [createNode({ name: 'View', children: [txt] })] }),
      { stylesType: 'react-native', type: 'native' },
    );
    expect(out).toContain("from 'react-native'");
    expect(out).toContain('<Text>hi</Text>');
  });
});

describe('componentToReact — useContext wiring', () => {
  it('imports useContext when context.get has entries (default contextType)', () => {
    const out = compile(
      component({
        name: 'C',
        context: { get: { Theme: { name: 'Theme', path: 't' } }, set: {} },
        children: [createNode({ name: 'div' })],
      }),
    );
    expect(out).toMatch(/import\s*\{[^}]*useContext[^}]*\}\s*from\s*['"]react['"]/);
  });

  it('skips the useContext import when contextType is prop-drill', () => {
    const out = compile(
      component({
        name: 'C',
        context: { get: { Theme: { name: 'Theme', path: 't' } }, set: {} },
        children: [createNode({ name: 'div' })],
      }),
      { contextType: 'prop-drill' },
    );
    expect(out).not.toMatch(/import\s*\{[^}]*useContext[^}]*\}\s*from\s*['"]react['"]/);
  });
});
