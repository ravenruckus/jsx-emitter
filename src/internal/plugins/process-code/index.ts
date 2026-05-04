import { flow } from 'fp-ts/lib/function';
import type { BaseHook, JsonComponent, Plugin } from '../../../types';
import { checkIsDefined } from '../../nullable';
import { traverseNodes } from '../../traverse-nodes';
import type { CodeProcessor } from './types';

export const createCodeProcessorPlugin =
  (
    codeProcessor: CodeProcessor,
    { processProperties }: { processProperties?: boolean } = { processProperties: false },
  ) =>
  (json: JsonComponent): void => {
    function processHook(key: keyof typeof json.hooks, hook: BaseHook) {
      const result = codeProcessor('hooks', json)(hook.code, key);

      if (typeof result === 'string') {
        hook.code = result;
      } else {
        result();
      }
      if (hook.deps) {
        const result = codeProcessor('hooks-deps', json)(hook.deps, key);

        if (typeof result === 'string') {
          hook.deps = result;
        } else {
          result();
        }
      }
      if (hook.depsArray?.length) {
        hook.depsArray = hook.depsArray
          .map((dep) => {
            const innerResult = codeProcessor('hooks-deps-array', json)(dep, key);
            if (typeof innerResult === 'string') {
              return innerResult;
            } else {
              return '';
            }
          })
          .filter((dep) => !!dep);
      }
    }

    for (const key in json.hooks) {
      const typedKey = key as keyof typeof json.hooks;
      const hooks = json.hooks[typedKey];

      if (checkIsDefined(hooks)) {
        if (Array.isArray(hooks)) {
          for (const hook of hooks) {
            processHook(typedKey, hook);
          }
        } else {
          processHook(typedKey, hooks);
        }
      }
    }

    for (const key in json.state) {
      const state = json.state[key];
      if (state) {
        const result = codeProcessor('state', json)(state.code, key);

        if (typeof result === 'string') {
          state.code = result;
        } else {
          result();
        }

        if (state.typeParameter) {
          const result = codeProcessor('types', json)(state.typeParameter, key);

          if (typeof result === 'string') {
            state.typeParameter = result;
          } else {
            result();
          }
        }
      }
    }

    for (const key in json.context.set) {
      const set = json.context.set[key];
      if (set.ref) {
        const result = codeProcessor('context-set', json)(set.ref, key);

        if (typeof result === 'string') {
          set.ref = result;
        } else {
          result();
        }
      }
      if (set.value) {
        for (const key in set.value) {
          const value = set.value[key];
          if (value) {
            const result = codeProcessor('context-set', json)(value.code, key);

            if (typeof result === 'string') {
              value.code = result;
            } else {
              result();
            }
          }
        }
      }
    }

    traverseNodes(json, (node, context) => {
      if (processProperties) {
        for (const key in node.properties) {
          const value = node.properties[key];
          if (key !== '_text' && value) {
            const result = codeProcessor('properties', json, node)(value, key);

            if (typeof result === 'string') {
              node.properties[key] = result;
            } else {
              result();
            }
          }
        }
      }

      for (const key in node.bindings) {
        const value = node.bindings[key];
        if (value?.code) {
          const result = codeProcessor('bindings', json, node)(value.code, key, context);

          if (typeof result === 'string') {
            value.code = result;
          } else {
            result();
          }
        }
      }

      // Babel rewrites dashed names like `swiper-container` into `swiper - container`
      // (it parses `-` as an operator), so skip dynamic-jsx-elements processing for them.
      const result = node.name.includes('-')
        ? node.name
        : codeProcessor('dynamic-jsx-elements', json)(node.name, '');
      if (typeof result === 'string') {
        node.name = result;
      } else {
        result();
      }
    });

    if (json.types) {
      json.types = json.types?.map((type) => {
        const result = codeProcessor('types', json)(type, '');

        if (typeof result === 'string') {
          return result;
        }
        result();
        return type;
      });
    }

    if (json.propsTypeRef) {
      const result = codeProcessor('types', json)(json.propsTypeRef, '');

      if (typeof result === 'string') {
        json.propsTypeRef = result;
      } else {
        result();
      }
    }
  };

export const CODE_PROCESSOR_PLUGIN = flow(
  createCodeProcessorPlugin,
  (plugin): Plugin =>
    () => ({ json: { post: plugin } }),
);
