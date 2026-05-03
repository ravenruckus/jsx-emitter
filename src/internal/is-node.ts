import type { JsonNode } from '../types';

const NEW_DISCRIMINATOR = 'jsx-emitter/node';
// Legacy upstream-toolchain @type tag accepted at the runtime input boundary
// for input-format compatibility with JSON produced by the predecessor toolchain.
// Whitelisted in hygiene.test.ts; do not mirror this string elsewhere.
const LEGACY_DISCRIMINATOR = '@builder.io/mitosis/node';

export const isNode = (thing: unknown): thing is JsonNode => {
  if (!thing || typeof thing !== 'object') return false;
  const tag = (thing as { '@type'?: unknown })['@type'];
  return tag === NEW_DISCRIMINATOR || tag === LEGACY_DISCRIMINATOR;
};
