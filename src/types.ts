import type * as babel from '@babel/core';

// ---------------------------------------------------------------------------
// Generic JSON value types
// ---------------------------------------------------------------------------

export type JSONPrimitive = string | null | number | boolean | undefined;
export type JSONObject = { [key: string]: _JSON | undefined };

/**
 * Underscore-prefixed to avoid collision with the global `JSON` primitive.
 */
export type _JSON = JSONPrimitive | JSONObject | _JSON[];

/** JSON values mixed with babel AST nodes for intermediate compilation. */
export type JSONPrimitiveOrNode = JSONPrimitive | babel.Node;
export type JSONOrNodeObject = { [key: string]: JSONOrNode };
export type JSONOrNode = JSONPrimitiveOrNode | JSONOrNodeObject | JSONOrNode[];

// ---------------------------------------------------------------------------
// Generic helper types
// ---------------------------------------------------------------------------

export type Dictionary<T> = { [key: string]: T };

// ---------------------------------------------------------------------------
// Transpiler / plugin contracts
// ---------------------------------------------------------------------------

export type AttributePassingType = {
  enabled: boolean;
  customRef?: string;
};

export interface BaseTranspilerOptions {
  experimental?: { [key: string]: any };
  /** Run prettier on generated components. */
  prettier?: boolean;
  /** User plugins to run during codegen. */
  plugins?: Plugin[];
  /** Emit TypeScript output. */
  typescript?: boolean;
  /** Enables/disables attribute passing for frameworks with custom elements. */
  attributePassing?: AttributePassingType;
  /** Preserve explicit filename extensions in import statements. */
  explicitImportFileExtension?: boolean;
  /** Preserve explicit filename extensions when regex matches (cli builds). */
  explicitBuildFileExtensions?: Record<string, RegExp>;
}

export interface TranspilerArgs {
  path?: string;
  component: JsonComponent;
}

export type Transpiler<R = string> = (args: TranspilerArgs) => R;

export type TranspilerGenerator<X extends BaseTranspilerOptions, Y = string> = (
  args?: X,
) => Transpiler<Y>;

export type Hook<T> = {
  pre?: T;
  post?: T;
};

export type JsonPlugin = (json: JsonComponent) => JsonComponent | void;
export type CodePlugin = (code: string, json: JsonComponent) => string;

export type Plugin = (options?: any) => {
  name?: string;
  order?: number;
  json?: Hook<JsonPlugin>;
  code?: Hook<CodePlugin>;
};

// ---------------------------------------------------------------------------
// State / hook value types
// ---------------------------------------------------------------------------

export type ReactivityType = 'normal' | 'reactive';

export type StateValueType = 'function' | 'getter' | 'method' | 'property';

export type StateValue = {
  code: string;
  typeParameter?: string;
  type: StateValueType;
  propertyType?: ReactivityType;
};

export type JsonState = Dictionary<StateValue | undefined>;

export type BaseHook = { code: string; deps?: string; depsArray?: string[] };

export type OnEventHook = BaseHook & {
  refName: string;
  eventName: string;
  isRoot: boolean;
  deps?: never;
  eventArgName: string;
  elementArgName?: string;
};

export type OnMountHook = BaseHook & {
  onSSR?: boolean;
};

// ---------------------------------------------------------------------------
// Imports / exports / context
// ---------------------------------------------------------------------------

/**
 * Representation of an ES import statement.
 *
 * @example
 *   // import core, { useState, someThing as someAlias } from 'some-package'
 *   {
 *     path: 'some-package',
 *     imports: {
 *       useState: 'useState',
 *       someAlias: 'someThing',
 *       core: 'default',
 *     }
 *   }
 *
 * @example
 *   // import * as core from 'some-package'
 *   {
 *     path: 'some-package',
 *     imports: {
 *       core: '*',
 *     }
 *   }
 */
export interface JsonImport {
  path: string;
  imports: {
    [key: string]: string | undefined;
  };
  importKind?: 'type' | 'typeof' | 'value' | null;
}

export interface JsonExport {
  code: string;
  usedInLocal?: boolean;
  isFunction?: boolean;
}

export type JsonExports = {
  [name: string]: JsonExport;
};

export type ContextOptions = {
  type?: ReactivityType;
};

export interface ContextGetInfo extends ContextOptions {
  name: string;
  path: string;
}

export interface ContextSetInfo extends ContextOptions {
  name: string;
  value?: JsonState;
  ref?: string;
}

// ---------------------------------------------------------------------------
// Target blocks (target-specific code overrides embedded in JSON)
// ---------------------------------------------------------------------------

export type TargetBlock<Return> = Partial<{
  [target: string]: Return;
}> & {
  default?: Return;
};

export type TargetBlockCode = TargetBlock<{
  code: string;
}>;

export type TargetBlockDefinition = TargetBlockCode & {
  settings: {
    requiresDefault: boolean;
  };
};

// ---------------------------------------------------------------------------
// Bindings and node tree
// ---------------------------------------------------------------------------

export type SpreadType = 'normal' | 'event-handlers';
export type BindingType = 'function' | 'expression';

type BindingProperties =
  | {
      type: 'spread';
      spreadType: SpreadType;
      async?: boolean;
      arguments?: string[];
    }
  | {
      type: 'single';
      bindingType: Extract<BindingType, 'function'>;
      async?: boolean;
      arguments?: string[];
    }
  | {
      type: 'single';
      bindingType: Extract<BindingType, 'expression'>;
      async?: boolean;
      arguments?: string[];
    };

export type Binding = {
  code: string;
} & BindingProperties;

export type BuilderLocalizedValue = {
  '@type': '@builder.io/core:LocalizedValue';
  Default: string;
  [index: string]: string;
};

