import { describe, expect, it } from 'vitest';
import {
  DO_NOT_USE_CONTEXT_VARS_TRANSFORMS,
  DO_NOT_USE_VARS_TRANSFORMS,
  stripStateAndPropsRefs,
} from '../src/internal/strip-state-and-props-refs';

describe('stripStateAndPropsRefs', () => {
  it('returns empty string when code is undefined', () => {
    expect(stripStateAndPropsRefs(undefined)).toBe('');
  });

  it('strips both state. and props. prefixes by default', () => {
    expect(stripStateAndPropsRefs('state.foo + props.bar')).toBe('foo + bar');
  });

  it('replaces state. with the configured replaceWith string', () => {
    expect(stripStateAndPropsRefs('state.foo', { replaceWith: 'this.', includeProps: false })).toBe(
      'this.foo',
    );
  });

  it('strips only state. when includeProps is false', () => {
    expect(stripStateAndPropsRefs('state.foo + props.bar', { includeProps: false })).toBe(
      'foo + props.bar',
    );
  });

  it('strips only props. when includeState is false', () => {
    expect(stripStateAndPropsRefs('state.foo + props.bar', { includeState: false })).toBe(
      'state.foo + bar',
    );
  });

  it('rewrites the el.this.props webcomponent edge case to el.props', () => {
    // After replacePropsIdentifier with replaceWith="this." an el.props expression
    // becomes el.this.props, which the helper then collapses back to el.props.
    expect(stripStateAndPropsRefs('el.props', { replaceWith: 'this.', includeState: false })).toBe(
      'el.props',
    );
  });
});

describe('DO_NOT_USE_CONTEXT_VARS_TRANSFORMS', () => {
  it('prefixes the supplied context to each contextVar identifier', () => {
    const out = DO_NOT_USE_CONTEXT_VARS_TRANSFORMS({
      code: 'foo + bar',
      contextVars: ['foo'],
      context: 'this.',
    });
    expect(out).toBe('this.foo + bar');
  });

  it('returns the code unchanged when contextVars is empty/undefined', () => {
    expect(
      DO_NOT_USE_CONTEXT_VARS_TRANSFORMS({ code: 'foo', contextVars: [], context: 'this.' }),
    ).toBe('foo');
    expect(DO_NOT_USE_CONTEXT_VARS_TRANSFORMS({ code: 'foo', context: 'this.' })).toBe('foo');
  });

  it('rewrites the variable in multiple expression positions', () => {
    const out = DO_NOT_USE_CONTEXT_VARS_TRANSFORMS({
      code: 'foo; (foo); !foo; foo.bar; foo?.bar',
      contextVars: ['foo'],
      context: 'this.',
    });
    expect(out).toBe('this.foo; (this.foo); !this.foo; this.foo.bar; this.foo?.bar');
  });
});

describe('DO_NOT_USE_VARS_TRANSFORMS', () => {
  it('rewrites props.event() invocations on outputVars to context-emit pattern', () => {
    const out = DO_NOT_USE_VARS_TRANSFORMS('props.click()', {
      outputVars: ['click'],
    });
    expect(out).toBe('this.click.emit()');
  });

  it('prefixes domRefs with this.', () => {
    const out = DO_NOT_USE_VARS_TRANSFORMS('myRef.focus()', {
      domRefs: ['myRef'],
    });
    expect(out).toBe('this.myRef.focus()');
  });

  it('prefixes stateVars with this. when not at start-of-string', () => {
    const out = DO_NOT_USE_VARS_TRANSFORMS('baz + foo + bar', {
      stateVars: ['foo'],
    });
    expect(out).toBe('baz + this.foo + bar');
  });

  it('skips a stateVar at start-of-string (class variable declaration guard)', () => {
    // Negative lookahead `(?!^foo|^ foo)` deliberately spares an identifier
    // sitting at column 0, treating it as a class-field declaration.
    const out = DO_NOT_USE_VARS_TRANSFORMS('foo = 1', { stateVars: ['foo'] });
    expect(out).toBe('foo = 1');
  });

  it('skips a stateVar that follows the `function` keyword', () => {
    const out = DO_NOT_USE_VARS_TRANSFORMS('function foo() { return foo; }', {
      stateVars: ['foo'],
    });
    expect(out).toMatch(/function foo\b/);
  });

  it('skips a stateVar that follows the `get` keyword', () => {
    const out = DO_NOT_USE_VARS_TRANSFORMS('get foo() { return foo; }', {
      stateVars: ['foo'],
    });
    expect(out).toMatch(/^get foo\(/);
  });

  it('rewrites contextVars then output/dom/state vars in a single pass', () => {
    // Lead with a token so the contextVar is not at start-of-string (regex requires
    // a leading boundary char); confirms passes are chained through one call.
    const out = DO_NOT_USE_VARS_TRANSFORMS('a + ctx + props.send()', {
      contextVars: ['ctx'],
      outputVars: ['send'],
    });
    expect(out).toBe('a + this.ctx + this.send.emit()');
  });
});
