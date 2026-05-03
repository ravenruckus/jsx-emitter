import type { JsonComponent, JsonState, StateValue } from '../types';

type ValueMapper = (
  code: string,
  type: 'data' | 'function' | 'getter',
  typeParameter: string | undefined,
  key: string | undefined,
) => string;

interface GetStateObjectStringOptions {
  data?: boolean;
  functions?: boolean;
  getters?: boolean;
  valueMapper?: ValueMapper;
  /**
   * If you want the plain value mapper as output
   */
  onlyValueMapper?: boolean;
  format?: 'object' | 'class' | 'variables';
  keyPrefix?: string;
  withType?: boolean;
}

type RequiredOptions = Required<GetStateObjectStringOptions>;

const DEFAULT_OPTIONS: RequiredOptions = {
  format: 'object',
  keyPrefix: '',
  valueMapper: (val) => val,
  onlyValueMapper: false,
  data: true,
  functions: true,
  getters: true,
  withType: false,
};

const convertStateMemberToString =
  ({
    data,
    format,
    functions,
    getters,
    keyPrefix,
    valueMapper,
    withType,
    onlyValueMapper,
  }: RequiredOptions) =>
  ([key, state]: [string, StateValue | undefined]): string | undefined => {
    const keyValueDelimiter = format === 'object' ? ':' : '=';

    if (!state) {
      return undefined;
    }

    const { code, typeParameter } = state;

    const type = withType && typeParameter ? `:${typeParameter}` : '';

    switch (state.type) {
      case 'function': {
        if (!functions) {
          return undefined;
        }
        const mapper = valueMapper(code, 'function', typeParameter, key);

        if (onlyValueMapper) {
          return mapper;
        }

        return `${keyPrefix} ${key} ${keyValueDelimiter} ${mapper}`;
      }
      case 'method': {
        if (!functions) {
          return undefined;
        }
        const mapper = valueMapper(code, 'function', typeParameter, key);

        if (onlyValueMapper) {
          return mapper;
        }

        return `${keyPrefix} ${mapper}`;
      }
      case 'getter': {
        if (!getters) {
          return undefined;
        }

        const mapper = valueMapper(code, 'getter', typeParameter, key);

        if (onlyValueMapper) {
          return mapper;
        }

        return `${keyPrefix} ${mapper}`;
      }
      case 'property': {
        if (!data) {
          return undefined;
        }
        const mapper = valueMapper(code, 'data', typeParameter, key);

        if (onlyValueMapper) {
          return mapper;
        }

        return `${keyPrefix} ${key}${type}${keyValueDelimiter} ${mapper}`;
      }
      default:
        break;
    }
    return undefined;
  };

export const getMemberObjectString = (
  object: JsonComponent['state'],
  userOptions: GetStateObjectStringOptions = {},
) => {
  const options = { ...DEFAULT_OPTIONS, ...userOptions };

  const lineItemDelimiter = options.format === 'object' ? ',' : '\n';

  const stringifiedProperties = Object.entries(object)
    .map(convertStateMemberToString(options))
    .filter((x) => x !== undefined)
    .join(lineItemDelimiter);

  const prefix = options.format === 'object' ? '{' : '';
  const suffix = options.format === 'object' ? '}' : '';

  // Trailing delimiter is appended so callers can append extra properties
  // without producing invalid JS (e.g. `{,}`).
  const extraDelimiter = stringifiedProperties.length > 0 ? lineItemDelimiter : '';

  return `${prefix}${stringifiedProperties}${extraDelimiter}${suffix}`;
};

export const stringifyContextValue = (
  object: JsonState,
  userOptions: GetStateObjectStringOptions = {},
) => getMemberObjectString(object, userOptions);

export const getStateObjectStringFromComponent = (
  component: JsonComponent,
  options?: GetStateObjectStringOptions,
) => getMemberObjectString(component.state, options);
