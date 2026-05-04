// Filters import paths originating from the upstream-toolchain helper packages
// that should be dropped from the emitted React code. Values consumed only at
// runtime; whitelisted in hygiene.test.ts so they are not mirrored elsewhere.
//
// The two patterns differ on purpose to mirror upstream behavior verbatim:
//   - the @builder.io/components package is matched exactly,
//   - the @builder.io/mitosis* family is matched as a prefix
//     (covers @builder.io/mitosis, @builder.io/mitosis/react, etc.)
const LEGACY_COMPONENTS_PACKAGE = '@builder.io/components';
const LEGACY_TOOLCHAIN_PACKAGE_PREFIX = '@builder.io/mitosis';

export const isLegacyToolchainImportPath = (path: string): boolean => {
  if (path === LEGACY_COMPONENTS_PACKAGE) return true;
  if (path.startsWith(LEGACY_TOOLCHAIN_PACKAGE_PREFIX)) return true;
  return false;
};