export interface BlockSlot {
  [key: string]: BlockSlot | BlockSlot[] | JsonNode | JsonNode[];
}

export type BaseNode = {
  /**
   * Discriminator. New JSON tags use `'jsx-emitter/node'`; the legacy
   * upstream-toolchain tag is also accepted at the runtime boundary for
   * input-format compatibility.
   */
  '@type': 'jsx-emitter/node';
  meta: JSONObject;
  name: string;
  scope: {};
  /** Optional type identifier for special node types. */
  type?: 'user-symbol';
  /** Key-value store of string values for DOM attributes. */
  properties: { [key: string]: string | undefined };
  /** Key-value store of expression values for DOM attributes (always strings). */
  bindings: {
    [key: string]: Binding | undefined;
  };
  children: JsonNode[];
  /** Slot name → array of nodes. Used when components have node-shaped props. */
  slots?: { [key: string]: JsonNode[] };
  /** Localized values for content blocks. */
  localizedValues?: { [index: string]: BuilderLocalizedValue };
  /** Serialized elements passed into properties. */
  blocksSlots?: BlockSlot;
};

export const ForNodeName = 'For';
export const FragmentNodeName = 'Fragment';
export const ShowNodeName = 'Show';
export const SlotNodeName = 'Slot';
export const SpecialNodeNameList = [
  ForNodeName,
  FragmentNodeName,
  ShowNodeName,
  SlotNodeName,
] as const;
export type SpecialNodesNames = (typeof SpecialNodeNameList)[number];

export type ForNode = BaseNode & {
  name: 'For';
  scope: {
    forName: string | undefined;
    indexName: string | undefined;
    collectionName: string | undefined;
  };
};

export type ShowNode = BaseNode & {
  name: 'Show';
};

export type JsonNode = BaseNode | ForNode | ShowNode;

export const checkIsForNode = (node: JsonNode): node is ForNode => node.name === ForNodeName;

export const checkIsShowNode = (node: JsonNode): node is ShowNode => node.name === ShowNodeName;

// ---------------------------------------------------------------------------
// Component metadata (slimmed: only React-family targets retained)
// ---------------------------------------------------------------------------

export type ReactMetadata = {
  forwardRef?: string;
};

export type ReactNativeMetadata = {
  forwardRef?: string;
};

export type ReactServerComponentsMetadata = {
  componentType?: 'client' | 'server';
};

type ReactFamilyTarget = 'react' | 'reactNative';

type TargetOptions = Partial<Record<ReactFamilyTarget, Partial<ToReactOptions>>>;

export type ComponentMetadata = {
  httpRequests?: Record<string, string>;
  options?: TargetOptions;
  /** @deprecated Use this for React forwardRef. */
  forwardRef?: string;
  /** Enables/disables attribute passing for frameworks with custom elements. */
  attributePassing?: AttributePassingType;

  react?: ReactMetadata;
  reactNative?: ReactNativeMetadata;
  rsc?: ReactServerComponentsMetadata;
};

// ---------------------------------------------------------------------------
// Component shape
// ---------------------------------------------------------------------------

export type JsonComponentInput = {
  name: string;
  defaultValue: any;
};

export type JsonComponent = {
  '@type': 'jsx-emitter/component';
  name: string;
  imports: JsonImport[];
  exports?: JsonExports;
  meta: JSONObject & {
    useMetadata?: ComponentMetadata;
  };
  inputs: JsonComponentInput[];
  state: JsonState;
  context: {
    get: Dictionary<ContextGetInfo>;
    set: Dictionary<ContextSetInfo>;
  };
  signals?: {
    signalTypeImportName?: string;
  };
  props?: {
    [name: string]: {
      propertyType: ReactivityType;
      optional: boolean;
    };
  };
  refs: {
    [useRef: string]: {
      typeParameter?: string;
      argument: string;
    };
  };
  hooks: {
    init?: BaseHook;
    onInit?: BaseHook;
    onMount: OnMountHook[];
    onUnMount?: BaseHook;
    preComponent?: BaseHook;
    postComponent?: BaseHook;
    onUpdate?: BaseHook[];
    onEvent: OnEventHook[];
  };
  targetBlocks?: Dictionary<TargetBlockDefinition>;
  children: JsonNode[];
  subComponents: JsonComponent[];
  types?: string[];
  propsTypeRef?: string;
  defaultProps?: JsonState;
  style?: string;

  /** Filled by upstream parsers/CLIs to give plugins more context. */
  pluginData?: {
    target?: string;
    path?: string;
    outputDir?: string;
    outputFilePath?: string;
  };

  /** Internal compile-time scratch space; cleared after compilation. */
  compileContext?: Dictionary<{
    state?: JsonState;
    hooks?: Dictionary<BaseHook>;
    extra?: Record<string, any>;
  }>;
};

// ---------------------------------------------------------------------------
// React generator options
// ---------------------------------------------------------------------------

export interface ToReactOptions extends BaseTranspilerOptions {
  stylesType: 'styled-jsx' | 'react-native' | 'style-tag' | 'twrnc' | 'native-wind';
  styleTagsPlacement?: 'top' | 'bottom';
  stateType: 'useState' | 'variables';
  format?: 'lite' | 'safe';
  type: 'dom' | 'native' | 'taro';
  sanitizeReactNative?: boolean;
  rsc?: boolean;
  forwardRef?: string;
  experimental?: any;
  /**
   * For RSC, normal React context is currently not supported, so a prop-drilling
   * option is provided.
   */
  contextType?: 'context' | 'prop-drill';
  addUseClientDirectiveIfNeeded?: boolean;
}
