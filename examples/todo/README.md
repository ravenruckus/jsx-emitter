# Todo example

A small end-to-end demonstration of `jsx-emitter`: two JSON component
descriptions are loaded from disk, fed into `componentToReact`, and the
generated React source is written to `output/`.

## Layout

```
examples/todo/
├── components/
│   ├── Todo.json     # one todo item — typed props, no internal state
│   └── Todos.json    # parent — local state, For/Show, imports Todo
├── build.ts          # loads each JSON and runs componentToReact
├── output/           # generated React (TSX) — committed for visibility
│   ├── Todo.tsx
│   └── Todos.tsx
└── README.md
```

The components mirror the shape of the upstream Mitosis Todo example: a
`Todo` row that delegates events back to its parent, and a `Todos` parent
that owns the list state and renders one `Todo` per item.

## Running it

From the package root:

```sh
npx tsx examples/todo/build.ts
```

This regenerates `output/Todo.tsx` and `output/Todos.tsx`. The build
script imports `componentToReact` from `../../src/index` (the in-repo
source) so no prior `npm run build` is required.

## What's in each file

### `components/Todo.json`

A leaf component — props only, no `state`, no hooks. Demonstrates:

- `propsTypeRef` + `types[]` so the generated function signature is
  typed (`function Todo(props: TodoProps)`).
- `bindings.class` for a dynamic className expression.
- `bindings.onChange`/`bindings.onClick` (function bindings) for event
  handlers.
- The "wrap text in a child node" pattern: an element that should render
  text content (e.g. `<label>{props.text}</label>`) holds an inner node
  whose `_text` binding (or `_text` property for a literal) carries the
  string. A node with `_text` set on itself collapses to bare text and
  loses its wrapping element — see `<h1>Todos</h1>` in `Todos.json` for
  a static-text example.

### `components/Todos.json`

The parent. Demonstrates the richer surface area:

- `state` with both `property` and `method` entries. The generator
  expands `property` entries into `useState` pairs and rewrites every
  `state.x = y` assignment into the matching `setX(y)` call.
- A `For` node — the `scope` declares `forName: "item"` and
  `indexName: "index"`, which become the parameters of the emitted
  `.map((item, index) => ...)`.
- A `Show` node — emitted as a ternary (`when` expression `? <ul>... :
  null`).
- An `imports` entry referencing `./Todo`. The generator preserves the
  import verbatim and emits `<Todo ... />` for the `name: "Todo"` child
  node.

## Generated output

`build.ts` passes `{ typescript: true }` to `componentToReact`, so the
output uses TS syntax: typed signatures, `useState<T>(...)`, exported
type defs at the top of the file. Drop the option (or set it to false)
to emit plain JS.

For example, `Todos.tsx`:

```tsx
function Todos(props: TodosProps) {
  const [items, setItems] = useState<TodoItem[]>(() => props.initial || []);
  const [draft, setDraft] = useState<string>(() => "");

  function addTodo() { /* ... */ }
  function toggleTodo(index: number) { /* ... */ }
  function removeTodo(index: number) { /* ... */ }

  return (
    <section className="todos">
      <h1>Todos</h1>
      {/* input + Add button */}
      {items.length > 0 ? (
        <ul className="todo-list">
          {items?.map((item, index) => (
            <Todo
              text={item.text}
              completed={item.completed}
              onToggle={(event) => toggleTodo(index)}
              onRemove={(event) => removeTodo(index)}
            />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
```

## Authoring JSON

The JSON files here are hand-authored to keep the example self-contained
and inspectable. In a real-world setup you'd typically have an upstream
parser or authoring UI produce the JSON, then feed it into
`componentToReact` as shown.

The `@type` discriminator on each component is `"jsx-emitter/component"`
(and `"jsx-emitter/node"` for nodes). The legacy
`"@builder.io/mitosis/component"` / `"@builder.io/mitosis/node"` tags are
also accepted at runtime for input-format compatibility.
