import * as babel from '@babel/core';
import decorators from '@babel/plugin-syntax-decorators';
import tsPlugin from '@babel/plugin-syntax-typescript';
import tsPreset from '@babel/preset-typescript';
import type { Visitor } from '@babel/traverse';
import { identity, pipe } from 'fp-ts/lib/function';
import { checkIsGetter, replaceFunctionWithGetter, replaceGetterWithFunction } from './patterns';

const handleErrorOrExpression = <VisitorContextType = any>({
  code,
  useCode,
  result,
  visitor,
  stripTypes,
}: {
  code: string;
  useCode: string;
  result: string | null;
  visitor: Visitor<VisitorContextType>;
  stripTypes: boolean;
}) => {
  try {
    const isMethod = Boolean(
      !code.trim().startsWith('function') && code.trim().match(/^[a-z0-9_]+\s*\([^\)]*\)\s*[\{:]/i),
    );

    const isGetter = checkIsGetter(code);

    const isMethodOrGetter = isMethod || isGetter;

    if (isMethodOrGetter) {
      useCode = `function ${useCode}`;
    }

    result = pipe(
      `let _ = ${useCode}`,
      (code) => babelTransformCode(code, visitor, stripTypes),
      trimSemicolons,
      (str) => str.replace(/let _ =\s/, ''),
    );

    if (isMethodOrGetter) {
      return result.replace('function', '');
    }

    return result;
  } catch (err) {
    console.error('Error parsing code:\n', { code, result, useCode });
    throw err;
  }
};

const babelTransform = <VisitorContextType = any>({
  code,
  visitor,
  stripTypes,
}: {
  code: string;
  visitor?: Visitor<VisitorContextType>;
  stripTypes: boolean;
}) => {
  return babel.transform(code, {
    sourceFileName: 'file.tsx',
    configFile: false,
    babelrc: false,
    parserOpts: { allowReturnOutsideFunction: true },
    ...(stripTypes ? { presets: [[tsPreset, { isTSX: true, allExtensions: true }]] } : {}),
    plugins: [
      [tsPlugin, { isTSX: true }],
      [decorators, { legacy: true }],
      ...(visitor ? [() => ({ visitor })] : []),
    ],
  });
};

export const babelTransformCode = <VisitorContextType = any>(
  code: string,
  visitor?: Visitor<VisitorContextType>,
  stripTypes = false,
) => babelTransform({ code, visitor, stripTypes })?.code || '';

const trimSemicolons = (code: string) => code.replace(/;$/, '');

const trimExpression = (type: ExpressionType) => (code: string) => {
  switch (type) {
    case 'functionBody':
      return code.replace(/^function\s*\(\)\s*\{/, '').replace(/\};?$/, '');
    default:
      return trimSemicolons(code);
  }
};

type ExpressionType = 'expression' | 'unknown' | 'block' | 'functionBody';

const getType = (code: string, initialType: ExpressionType): ExpressionType => {
  if (initialType === 'unknown' && code.trim().match(/^\s*{\s*[a-z0-9]+:/i)) {
    return 'expression';
  }

  if (
    initialType === 'unknown' &&
    (code.includes('return _virtual_index') || code.trim().startsWith('return ')) &&
    !code.trim().startsWith('function')
  ) {
    return 'functionBody';
  }

  return initialType;
};

export const babelTransformExpression = <VisitorContextType = any>(
  code: string,
  visitor: Visitor<VisitorContextType>,
  initialType: ExpressionType = 'unknown',
  stripTypes = false,
): string => {
  if (!code) {
    return '';
  }

  const isGetter = code.trim().startsWith('get ');

  return pipe(
    code,
    isGetter ? replaceGetterWithFunction : identity,
    (code) => {
      const type = getType(code, initialType);

      const useCode = type === 'functionBody' ? `function(){${code}}` : code;

      return { type, useCode };
    },
    ({ type, useCode }) => {
      if (type !== 'expression') {
        try {
          return pipe(babelTransformCode(useCode, visitor, stripTypes), trimExpression(type));
        } catch (error) {
          return handleErrorOrExpression({ code, useCode, result: null, visitor, stripTypes });
        }
      } else {
        return handleErrorOrExpression({ code, useCode, result: null, visitor, stripTypes });
      }
    },
    isGetter ? replaceFunctionWithGetter : identity,
  );
};

export const convertTypeScriptToJS = (code: string): string =>
  babelTransformExpression(code, {}, 'unknown', true);
