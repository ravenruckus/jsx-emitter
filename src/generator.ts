import { types } from '@babel/core';
import hash from 'hash-sum';
import json5 from 'json5';
import { format } from 'prettier/standalone';
import { blockToReact } from './blocks';
import { createSingleBinding } from './internal/bindings';
import { checkHasState } from './internal/check-has-state';
import { collectReactNativeStyles } from './internal/collect-rn-styles';
import { hasContext } from './internal/context-detect';
import { createNode } from './internal/create-node';
import { dedent } from './internal/dedent';
import { getDefaultProps } from './internal/default-props';
import { fastClone } from './internal/fast-clone';
import { getPropsRef } from './internal/get-props-ref';
import { getRefs } from './internal/get-refs';
import { stringifyContextValue } from './internal/get-state-object-string';
import { gettersToFunctions } from './internal/getters-to-functions';
import { handleMissingState } from './internal/handle-missing-state';
import { isRootTextNode } from './internal/is-root-text-node';
import {
  closeFrag,
  isReactForwardRef,
  openFrag,
  processTagReferences,
  wrapInFragment,
} from './internal/jsx-helpers';
import { mapRefs } from './internal/map-refs';
import { initializeOptions } from './internal/merge-options';
import { checkIsDefined } from './internal/nullable';
import {
  getOnEventHookComponentBody,
  getOnInitHookComponentBody,
  getOnMountComponentBody,
  getOnUnMountComponentBody,
  getOnUpdateComponentBody,
} from './internal/hooks';
import { processOnEventHooksPlugin } from './internal/on-event';
import { CODE_PROCESSOR_PLUGIN } from './internal/plugins/process-code';
import {
  runPostCodePlugins,
  runPostJsonPlugins,
  runPreCodePlugins,
  runPreJsonPlugins,
} from './internal/plugins-runner';
import { processHttpRequests } from './internal/process-http-requests';
import { renderPreComponent } from './internal/render-imports';
import { replaceNodes, replaceStateIdentifier } from './internal/replace-identifiers';
import { stripNewlinesInStrings } from './internal/replace-new-lines-in-strings';
import { checkIfIsClientComponent } from './internal/rsc-detect';
import {
  getDefaultImport,
  getReactVariantStateImportString,
  getReactVariantStateString,
  getUseStateCode,
  processHookCode,
  updateStateSetters,
} from './internal/state';
import { stripMetaProperties } from './internal/strip-meta-properties';
import { collectCss } from './internal/styles/collect-css';
import { hasCss } from './internal/styles/helpers';
import type { JsonComponent, ToReactOptions, TranspilerGenerator } from './types';

export const contextPropDrillingKey = '_context';

const isRootSpecialNode = (json: JsonComponent) =>
  json.children.length === 1 && ['Show', 'For'].includes(json.children[0].name);

const getRefsString = (
  json: JsonComponent,
  refs: string[],
  options: ToReactOptions,
): [boolean, string] => {
  let hasStateArgument = false;
  let code = '';
  const domRefs = getRefs(json);

  for (const ref of refs) {
    const typeParameter = json['refs'][ref]?.typeParameter || '';
    const argument = json['refs'][ref]?.argument || (domRefs.has(ref) ? 'null' : '');
    hasStateArgument = /state\./.test(argument);
    code += `\nconst ${ref} = useRef${
      typeParameter && options.typescript ? `<${typeParameter}>` : ''
    }(${processHookCode({
      str: argument,
      options,
    })});`;
  }

  return [hasStateArgument, code];
};

function provideContext(json: JsonComponent, options: ToReactOptions): string | void {
  if (options.contextType === 'prop-drill') {
    let str = '';
    for (const key in json.context.set) {
      const { name, value } = json.context.set[key];
      if (value) {
        str += `
          ${contextPropDrillingKey}.${name} = ${stringifyContextValue(value)};
        `;
      }
    }
    return str;
  } else {
    for (const key in json.context.set) {
      const { name, ref, value } = json.context.set[key];
      if (value) {
        json.children = [
          createNode({
            name: `${name}.Provider`,
            children: json.children,
            ...(value && {
              bindings: {
                value: createSingleBinding({
                  code: stringifyContextValue(value),
                }),
              },
            }),
          }),
        ];
      } else if (ref) {
        json.children = [
          createNode({
            name: `${name}.Provider`,
            children: json.children,
            ...(ref && {
              bindings: {
                value: createSingleBinding({ code: ref }),
              },
            }),
          }),
        ];
      }
    }
  }
}

function getContextString(component: JsonComponent, options: ToReactOptions) {
  let str = '';
  for (const key in component.context.get) {
    if (options.contextType === 'prop-drill') {
      str += `
        const ${key} = ${contextPropDrillingKey}['${component.context.get[key].name}'];
      `;
    } else {
      str += `
        const ${key} = useContext(${component.context.get[key].name});
      `;
    }
  }

  return str;
}

