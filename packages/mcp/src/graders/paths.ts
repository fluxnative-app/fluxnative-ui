// Paths the graders read: the catalog layer they check screens against, and
// the canned screens their tests grade.

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PACKAGE_ROOT } from '@fluxnative/catalog';

export const GRADERS_DIR = dirname(fileURLToPath(import.meta.url));
export const FIXTURES_DIR = join(GRADERS_DIR, 'fixtures');

/** The @fluxnative/catalog package wherever it is installed: packages/catalog in this repo, node_modules/@fluxnative/catalog from npm. */
export const CATALOG_DIR = PACKAGE_ROOT;
export const REPO_ROOT = join(CATALOG_DIR, '..', '..');
/** The canonical copy of the catalog layer: what `fluxnative-catalog emit` writes into a template. */
export const CATALOG_FILES = join(CATALOG_DIR, 'files');
export const CATALOG_CLI = join(CATALOG_DIR, 'src', 'cli.ts');
/** The template dialect's compiler options (strict, noUncheckedIndexedAccess, jsx: react). */
export const CATALOG_TSCONFIG = join(CATALOG_DIR, 'tsconfig.files.json');
/** react, react-native, react-native-svg and their types, which a scaffolded template resolves through a symlink. */
export const CATALOG_NODE_MODULES = join(CATALOG_DIR, 'node_modules');
