/**
 * Post-build asset copy.
 *
 * `tsc` only emits artifacts compiled from `src/`; it never copies static
 * `.json`/`.md` files. This step copies the test fixtures and the worked
 * examples into `dist/` so they ship with the package (covered by the
 * `"dist"` entry in package.json `files`) and are reachable via the
 * `./fixtures/*` and `./examples/*` subpath exports.
 *
 * Runs after `tsc --build` in the `build` script.
 */
import { cpSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '..');

// Test fixtures (JSON component inputs) -> dist/fixtures
cpSync(resolve(root, 'test/fixtures'), resolve(root, 'dist/fixtures'), { recursive: true });

// Worked examples (JSON in, generated TSX out, README) -> dist/examples
cpSync(resolve(root, 'examples'), resolve(root, 'dist/examples'), { recursive: true });

console.log('copied test/fixtures -> dist/fixtures and examples -> dist/examples');
