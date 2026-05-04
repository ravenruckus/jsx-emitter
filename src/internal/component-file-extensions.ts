type Target = 'react' | 'reactNative';

const COMPONENT_EXTENSIONS = {
  jsx: ['.lite.tsx', '.lite.jsx'],
  svelte: ['.svelte'],
};

export const COMPONENT_IMPORT_EXTENSIONS = [COMPONENT_EXTENSIONS.svelte, COMPONENT_EXTENSIONS.jsx]
  .flat()
  .concat(['.lite']);

/**
 * Matches `.svelte`, `.lite.tsx`, `.lite.jsx` files (with optional `.jsx`/`.tsx` extension)
 */
export const INPUT_EXTENSION_REGEX = /\.(svelte|(lite(\.tsx|\.jsx)?))/g;

type Args = { target: Target } & (
  | {
      /** Whether we are rendering an import statement or a filename. */
      type: 'import';
      explicitImportFileExtension: boolean;
    }
  | {
      /** Whether we are rendering an import statement or a filename. */
      type: 'filename';
      isTypescript: boolean;
    }
);

/**
 * Provides the correct file extension for a given component. Slimmed from the
 * upstream multi-target implementation to only the React-family targets that
 * this package supports.
 */
export const getComponentFileExtensionForTarget = (args: Args): string => {
  switch (args.target) {
    case 'react':
    case 'reactNative':
      switch (args.type) {
        case 'import':
          return args.explicitImportFileExtension ? '.js' : '';
        case 'filename':
          return args.isTypescript ? '.tsx' : '.jsx';
      }
  }
};
