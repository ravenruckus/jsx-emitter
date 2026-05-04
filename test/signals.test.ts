import { describe, expect, it } from 'vitest';
import { getSignalImportName, mapSignalType } from '../src/internal/signals';

describe('getSignalImportName', () => {
  it('returns the local name when Signal is imported from @builder.io/mitosis and used as a type', () => {
    const code = `import { Signal } from '@builder.io/mitosis';
const x: Signal<string> = null as any;`;
    expect(getSignalImportName(code)).toBe('Signal');
  });

  it('returns the alias when Signal is imported with an alias and used as a type', () => {
    const code = `import { Signal as MySignal } from '@builder.io/mitosis';
const x: MySignal<number> = null as any;`;
    expect(getSignalImportName(code)).toBe('MySignal');
  });

  it('returns undefined when Signal is imported but never used as a type', () => {
    const code = `import { Signal } from '@builder.io/mitosis';
const x = 1;`;
    expect(getSignalImportName(code)).toBeUndefined();
  });

  it('returns undefined when Signal is imported from a different package', () => {
    const code = `import { Signal } from 'other-pkg';
const x: Signal<string> = null as any;`;
    expect(getSignalImportName(code)).toBeUndefined();
  });

  it('returns undefined when there is no Signal import at all', () => {
    const code = `const x: string = 'hello';`;
    expect(getSignalImportName(code)).toBeUndefined();
  });
});

describe('mapSignalType', () => {
  it('strips Signal<T> down to T (the inner generic) for React', () => {
    const code = `import { Signal } from '@builder.io/mitosis';
const x: Signal<string> = null as any;`;
    const result = mapSignalType({ code });
    expect(result).toContain('const x: string');
    expect(result).not.toContain('Signal<string>');
  });

  it('handles aliased Signal imports', () => {
    const code = `import { Signal as MySignal } from '@builder.io/mitosis';
const x: MySignal<number> = null as any;`;
    const result = mapSignalType({ code });
    expect(result).toContain('const x: number');
    expect(result).not.toContain('MySignal<');
  });

  it('passes code through (modulo formatter quirks) when no Signal usage is detected', () => {
    const code = `const x: string = 'hello';`;
    const result = mapSignalType({ code });
    // babelTransformExpression normalizes (may drop trailing semicolon and
    // re-emit string literals with the parser's preferred quote style); the
    // important guarantee is that no Signal-stripping happens.
    expect(result).toContain('const x: string');
    expect(result).toMatch(/= ['"]hello['"]/);
  });

  it('strips multiple Signal<T> usages in one expression', () => {
    const code = `import { Signal } from '@builder.io/mitosis';
type Pair = { a: Signal<string>; b: Signal<number> };`;
    const result = mapSignalType({ code });
    expect(result).toContain('a: string');
    expect(result).toContain('b: number');
    expect(result).not.toMatch(/Signal</);
  });

  it('honors an explicit signalImportName override', () => {
    const code = `type Bag = { x: Custom<boolean> };`;
    const result = mapSignalType({ code, signalImportName: 'Custom' });
    expect(result).toContain('x: boolean');
  });
});
