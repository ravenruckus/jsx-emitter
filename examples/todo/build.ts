/**
 * Todo example — build script.
 *
 * Loads each `components/*.json` (a `JsonComponent` shape), runs it through
 * `componentToReact` from `jsx-emitter`, and writes the generated React source
 * to `output/<name>.tsx`.
 *
 * Run with: `npx tsx examples/todo/build.ts`
 *
 * The JSON files are hand-authored to keep the example self-contained — in a
 * real-world setup, the JSON would typically be produced by an upstream parser
 * or authoring UI and then fed into `componentToReact`.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { componentToReact, type JsonComponent } from '../../src/index';

const here = resolve(__dirname);
const componentsDir = resolve(here, 'components');
const outputDir = resolve(here, 'output');

mkdirSync(outputDir, { recursive: true });

const componentFiles = ['Todo.json', 'Todos.json'];

// Pass `typescript: true` so the generator emits typed signatures and
// `useState<T>(...)` annotations using the `types[]` and `propsTypeRef`
// fields declared in each component JSON. Drop the option (or set false)
// to emit plain JS/JSX instead.
const generate = componentToReact({ typescript: true });

for (const file of componentFiles) {
  const json = JSON.parse(readFileSync(resolve(componentsDir, file), 'utf8')) as JsonComponent;
  const tsx = generate({ component: json });

  const outName = basename(file, '.json') + '.tsx';
  const outPath = resolve(outputDir, outName);
  writeFileSync(outPath, tsx);
  console.log(`generated output/${outName} (${tsx.length} bytes)`);
}
