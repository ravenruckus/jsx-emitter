# jsx-emitter

Standalone port of Mitosis's `componentToReact` into an independent package:
**JSON component representation in → React / React Native source string out.** No parser,
no `.lite.tsx`. Goal: byte-for-byte parity with `@builder.io/mitosis`'s React output on the
retained option set, then full independence from the upstream tree.

## Dev workspace layout
This package (`jsx-emitter/`) is its own git repo, developed inside a workspace with two sibling
trees that are **not** part of this repo:
- `../mitosis/` — upstream Mitosis, **read-only reference** (the source of the port). Never import
  from it in shipped code; never edit it.
- `../jsx-emitter-docs/` — plan, status, task tracker, and per-phase build log. Start at
  `../jsx-emitter-docs/STATUS.md` (where things stand) and `../jsx-emitter-docs/TASKS.md` (what's
  next); the spec is `../jsx-emitter-docs/plan.md`. (These live in the workspace, not this repo.)

## Commands (run from this directory)
- Test: `npm test` · single file: `npm test -- test/generator.test.ts`
- Type check: `npm run typecheck` (strict; unused locals/params rejected)
- Build: `npm run build` (tsc + ships fixtures/examples into `dist/`)
- Run typecheck **and** test before committing.
- Hygiene/dead-code work (Phase 6 · T6.1) scans `dist/` — run `npm run build` first so the scan sees current output.

## The one hard rule — no upstream imports
**Nothing in `src/`, `test/`, or `scripts/` may `import` from `@builder.io/mitosis`** — the only
exceptions are the parity scaffolding (`test/parity.test.ts` and `scripts/extract-fixtures.ts`),
both removed in Phase 7. `test/hygiene.test.ts` enforces this (it allowlists exactly those two) and
fails the build on violation. Note: `@builder.io/mitosis` may still appear as a *string* — JSON
`@type` tags in fixtures, test input inside template literals, the `legacy-import-filter.ts` const —
those are fine; the rule is about real `import` statements. Missing a helper? Port/replicate it under
`src/internal/` — do **not** reach into the upstream package, even though it sits in `../mitosis/`.

<!-- PHASE 7 (T7.1/T7.2): once parity.test.ts + extract-fixtures.ts are deleted and the dep dropped,
     this section's "exceptions" clause and the "Sequencing landmine" below both go stale — update both. -->

## Don't "clean up" these — intentional exceptions
These files legitimately contain `mitosis`/upstream strings and are whitelisted in the hygiene
test. Leave the annotated lines alone:
- `src/internal/legacy-import-filter.ts` — strips the `@builder.io/mitosis` import at the input boundary.
- `src/internal/is-node.ts` — accepts the legacy `@builder.io/mitosis/node` `@type` discriminator.
- `src/internal/dedent.ts` — **deliberately mirrors an upstream bug** for parity; don't "fix" it.
- `src/internal/process-http-requests.ts` — a source-path NOTE comment.

## Conventions
- Public API is exactly the entry points re-exported from `src/index.ts` (`componentToReact`,
  `componentToReactNative`, and the `Json*` / `ToReact*Options` types). Everything in `src/internal/`
  is private — don't widen the surface or add deep export paths (`exports` is intentionally narrow).
- Generators are curried: `componentToReact(options)({ component, path? }) => string`.
- Parity is the spec: prefer porting upstream behavior verbatim over "improving" it. Undocumented
  divergence from `@builder.io/mitosis` output is a bug, not a cleanup.
- Match the surrounding file's style.

## Sequencing landmine
The Phase 4 parity test + the `@builder.io/mitosis` dev-dependency are the **only** correctness
oracle against upstream. Do **not** delete them or drop the dep until decisions **D2–D3** in
`../jsx-emitter-docs/TASKS.md` are resolved **and the Phase 5 snapshot suite (T5.1/T5.2) is built**
(D1 already resolved 2026-05-28 = (b)) — that's Phase 7.

<!-- PHASE 7: this landmine resolves once D2–D3 close, T5.1/T5.2 land, and T7.1/T7.2 run; remove or rewrite this section then. -->

## Documenting work
Significant changes get a summary in `../jsx-emitter-docs/updates/` (code reviews in `reviews/`),
named `phase-<id>.md`; cross-references use paths relative to `jsx-emitter-docs/`. See
`../jsx-emitter-docs/README.md` for the convention.
