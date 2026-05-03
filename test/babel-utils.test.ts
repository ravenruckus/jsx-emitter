import { describe, expect, it } from 'vitest';
import { babelTransformCode, babelTransformExpression, convertTypeScriptToJS } from '../src/internal/babel-transform';
import { mapImportDeclarationToJsonImport } from '../src/internal/import-mapping';
import { replaceIdentifiers, replacePropsIdentifier, replaceStateIdentifier } from '../src/internal/replace-identifiers';
import { isSlotProperty, replaceSlotsInString, stripSlotPrefix, toKebabSlot } from '../src/internal/slots';
import { transformStateSetters } from '../src/internal/transform-state-setters';
import { types } from '@babel/core';

describe('babelTransformCode', () => {
  it('returns the code unchanged when no visitor is provided', () => {
    const out = babelTransformCode('const x = 1;', undefined, false);
    expect(out).toMatch(/const x = 1/);
  });

  it('strips types when stripTypes=true', () => {
    const out = convertTypeScriptToJS('let x: number = 1');
    expect(out).not.toMatch(/:\s*number/);
    expect(out).toMatch(/x = 1/);
  });
});

describe('babelTransformExpression', () => {
  it('returns empty string for empty input', () => {
    expect(babelTransformExpression('', {})).toBe('');
  });

  it('passes simple expressions through', () => {
    const out = babelTransformExpression('1 + 2', {});
    expect(out).toMatch(/1\s*\+\s*2/);
  });
});

describe('replaceIdentifiers', () => {
  it('rewrites props.x to state.x when from=props, to=state', () => {
    const out = replaceIdentifiers({ code: 'props.foo', from: 'props', to: 'state' });
    expect(out).toMatch(/state\.foo/);
  });

  it('strips the identifier when to is null', () => {
    const out = replaceIdentifiers({ code: 'props.foo', from: 'props', to: null });
    expect(out).toMatch(/foo/);
    expect(out).not.toMatch(/props\./);
  });

  it('replaceStateIdentifier curries from=state', () => {
    expect(replaceStateIdentifier('this')('state.x')).toMatch(/this\.x/);
  });

  it('replacePropsIdentifier curries from=props', () => {
    expect(replacePropsIdentifier('this.props')('props.x')).toMatch(/this\.props\.x/);
  });
});

describe('transformStateSetters', () => {
  it('rewrites state.x = 1 via the transformer', () => {
    const out = transformStateSetters({
      value: 'state.foo = 1',
      transformer: ({ propertyName }) =>
        types.callExpression(types.identifier('setFoo'), [
          types.numericLiteral(1),
        ].concat(propertyName === 'foo' ? [] : [])),
    });
    expect(out).toMatch(/setFoo\(1\)/);
  });
});

describe('slots', () => {
  it('isSlotProperty', () => {
    expect(isSlotProperty('slotHeader')).toBe(true);
    expect(isSlotProperty('header')).toBe(false);
  });

  it('stripSlotPrefix', () => {
    expect(stripSlotPrefix('slotHeader')).toBe('Header');
  });

  it('toKebabSlot kebab-cases', () => {
    expect(toKebabSlot('slotHeaderTitle')).toBe('header-title');
  });

  it('replaceSlotsInString rewrites slot identifiers via mapper', () => {
    const out = replaceSlotsInString('slotHeader', (name) => `${name}Slot`);
    expect(out).toMatch(/headerSlot/);
  });
});

describe('mapImportDeclarationToJsonImport', () => {
  it('maps named, default, and namespace specifiers', () => {
    const decl = types.importDeclaration(
      [
        types.importDefaultSpecifier(types.identifier('Core')),
        types.importSpecifier(types.identifier('useState'), types.identifier('useState')),
        types.importNamespaceSpecifier(types.identifier('All')),
      ],
      types.stringLiteral('react'),
    );
    const result = mapImportDeclarationToJsonImport(decl);
    expect(result.path).toBe('react');
    expect(result.imports).toEqual({
      Core: 'default',
      useState: 'useState',
      All: '*',
    });
  });
});
