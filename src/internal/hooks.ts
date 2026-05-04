import type { JsonComponent, ToReactOptions } from '../types';
import { getOnEventHandlerName } from './on-event';
import { processHookCode } from './state';

export const getOnInitHookComponentBody = ({
  shouldInlineOnInitHook,
  options,
  json,
}: {
  json: JsonComponent;
  options: ToReactOptions;
  shouldInlineOnInitHook?: boolean;
}) =>
  json.hooks.onInit?.code
    ? shouldInlineOnInitHook
      ? processHookCode({ str: json.hooks.onInit.code, options })
      : `
        const hasInitialized = useRef(false);
        if (!hasInitialized.current) {
          ${processHookCode({
            str: json.hooks.onInit.code,
            options,
          })}
          hasInitialized.current = true;
        }
        `
    : '';

export const getOnEventHookComponentBody = (json: JsonComponent) =>
  json.hooks.onEvent
    .map((hook) => {
      const eventName = `"${hook.eventName}"`;
      const handlerName = getOnEventHandlerName(hook);
      return `
      useEffect(() => {
        ${hook.refName}.current?.addEventListener(${eventName}, ${handlerName});
        return () => ${hook.refName}.current?.removeEventListener(${eventName}, ${handlerName});
      }, []);
      `;
    })
    .join('\n');

export const getOnMountComponentBody = ({
  options,
  json,
}: {
  json: JsonComponent;
  options: ToReactOptions;
}) =>
  json.hooks.onMount
    .map(
      (hook) =>
        `useEffect(() => {
          ${processHookCode({
            str: hook.code,
            options,
          })}
        }, [])`,
    )
    .join('\n');

export const getOnUpdateComponentBody = ({
  options,
  json,
}: {
  json: JsonComponent;
  options: ToReactOptions;
}) =>
  json.hooks.onUpdate
    ?.map(
      (hook) => `useEffect(() => {
          ${processHookCode({ str: hook.code, options })}
        },
        ${hook.deps ? processHookCode({ str: hook.deps, options }) : ''})`,
    )
    .join(';') ?? '';

export const getOnUnMountComponentBody = ({
  options,
  json,
}: {
  json: JsonComponent;
  options: ToReactOptions;
}) =>
  json.hooks.onUnMount?.code
    ? `useEffect(() => {
          return () => {
            ${processHookCode({
              str: json.hooks.onUnMount.code,
              options,
            })}
          }
        }, [])`
    : '';
