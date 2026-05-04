import { types } from '@babel/core';
import { pipe } from 'fp-ts/lib/function';
import traverse from 'neotraverse/legacy';
import type { JsonComponent, StateValue, ToReactOptions } from '../types';
import { capitalize } from './capitalize';
import { getFunctionString } from './get-function-string';
import { getStateObjectStringFromComponent } from './get-state-object-string';
import { getTypedFunction } from './get-typed-function';
import { isNode } from './is-node';
import { processBinding } from './jsx-helpers';
import { prefixWithFunction, replaceGetterWithFunction } from './patterns';
import { transformStateSetters } from './transform-state-setters';

/**
 * Removes all `this.` references.
 */
const stripThisRefs = (str: string, options: ToReactOptions) => {
  if (options.stateType !== 'useState') {
    return str;
  }

  return str.replace(/this\.([a-zA-Z_\$0-9]+)/g, '$1');
};

export const processHookCode = ({ str, options }: { str: string; options: ToReactOptions }) =>
  processBinding(updateStateSettersInCode(str, options), options);

const valueMapper = (options: ToReactOptions) => (val: string) => {
  const x = processHookCode({ str: val, options });
  return stripThisRefs(x, options);
};
const getSetStateFnName = (stateName: string) => `set${capitalize(stateName)}`;

const processStateValue = (options: ToReactOptions) => {
  const mapValue = valueMapper(options);

  return ([key, stateVal]: [key: string, stateVal: StateValue | undefined]) => {
    if (!stateVal) {
      return '';
    }

    let value = stateVal.code || '';
    const type = stateVal.type;
    const typeParameter = stateVal.typeParameter;
    const stateType =
      options.typescript && stateVal.typeParameter ? `<${stateVal.typeParameter}>` : '';

    let result = '';
    if (type === 'getter') {
      result = pipe(value, replaceGetterWithFunction, mapValue);
    } else if (type === 'function') {
      result = mapValue(value);
    } else if (type === 'method') {
      result = pipe(value, prefixWithFunction, mapValue);
    } else {
      return `const [${key}, ${getSetStateFnName(key)}] = useState${stateType}(() => (${mapValue(
        value,
      )}))`;
    }

    return getTypedFunction(result, options.typescript, typeParameter);
  };
};

export const getUseStateCode = (json: JsonComponent, options: ToReactOptions) => {
  const lineItemDelimiter = '\n\n\n';

  const stringifiedState = Object.entries(json.state).map(processStateValue(options));
  return stringifiedState.join(lineItemDelimiter);
};

export const updateStateSetters = (json: JsonComponent, options: ToReactOptions) => {
  if (options.stateType !== 'useState') {
    return;
  }
  traverse(json).forEach(function (item) {
    if (isNode(item)) {
      for (const key in item.bindings) {
        let values = item.bindings[key]!;
        const newValue = updateStateSettersInCode(values?.code as string, options);
        if (newValue !== values?.code) {
          item.bindings[key] = {
            ...values,
            code: newValue,
          };
        }
      }
    }
  });
};

export const updateStateSettersInCode = (value: string, options: ToReactOptions) => {
  if (options.stateType !== 'useState') {
    return value;
  }
  return transformStateSetters({
    value,
    transformer: ({ path, propertyName }) =>
      types.callExpression(types.identifier(getSetStateFnName(propertyName)), [path.node.right]),
  });
};

// Slim: the retained stateType values (useState | variables) need no extra imports
// beyond what the main generator emits, so the upstream variant-import ternary
// collapses to an unconditional empty string.
export const getReactVariantStateImportString = (_hasState: boolean, _options: ToReactOptions) =>
  '';

export const getReactVariantStateString = ({
  hasState,
  options,
  json,
  useStateCode,
}: {
  useStateCode: string;
  hasState: boolean;
  json: JsonComponent;
  options: ToReactOptions;
}) =>
  hasState
    ? options.stateType === 'useState'
      ? useStateCode
      : getStateObjectStringFromComponent(json, {
          format: 'variables',
          keyPrefix: 'const',
          valueMapper: (code, type, _, key) => {
            if (key) {
              const constPrefix = !code.startsWith('function') ? `${key} = ` : '';

              if (type === 'getter')
                return `${constPrefix}${getFunctionString(code.replace('get ', ''))}`;
              if (type === 'function')
                return code.startsWith('async') ? code : `${constPrefix}${getFunctionString(code)}`;
            }
            return code;
          },
        })
    : '';

export const getDefaultImport = (options: ToReactOptions, json: JsonComponent): string => {
  const { type } = options;
  if (type === 'native') {
    const namesUsed = new Set<string>(),
      knownImports = new Set<string>();

    json.imports.forEach((imported) => {
      if (imported.imports) {
        Object.keys(imported.imports).forEach((name) => {
          knownImports.add(name);
        });
      }
    });

    traverse(json).forEach((node) => {
      if (!isNode(node)) {
        return;
      }

      // ReactNative has a special case for converting _text to Text
      if (node.properties._text?.trim().length || node.bindings._text?.code?.trim()?.length) {
        namesUsed.add('Text');
      }

      if (node.properties.style || node.bindings.style) {
        namesUsed.add('StyleSheet');
      }

      if (
        node.name === 'TouchableOpacity' &&
        ('href' in node.bindings || 'href' in node.properties)
      ) {
        namesUsed.add('Linking');
      }

      namesUsed.add(node.name);
    });

    const components = [
      'FlatList',
      'ScrollView',
      'View',
      'StyleSheet',
      'Image',
      'Text',
      'Pressable',
      'TextInput',
      'TouchableOpacity',
      'Button',
      'Linking',
    ].filter((name) => {
      // Only import if the name is used and not imported from somewhere else
      return namesUsed.has(name) && !knownImports.has(name);
    });

    return `
    import * as React from 'react';
    import { ${components.join(', ')} } from 'react-native';
    `;
  }
  if (type === 'taro') {
    return `
    import * as React from 'react';
    `;
  }

  return "import * as React from 'react';";
};
