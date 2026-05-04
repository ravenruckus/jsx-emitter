import type { JsonComponent, JsonImport } from '../types';
import {
  COMPONENT_IMPORT_EXTENSIONS,
  INPUT_EXTENSION_REGEX,
  getComponentFileExtensionForTarget,
} from './component-file-extensions';
import { isLegacyToolchainImportPath } from './legacy-import-filter';

type Target = 'react' | 'reactNative';

const DEFAULT_IMPORT = 'default';
const STAR_IMPORT = '*';

const getStarImport = ({ theImport }: { theImport: JsonImport }): string | null => {
  for (const key in theImport.imports) {
    const value = theImport.imports[key];
    if (value === STAR_IMPORT) {
      return key;
    }
  }
  return null;
};
const getDefaultImport = ({ theImport }: { theImport: JsonImport }): string | null => {
  for (const key in theImport.imports) {
    const value = theImport.imports[key];
    if (value === DEFAULT_IMPORT) {
      return key;
    }
  }
  return null;
};

const CONTEXT_IMPORTS = ['context.lite', 'context.lite.ts', 'context.lite.js'];
const checkIsContextImport = (theImport: JsonImport) =>
  CONTEXT_IMPORTS.some((contextPath) => theImport.path.endsWith(contextPath));

export const checkIsComponentImport = (theImport: JsonImport) =>
  !checkIsContextImport(theImport) &&
  COMPONENT_IMPORT_EXTENSIONS.some((contextPath) => theImport.path.endsWith(contextPath));

export const transformImportPath = ({
  theImport,
  target,
  preserveFileExtensions,
  explicitImportFileExtension,
}: {
  theImport: JsonImport;
  target: Target;
  preserveFileExtensions: boolean;
  explicitImportFileExtension: boolean;
}) => {
  // Drop the .lite from context files; the context generator does so as well.
  if (checkIsContextImport(theImport)) {
    let path = theImport.path;
    CONTEXT_IMPORTS.forEach((contextPath) => {
      if (path.endsWith(contextPath)) {
        path = path.replace(contextPath, 'context.js');
      }
    });
    return path;
  }

  if (preserveFileExtensions) return theImport.path;

  if (checkIsComponentImport(theImport)) {
    return theImport.path.replace(
      INPUT_EXTENSION_REGEX,
      getComponentFileExtensionForTarget({ target, type: 'import', explicitImportFileExtension }),
    );
  }

  return theImport.path;
};

const getNamedImports = ({ theImport }: { theImport: JsonImport }) => {
  const namedImports = Object.entries(theImport.imports)
    .filter(([, value]) => ![DEFAULT_IMPORT, STAR_IMPORT].includes(value!))
    .map(([key, value]) => {
      return key !== value ? `${value} as ${key}` : value;
    });

  if (namedImports.length > 0) {
    return `{ ${namedImports.join(', ')} }`;
  } else {
    return null;
  }
};

interface ImportValues {
  starImport: string | null;
  defaultImport: string | null;
  namedImports: string | null;
}

const getImportedValues = ({ theImport }: { theImport: JsonImport }): ImportValues => {
  const starImport = getStarImport({ theImport });
  const defaultImport = getDefaultImport({ theImport });
  const namedImports = getNamedImports({ theImport });

  return { starImport, defaultImport, namedImports };
};

const getImportValue = ({ defaultImport, namedImports, starImport }: ImportValues) => {
  if (starImport) {
    return ` * as ${starImport} `;
  } else {
    return [defaultImport, namedImports].filter(Boolean).join(', ');
  }
};

type ImportArgs = {
  target: Target;
  preserveFileExtensions?: boolean;
  component?: JsonComponent | null | undefined;
  explicitImportFileExtension?: boolean;
};

export const renderImport = ({
  theImport,
  target,
  preserveFileExtensions = false,
  explicitImportFileExtension = false,
}: ImportArgs & { theImport: JsonImport }): string => {
  const importedValues = getImportedValues({ theImport });

  const path = transformImportPath({
    theImport,
    target,
    preserveFileExtensions,
    explicitImportFileExtension,
  });
  const importValue = getImportValue(importedValues);

  const isTypeImport = theImport.importKind === 'type';

  return importValue
    ? `import ${isTypeImport ? 'type' : ''} ${importValue} from '${path}';`
    : `import '${path}';`;
};

const renderImports = ({
  imports,
  target,
  excludeLiteComponents,
  preserveFileExtensions = false,
  explicitImportFileExtension,
}: ImportArgs & {
  imports: JsonImport[];
  excludeLiteComponents?: boolean;
}): string =>
  imports
    .filter((theImport) => {
      if (isLegacyToolchainImportPath(theImport.path)) {
        return false;
      } else if (excludeLiteComponents && theImport.path.includes('.lite')) {
        return false;
      } else {
        return true;
      }
    })
    .map((theImport) =>
      renderImport({
        theImport,
        target,
        preserveFileExtensions,
        explicitImportFileExtension,
      }),
    )
    .join('\n');

export const renderPreComponent = ({
  component,
  target,
  excludeLiteComponents,
  preserveFileExtensions = false,
  explicitImportFileExtension = false,
  excludeExportAndLocal = false,
}: Omit<ImportArgs, 'explicitImportFileExtension'> &
  Partial<Pick<ImportArgs, 'explicitImportFileExtension'>> & {
    component: JsonComponent;
    target: Target;
    excludeLiteComponents?: boolean;
    excludeExportAndLocal?: boolean;
  }): string => `
    ${renderImports({
      imports: component.imports,
      target,
      excludeLiteComponents,
      preserveFileExtensions,
      component,
      explicitImportFileExtension,
    })}
    ${excludeExportAndLocal ? '' : renderExportAndLocal(component)}
    ${component.hooks.preComponent?.code || ''}
  `;

const renderExportAndLocal = (component: JsonComponent): string => {
  return Object.keys(component.exports || {})
    .map((key) => component.exports![key].code)
    .join('\n');
};