type ReactExports =
  | 'useState'
  | 'useRef'
  | 'useCallback'
  | 'useEffect'
  | 'useContext'
  | 'forwardRef';

export const componentToReact: TranspilerGenerator<Partial<ToReactOptions>> =
  (reactOptions = {}) =>
  ({ component }) => {
    let json = fastClone(component);

    const stateType = reactOptions.stateType || 'useState';

    const DEFAULT_OPTIONS: ToReactOptions = {
      addUseClientDirectiveIfNeeded: true,
      stateType,
      stylesType: 'styled-jsx',
      styleTagsPlacement: 'bottom',
      type: 'dom',
      plugins: [
        processOnEventHooksPlugin({ setBindings: false }),
        ...(stateType === 'variables'
          ? [
              CODE_PROCESSOR_PLUGIN((codeType, jsonArg) => (code) => {
                if (codeType === 'types') return code;

                code = replaceNodes({
                  code,
                  nodeMaps: Object.entries(jsonArg.state)
                    .filter(([, value]) => value?.type === 'getter')
                    .map(([key]) => {
                      const expr = types.memberExpression(
                        types.identifier('state'),
                        types.identifier(key),
                      );
                      return {
                        from: expr,
                        to: types.callExpression(expr, []),
                      };
                    }),
                });

                code = replaceStateIdentifier(null)(code);

                return code;
              }),
            ]
          : []),
      ],
    };

    const options = initializeOptions({
      target: reactOptions.type === 'native' ? 'reactNative' : 'react',
      component,
      defaults: DEFAULT_OPTIONS,
      userOptions: reactOptions,
    });

    if (options.plugins) {
      json = runPreJsonPlugins({ json, plugins: options.plugins });
    }

    let str = _componentToReact(json, options);

    str +=
      '\n\n\n' +
      json.subComponents.map((item) => _componentToReact(item, options, true)).join('\n\n\n');

    if (options.plugins) {
      str = runPreCodePlugins({ json, code: str, plugins: options.plugins });
    }
    if (options.prettier !== false) {
      try {
        str = format(str, {
          parser: 'typescript',
          plugins: [
            require('prettier/parser-typescript'),
            require('prettier/parser-postcss'),
          ],
        }).replace(/;\n\nimport\s/g, ';\nimport ');
      } catch (err) {
        if (process.env.NODE_ENV !== 'test') {
          console.error('Format error for file:', str);
        }
        throw err;
      }
    }
    if (options.plugins) {
      str = runPostCodePlugins({ json, code: str, plugins: options.plugins });
    }
    return str;
  };

const isRSC = (json: JsonComponent, options: ToReactOptions) => {
  const componentType = json.meta.useMetadata?.rsc?.componentType;
  if (options.rsc && checkIsDefined(componentType)) {
    return componentType === 'server';
  }

  return !checkIfIsClientComponent(json);
};

const checkShouldAddUseClientDirective = (json: JsonComponent, options: ToReactOptions) => {
  if (!options.addUseClientDirectiveIfNeeded) return false;
  if (options.type === 'native') return false;

  return !isRSC(json, options);
};

