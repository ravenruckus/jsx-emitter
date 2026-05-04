import type { BaseTranspilerOptions, JsonComponent } from '../types';
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

const TARGET = 'react' as const;

/**
 * Layers user/extra/metadata overrides on top of generator defaults and prefixes
 * the React-target default plugins (target-blocks substitution, signal-type
 * stripping, signal-access rewriting) onto the plugin pipeline.
 */
export const initializeOptions = <T extends BaseTranspilerOptions>({
  component,
  defaults,
  userOptions,
  extra,
}: {
  component: JsonComponent;
  defaults: T;
  userOptions?: Partial<T>;
  extra?: Partial<T>;
}): T & { plugins: NonNullable<T['plugins']> } => {
  const metadataOverrides = component.meta?.useMetadata?.options?.[TARGET] as
    | Partial<T>
    | undefined;

  const options = mergeOptions(defaults, userOptions, extra, metadataOverrides);

  // Default plugins run first so they can rewrite magic strings and signal
  // access into ordinary code before any user plugin sees the component.
  options.plugins.unshift(processTargetBlocks(), getSignalTypePlugin(), getSignalAccessPlugin());

  return options;
};
