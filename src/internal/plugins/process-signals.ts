import { types } from '@babel/core';
import generate from '@babel/generator';
import type { Plugin } from '../../types';
import { babelTransformExpression } from '../babel-transform';
import { capitalize } from '../capitalize';
import { replaceNodes } from '../replace-identifiers';
import { mapSignalType } from '../signals';
import { createCodeProcessorPlugin } from './process-code';

export const replaceSignalSetters = ({
  code,
  nodeMaps,
}: {
  code: string;
  nodeMaps: {
    from: types.Node;
    setTo: types.Expression;
  }[];
}) => {
  for (const { from, setTo } of nodeMaps) {
    code = babelTransformExpression(code, {
      AssignmentExpression(path) {
        if (path.node.operator !== '=') return;

        const lhs = path.node.left;
        const rhs = path.node.right;

        if (!types.isMemberExpression(lhs)) return;
        if (!(types.isObjectExpression(rhs) || types.isIdentifier(rhs))) return;

        const signalAccess = lhs.object;
        if (!types.isMemberExpression(signalAccess)) return;

        if (generate(signalAccess).code !== generate(from).code) return;

        // Rewrite `a.b.c.value.d = e` → `a.b.setC((PREVIOUS_VALUE) => ({ ...PREVIOUS_VALUE, d: e }))`
        const setter = types.cloneNode(setTo);

        const prevValueIdentifier = types.identifier('PREVIOUS_VALUE');
        const setFn = types.arrowFunctionExpression(
          [prevValueIdentifier],
          types.objectExpression([
            types.spreadElement(prevValueIdentifier),
            types.objectProperty(lhs.property, rhs),
          ]),
        );
        const setterExpression = types.callExpression(setter, [setFn]);

        path.replaceWith(setterExpression);
      },
    });
  }
  return code;
};

// React-target mapper, hardcoded: getter is the bare identifier; setter is `set` + capitalized name.
const REACT_SIGNAL_MAPPER = {
  getter: (name: string) => types.identifier(name),
  setter: (name: string) => types.identifier('set' + capitalize(name)),
};

/**
 * Strips `Signal<T>` references in code (state, props, etc.) down to `T` when
 * the component declares a `signalTypeImportName`. React doesn't add any
 * replacement type import — the inner generic passes through as-is.
 */
export const getSignalTypePlugin =
  (): Plugin =>
  () => ({
    json: {
      pre: (json) => {
        createCodeProcessorPlugin((codeType, json) => {
          switch (codeType) {
            // Don't run mapSignalType on JSX element names — they aren't valid code expressions.
            case 'dynamic-jsx-elements':
              return (x) => x;
            default:
              return (code) => {
                if (json.signals?.signalTypeImportName) {
                  return mapSignalType({
                    code,
                    signalImportName: json.signals.signalTypeImportName,
                  });
                }

                return code;
              };
          }
        })(json);

        // No replacement Signal-type import is added for React; the inner generic stands alone.
      },
    },
  });

/**
 * Rewrites `mySignal.value` accessors for reactive props, context, and state
 * down to React-style getter/setter pairs (props.x → props.x for reads;
 * `props.x.value = …` → `props.setX(prev => …)` for assignments).
 */
export const getSignalAccessPlugin =
  (): Plugin =>
  () => ({
    json: {
      pre: (x) => {
        return createCodeProcessorPlugin((_codeType, json) => (code) => {
          const mapSignal = REACT_SIGNAL_MAPPER;
          const nodeMaps: { from: types.Node; to: types.Node; setTo: types.Expression }[] = [];

          for (const propName in json.props) {
            if (json.props[propName].propertyType === 'reactive') {
              const getter = types.memberExpression(
                types.identifier('props'),
                mapSignal.getter(propName),
              );
              const setter = types.memberExpression(
                types.identifier('props'),
                mapSignal.setter(propName),
              );

              nodeMaps.push({
                from: types.memberExpression(
                  types.memberExpression(types.identifier('props'), types.identifier(propName)),
                  types.identifier('value'),
                ),
                to: getter,
                setTo: setter,
              });

              nodeMaps.push({
                from: types.optionalMemberExpression(
                  types.memberExpression(types.identifier('props'), types.identifier(propName)),
                  types.identifier('value'),
                  false,
                  true,
                ),
                to: getter,
                setTo: setter,
              });
            }
          }

          for (const propName in json.context.get) {
            if (json.context.get[propName].type === 'reactive') {
              nodeMaps.push({
                from: types.memberExpression(types.identifier(propName), types.identifier('value')),
                to: mapSignal.getter(propName),
                setTo: mapSignal.setter(propName),
              });
            }
          }

          for (const propName in json.state) {
            if (json.state[propName]?.propertyType === 'reactive') {
              const to = types.memberExpression(
                types.identifier('state'),
                mapSignal.getter(propName),
              );
              const setTo = mapSignal.setter(propName);

              nodeMaps.push({
                from: types.memberExpression(
                  types.memberExpression(types.identifier('state'), types.identifier(propName)),
                  types.identifier('value'),
                ),
                to,
                setTo,
              });

              nodeMaps.push({
                from: types.optionalMemberExpression(
                  types.memberExpression(types.identifier('state'), types.identifier(propName)),
                  types.identifier('value'),
                  false,
                  true,
                ),
                to,
                setTo,
              });
            }
          }

          // Run setter replacement first; otherwise the getter rewrite would consume the LHS access first.
          if (nodeMaps.length) {
            code = replaceSignalSetters({ code, nodeMaps });
            code = replaceNodes({ code, nodeMaps });
          }

          return code;
        })(x);
      },
    },
  });
