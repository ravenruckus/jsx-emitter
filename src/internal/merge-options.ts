import type { BaseTranspilerOptions, JsonComponent, ReactFamilyTarget } from '../types';
import { getSignalAccessPlugin, getSignalTypePlugin } from './plugins/process-signals';
import { processTargetBlocks } from './plugins/process-target-blocks';

/**
 * Merges options while combining the `plugins` array, and adds any default plugins.
 */
export const mergeOptions = <T extends BaseTranspilerOptions>(
  a: T,
  b: Partial<T> = {},
  c?: Partial<T>,
  d?: Partial<T>,
): T & { plugins: NonNullable<T['plugins']> } => {
  return {
    ...a,
    ...b,
    ...c,
    ...d,
    plugins: [
      ...(a.plugins || []),
      ...(b.plugins || []),
      ...(c?.plugins || []),
      ...(d?.plugins || []),
    ],
  };
};

/**
 * Layers user/extra/metadata overrides on top of generator defaults and prefixes
 * the React-target default plugins (target-blocks substitution, signal-type
 * stripping, signal-access rewriting) onto the plugin pipeline.
 *
 * `target` selects which `useMetadata.options[...]` slot is read. Defaults to
 * `'react'`; the React Native flow passes `'reactNative'` so author overrides
 * under that key are preserved (see upstream merge-options.ts behavior).
 */
export const initializeOptions = <T extends BaseTranspilerOptions>({
  target = 'react',
  component,
  defaults,
  userOptions,
  extra,
}: {
  target?: ReactFamilyTarget;
  component: JsonComponent;
  defaults: T;
  userOptions?: Partial<T>;
  extra?: Partial<T>;
}): T & { plugins: NonNullable<T['plugins']> } => {
  const metadataOverrides = component.meta?.useMetadata?.options?.[target] as
    | Partial<T>
    | undefined;

  const options = mergeOptions(defaults, userOptions, extra, metadataOverrides);

  // Default plugins run first so they can rewrite magic strings and signal
  // access into ordinary code before any user plugin sees the component.
  // `target` is forwarded so `useTarget({ react: ..., reactNative: ... })` blocks
  // resolve to the active flow's key. Signal mappers are React-only so they don't
  // take the parameter.
  options.plugins.unshift(
    processTargetBlocks(target),
    getSignalTypePlugin(),
    getSignalAccessPlugin(),
  );

  return options;
};