const generateStyleTags = (
  placement: 'top' | 'bottom',
  options: ToReactOptions,
  componentHasStyles: boolean,
  css: string | null,
) => {
  if (placement !== options.styleTagsPlacement) return '';
  return dedent`
  ${
    componentHasStyles && options.stylesType === 'styled-jsx'
      ? `<style jsx>{\`${css}\`}</style>`
      : ''
  }
  ${componentHasStyles && options.stylesType === 'style-tag' ? `<style>{\`${css}\`}</style>` : ''}
  `;
};

const _componentToReact = (
  json: JsonComponent,
  options: ToReactOptions,
  isSubComponent = false,
) => {
  processHttpRequests(json);
  handleMissingState(json);
  processTagReferences(json, options);
  const contextStr = provideContext(json, options);
  const componentHasStyles = hasCss(json);
  if (options.stateType === 'useState') {
    gettersToFunctions(json);
    updateStateSetters(json, options);
  }

  if (!json.name) {
    json.name = 'MyComponent';
  }

  const allRefs = Object.keys(json.refs);
  mapRefs(json, (refName) => `${refName}.current`);

  const hasState = checkHasState(json);

  const [forwardRef, hasPropRef] = getPropsRef(json);
  const isForwardRef = Boolean(isReactForwardRef(json) || hasPropRef);
  if (isForwardRef) {
    const meta = isReactForwardRef(json) as string;
    options.forwardRef = meta || forwardRef;
  }
  const forwardRefType =
    options.typescript && json.propsTypeRef && forwardRef && json.propsTypeRef !== 'any'
      ? `<${json.propsTypeRef}["${forwardRef}"]>`
      : '';

  const useStateCode = options.stateType === 'useState' ? getUseStateCode(json, options) : '';
  if (options.plugins) {
    json = runPostJsonPlugins({ json, plugins: options.plugins });
  }

  const css =
    options.stylesType === 'styled-jsx'
      ? collectCss(json)
      : options.stylesType === 'style-tag'
      ? collectCss(json, {
          prefix: hash(json),
        })
      : null;

  if (options.format !== 'lite') {
    stripMetaProperties(json);
  }

  const reactLibImports: Set<ReactExports> = new Set();
  if (useStateCode.includes('useState')) {
    reactLibImports.add('useState');
  }
  if (hasContext(json) && options.contextType !== 'prop-drill') {
    reactLibImports.add('useContext');
  }

  const shouldAddUseClientDirective = checkShouldAddUseClientDirective(json, options);

  const shouldInlineOnInitHook =
    !shouldAddUseClientDirective && options.rsc && isRSC(json, options);

  if (allRefs.length || (json.hooks.onInit?.code && !shouldInlineOnInitHook)) {
    reactLibImports.add('useRef');
  }
  if (hasPropRef) {
    reactLibImports.add('forwardRef');
  }
  if (json.hooks.onMount.length || json.hooks.onUnMount?.code || json.hooks.onUpdate?.length) {
    reactLibImports.add('useEffect');
  }

  const wrap =
    wrapInFragment(json) ||
    isRootTextNode(json) ||
    (componentHasStyles &&
      (options.stylesType === 'styled-jsx' || options.stylesType === 'style-tag')) ||
    isRootSpecialNode(json);

  const [hasStateArgument, refsString] = getRefsString(json, allRefs, options);

  // NOTE: `collectReactNativeStyles` must run before style generation in the
  // component generation body, as it has side effects that delete styles
  // bindings from the JSON.
  const reactNativeStyles =
    options.stylesType === 'react-native' && componentHasStyles
      ? collectReactNativeStyles(json, options)
      : undefined;

  const propType = json.propsTypeRef || 'any';
  const componentArgs = [`props${options.typescript ? `:${propType}` : ''}`, options.forwardRef]
    .filter(Boolean)
    .join(',');

  const componentBody = dedent`
    ${
      options.contextType === 'prop-drill'
        ? `const ${contextPropDrillingKey} = { ...props['${contextPropDrillingKey}'] };`
        : ''
    }
    ${hasStateArgument ? '' : refsString}
    ${getReactVariantStateString({ hasState, useStateCode, json, options })}
    ${hasStateArgument ? refsString : ''}
    ${getContextString(json, options)}
    ${json.hooks.init?.code ? processHookCode({ str: json.hooks.init?.code, options }) : ''}
    ${contextStr || ''}

    ${getOnInitHookComponentBody({ shouldInlineOnInitHook, json, options })}
    ${getOnEventHookComponentBody(json)}
    ${getOnMountComponentBody({ json, options })}
    ${getOnUpdateComponentBody({ json, options })}
    ${getOnUnMountComponentBody({ json, options })}

    return (
      ${wrap ? openFrag(options) : ''}
      ${generateStyleTags('top', options, componentHasStyles, css)}
      ${json.children.map((item) => blockToReact(item, options, json, wrap, [])).join('\n')}
      ${generateStyleTags('bottom', options, componentHasStyles, css)}
      ${wrap ? closeFrag(options) : ''}
    );
  `;

  const str = dedent`
  ${shouldAddUseClientDirective ? `'use client';` : ''}
  ${getDefaultImport(options, json)}
  ${
    reactLibImports.size
      ? `import { ${Array.from(reactLibImports).join(', ')} } from 'react'`
      : ''
  }
  ${options.stylesType === 'twrnc' ? `import tw from 'twrnc';\n` : ''}
    ${getReactVariantStateImportString(hasState, options)}
    ${json.types && options.typescript ? json.types.join('\n') : ''}
    ${renderPreComponent({
      explicitImportFileExtension: options.explicitImportFileExtension,
      component: json,
      target: options.type === 'native' ? 'reactNative' : 'react',
    })}
    ${isForwardRef ? `const ${json.name} = forwardRef${forwardRefType}(` : ''}function ${
      json.name
    }(${componentArgs}) {
  ${getDefaultProps(json)}
    ${componentBody}
  }${isForwardRef ? ')' : ''}

    ${
      reactNativeStyles && Object.keys(reactNativeStyles).length > 0
        ? `const styles = StyleSheet.create(${json5.stringify(reactNativeStyles)});`
        : ''
    }

    ${isSubComponent ? '' : `export default ${json.name};`}

  `;

  return stripNewlinesInStrings(str);
};
