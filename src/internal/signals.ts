import { types } from '@babel/core';
import { babelTransformExpression } from './babel-transform';
import { LEGACY_TOOLCHAIN_PACKAGE } from './legacy-import-filter';

export const getSignalImportName = (code: string): string | undefined => {
  let foundSignalUsage = false;
  let signalImportName: string | undefined = undefined;

  babelTransformExpression(code, {
    ImportSpecifier(path) {
      if (types.isIdentifier(path.node.imported) && path.node.imported.name === 'Signal') {
        if (
          path.parentPath.isImportDeclaration() &&
          path.parentPath.node.source.value === LEGACY_TOOLCHAIN_PACKAGE
        ) {
          // honor aliased imports: `import { Signal as MySignal }` → 'MySignal'
          signalImportName = path.node.local.name;
          path.stop();
        }
      }
    },
  });

  if (!signalImportName) {
    return undefined;
  }

  babelTransformExpression(code, {
    TSTypeReference(path) {
      if (types.isIdentifier(path.node.typeName) && path.node.typeName.name === signalImportName) {
        foundSignalUsage = true;
        path.stop();
      }
    },
  });

  return foundSignalUsage ? signalImportName : undefined;
};

/**
 * Strips `Signal<T>` references down to `T`. React doesn't have a `Writable`-style
 * wrapper, so the inner generic passes through as-is.
 */
export const mapSignalType = ({
  code,
  signalImportName = getSignalImportName(code),
}: {
  code: string;
  signalImportName?: string;
}) =>
  babelTransformExpression(code, {
    TSTypeReference(path) {
      if (types.isIdentifier(path.node.typeName) && path.node.typeName.name === signalImportName) {
        const params = path.node.typeParameters?.params || [];
        path.replaceWith(params[0]);
      }
    },
  });
