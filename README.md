# jsx-emitter

Standalone JSON-to-React generator. Compiles a structured JSON component
representation (`JsonComponent`) into React — or React Native — source code.

## Install

```sh
npm install jsx-emitter
```

## Usage

```ts
import { componentToReact, type JsonComponent } from 'jsx-emitter';

const component: JsonComponent = /* a `jsx-emitter/component` object */;

// `componentToReact` is curried: pass options once to get a reusable
// generator, then call it per component.
const generate = componentToReact({ typescript: true });
const code = generate({ component }); // -> a string of React source
```

`generate` takes `{ component, path? }` and returns the generated source as a
string. `path` is optional and only used to give plugins more context.

## What you can import

The package's `exports` field intentionally limits the public surface to the
three entry points below. Deep paths such as `jsx-emitter/dist/blocks` are
**not** importable.

### `jsx-emitter` — the public API

| Export | Kind | Description |
| --- | --- | --- |
| `componentToReact` | function | `(options?) => ({ component, path? }) => string`. Generates React source. |
| `componentToReactNative` | function | Same shape; equivalent to `componentToReact` with `type: 'native'` forced. |
| `JsonComponent` | type | The input shape consumed by the generators. |
| `JsonNode` | type | A single node within a component's `children` tree. |
| `JsonImport` | type | An entry in a component's `imports`. |
| `ToReactOptions` | type | Options accepted by `componentToReact`. |
| `ToReactNativeOptions` | type | Options accepted by `componentToReactNative`. |

```ts
import {
  componentToReact,
  componentToReactNative,
  type JsonComponent,
  type JsonNode,
  type JsonImport,
  type ToReactOptions,
  type ToReactNativeOptions,
} from 'jsx-emitter';
```

### `jsx-emitter/fixtures/*` — sample component JSON

The test-suite fixtures ship with the package: ready-made `JsonComponent`
inputs you can use as examples or test data. The tree mirrors the repo's
`test/fixtures/`:

```
fixtures/
├── js/<name>.json          # plain-JS-oriented inputs
└── ts/
    ├── <name>.json         # TypeScript-oriented inputs
    ├── blocks/<name>.json  # individual block/element cases
    └── ref/<name>.json     # ref-handling cases
```

```ts
import basic from 'jsx-emitter/fixtures/ts/basic.json';
// e.g. jsx-emitter/fixtures/js/basic.json,
//      jsx-emitter/fixtures/ts/blocks/button.json
```

### `jsx-emitter/examples/*` — worked examples

The end-to-end Todo example — JSON inputs, the build recipe, the generated
output, and a walkthrough:

```
examples/todo/
├── components/Todo.json    # input
├── components/Todos.json
├── output/Todo.tsx         # generated output (committed for reference)
├── output/Todos.tsx
├── build.ts                # loads each JSON and runs componentToReact
└── README.md               # walkthrough of every field used
```

```ts
import { componentToReact, type JsonComponent } from 'jsx-emitter';
import todo from 'jsx-emitter/examples/todo/components/Todo.json';

const code = componentToReact({ typescript: true })({
  component: todo as JsonComponent,
});
```

> **Importing JSON:** the plain form above works with a bundler or with
> TypeScript's `resolveJsonModule`. In native Node ESM, add an import
> attribute — `import basic from 'jsx-emitter/fixtures/ts/basic.json' with { type: 'json' };`.

## Options

`componentToReact` accepts `Partial<ToReactOptions>`. Most commonly:

- `typescript` — emit TypeScript (typed signatures, `useState<T>(...)`, exported type defs). Defaults to plain JS/JSX.
- `prettier` — run Prettier over the generated source.
- `type` — `'dom'` (default), `'native'`, or `'taro'`.
- `stateType` — `'useState'` or `'variables'`.
- `stylesType` — `'styled-jsx'`, `'style-tag'`, `'react-native'`, `'twrnc'`, or `'native-wind'`.
- `rsc` — emit React Server Component output.
- `plugins` — custom codegen plugins.

See the `ToReactOptions` / `ToReactNativeOptions` types for the full set.

## Input shape

Input is a `JsonComponent` — an object tagged with `'@type': 'jsx-emitter/component'`
(the legacy `'@builder.io/mitosis/component'` tag is also accepted at runtime).
The importable **fixtures** and **examples** above are the easiest reference for
the exact shape; the [example walkthrough](./examples/todo/README.md) explains
each field in context.
